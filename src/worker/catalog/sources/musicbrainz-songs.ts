// The MusicBrainz catalog source of songs (ADR-0013, Songs): a song is a recording, one across every
// release it is on, and a search or a song's details are one MusicBrainz request each, through the
// albums' queue, User-Agent and retry (./musicbrainz.ts). Its cover is the Cover Art Archive's front
// cover of a release group the recording is on, linked and never fetched.
import { z } from "zod";
import type { SongCacheExtra } from "../../../db/schema";
import {
  type CatalogEntry,
  type CatalogEnv,
  type CatalogSearchMatch,
  type CatalogSource,
  SourceUnavailable,
  shownTitles,
} from "../source";
import {
  ArtistCredit,
  bodyOf,
  classifyFailure,
  coverRefFor,
  coverRefOf,
  coverUrls,
  creditedArtists,
  creditOf,
  escaped,
  get,
  lookUp,
  mbid,
  musicBrainzRefreshShare,
  namedIn,
  wordsOf,
  yearOfDate,
} from "./musicbrainz";
import { searchLanguage } from "./search-language";

// Only the fields we use, so MusicBrainz adding or dropping others doesn't break us. A search
// leaves out a release group's secondary-types when there are none, and a lookup gives them as an
// empty list.
const ReleaseGroup = z.object({
  id: z.string().regex(mbid),
  title: z.string(),
  "primary-type": z.string().nullish(),
  "secondary-types": z.array(z.string()).nullish(),
});

type ReleaseGroup = z.infer<typeof ReleaseGroup>;

const Release = z.object({
  id: z.string(),
  status: z.string().nullish(),
  date: z.string().nullish(),
  "release-group": ReleaseGroup.optional(),
});

type Release = z.infer<typeof Release>;

const Recording = z.object({
  id: z.string().regex(mbid),
  title: z.string(),
  "artist-credit": ArtistCredit.optional(),
  disambiguation: z.string().nullish(),
  video: z.boolean().nullish(),
  "first-release-date": z.string().nullish(),
  releases: z.array(Release).nullish(),
});

type Recording = z.infer<typeof Recording>;

const SearchResponse = z.object({ recordings: z.array(z.unknown()) });

// How many releases a recording is on, by MBID: a search lists a release that has it twice twice.
function releasesOf(recording: Recording): number {
  return new Set((recording.releases ?? []).map((release) => release.id)).size;
}

// Whether a recording is hidden from Search: a video, one on no release, or one whose
// disambiguation starts with "live" or holds "karaoke", ignoring case. The query hides those it can
// match as words; this catches what it lets through, such as "livestream".
export function isHidden(recording: Recording): boolean {
  const disambiguation = (recording.disambiguation ?? "").toLowerCase();
  return (
    recording.video === true ||
    releasesOf(recording) === 0 ||
    disambiguation.startsWith("live") ||
    disambiguation.includes("karaoke")
  );
}

// A recording search's query: every word of the User's in the title or the artist, video, live,
// karaoke and release-less recordings left out, and boosts that lift widely released recordings,
// which change the order and never what matches. The words are lowercased, so "AND", "OR" and
// "NOT" are never operators, and a word with no letter or digit ("&") is dropped. Null when no
// word is left.
export function recordingQuery(query: string): string | null {
  const words = query
    .split(/\s+/)
    .map((word) => word.toLowerCase())
    .filter((word) => /[\p{L}\p{N}]/u.test(word))
    .map(escaped);
  if (words.length === 0) return null;
  const everyWord = words.map((word) => `(recording:${word} OR artist:${word})`).join(" AND ");
  const hidden = "NOT video:true AND NOT comment:live AND NOT comment:karaoke AND reid:*";
  const boosts =
    "secondarytype:compilation^5 secondarytype:soundtrack^5 primarytype:single^5 primarytype:album^5";
  return `+(${everyWord} AND ${hidden}) ${boosts}`;
}

// A date MusicBrainz writes as YYYY, YYYY-MM or YYYY-MM-DD, to sort by: a missing month or day
// counts as the end of its year or month, and no date sorts after every date.
function dateKey(date: string | null | undefined): string {
  const [year, month = "99", day = "99"] = (date ?? "").split("-");
  return year ? `${year}-${month}-${day}` : "~";
}

// A studio release group: one with no secondary type, or only Soundtrack ("Help!").
function isStudio(group: ReleaseGroup): boolean {
  return (group["secondary-types"] ?? []).every((type) => type === "Soundtrack");
}

const primaryTypeOrder = ["Album", "EP", "Single"];

function primaryTypeRank(group: ReleaseGroup): number {
  const rank = primaryTypeOrder.indexOf(group["primary-type"] ?? "");
  return rank === -1 ? primaryTypeOrder.length : rank;
}

// The release group a song's album and cover come from, among its Official releases: a studio one
// before the rest; then Album, EP, Single and any other type; then the earliest release, a missing
// month or day counting as the end of its period; then the release's MBID, so a tie is always
// broken alike. Null for a song on no Official release.
function firstRelease(recording: Recording): ReleaseGroup | null {
  const official = (recording.releases ?? []).flatMap((release) => {
    const group = release["release-group"];
    return release.status === "Official" && group ? [{ release, group }] : [];
  });
  const compare = (
    a: { release: Release; group: ReleaseGroup },
    b: { release: Release; group: ReleaseGroup },
  ) =>
    Number(isStudio(b.group)) - Number(isStudio(a.group)) ||
    primaryTypeRank(a.group) - primaryTypeRank(b.group) ||
    dateKey(a.release.date).localeCompare(dateKey(b.release.date)) ||
    a.release.id.localeCompare(b.release.id);
  return official.sort(compare)[0]?.group ?? null;
}

// The studio Album a song is from, and the release group whose cover it shows: the first release
// group by firstRelease, which is its album only when it is a studio Album.
export function albumAndCover(recording: Recording): {
  album: ReleaseGroup | null;
  cover: ReleaseGroup | null;
} {
  const first = firstRelease(recording);
  const isAlbum = first !== null && isStudio(first) && first["primary-type"] === "Album";
  return { album: isAlbum ? first : null, cover: first };
}

interface Row {
  // The recording that stands for the row, and its place in MusicBrainz's order.
  recording: Recording;
  order: number;
}

// Recordings with the same title, ignoring case, and the same artist credit, as one row each,
// in the order of each row's first recording. A row is represented by its recording on the most
// releases, then the one first released, then the first in MusicBrainz's order.
export function collapsed(recordings: Recording[]): Row[] {
  const rows = new Map<string, Row>();
  for (const [order, recording] of recordings.entries()) {
    const key = JSON.stringify([
      recording.title.toLowerCase(),
      creditOf(recording["artist-credit"]),
    ]);
    const row = rows.get(key);
    if (!row) {
      rows.set(key, { recording, order });
      continue;
    }
    const more = releasesOf(recording) - releasesOf(row.recording);
    const earlier =
      dateKey(recording["first-release-date"]) < dateKey(row.recording["first-release-date"]);
    if (more > 0 || (more === 0 && earlier)) row.recording = recording;
  }
  return [...rows.values()];
}

// How much of a song the query names: one for its title, and one for any of its credited artists
// in the words the title left, so a word counts for one of them, as for albums.
function namedByQuery(queryWords: Set<string>, recording: Recording): number {
  const title = namedIn(queryWords, recording.title);
  const left = new Set([...queryWords].filter((word) => !title?.includes(word)));
  const artist = (recording["artist-credit"] ?? []).some((credit) => namedIn(left, credit.name));
  return (title ? 1 : 0) + (artist ? 1 : 0);
}

// The rows reranked: the songs whose title and artist the query names first, then those it names
// one of the two of; within each, more releases first, then MusicBrainz's order.
export function ranked(query: string, rows: Row[]): Row[] {
  const queryWords = new Set(wordsOf(query));
  return rows
    .map((row) => ({
      row,
      named: namedByQuery(queryWords, row.recording),
      releases: releasesOf(row.recording),
    }))
    .sort((a, b) => b.named - a.named || b.releases - a.releases || a.row.order - b.row.order)
    .map(({ row }) => row);
}

async function searchSongs(env: CatalogEnv, query: string): Promise<CatalogSearchMatch[]> {
  const sent = recordingQuery(query);
  if (sent === null) return [];
  const path = "/recording/";
  const answer = await get(env, path, { query: sent, limit: "50" });
  const body = SearchResponse.safeParse(bodyOf(path, answer));
  if (!body.success) {
    throw new SourceUnavailable("MusicBrainz search answered in an unknown shape", "temporary");
  }
  const recordings = body.data.recordings.flatMap((each) => {
    const recording = Recording.safeParse(each);
    return recording.success && !isHidden(recording.data) ? [recording.data] : [];
  });
  const titleLanguage = searchLanguage(query) === "uk-UA" ? "uk" : "en";
  const rows = ranked(query, collapsed(recordings));
  return rows.map(({ recording }) => {
    const { album, cover } = albumAndCover(recording);
    return {
      externalReference: { source: "musicbrainz", mediaType: "song", id: recording.id },
      title: recording.title,
      originalTitle: recording.title,
      year: yearOfDate(recording["first-release-date"]),
      posterUrl: cover ? (coverUrls(coverRefFor(env, cover.id))?.small ?? null) : null,
      titleLanguage,
      authors: [],
      artistCredit: creditOf(recording["artist-credit"]),
      album: album?.title ?? null,
      disambiguation: recording.disambiguation || null,
    };
  });
}

// A recording's page on MusicBrainz, for its User to follow to its releases.
function pageOf(id: string): string {
  return `https://musicbrainz.org/recording/${id}`;
}

// One request for everything a song's entry holds: the recording's lookup with its artists and
// releases, which lists at most 25 of them, so its album and cover are chosen among those and can
// differ from the search row's (ADR-0013). A merged recording is looked up through its redirect.
// Its title is its Original Title, and it has no Localized Title in any language.
async function songDetails(env: CatalogEnv, id: string): Promise<CatalogEntry<"song">> {
  if (!mbid.test(id)) throw new SourceUnavailable(`MusicBrainz has no recording ${id}`, "gone");
  const params = { inc: "artist-credits+releases+release-groups" };
  const recording = Recording.safeParse(await lookUp(env, "recording", id, params));
  if (!recording.success) {
    throw new SourceUnavailable(
      "MusicBrainz's recording answered in an unknown shape",
      "temporary",
    );
  }
  const found = recording.data;
  const { album, cover } = albumAndCover(found);
  const extra: SongCacheExtra = {
    artistCredit: creditOf(found["artist-credit"]),
    artists: creditedArtists(found["artist-credit"]),
    album: album && { title: album.title, mbid: album.id },
    coverMbid: cover?.id ?? null,
    disambiguation: found.disambiguation || null,
    url: pageOf(found.id),
  };
  return {
    englishTitle: null,
    ukrainianTitle: null,
    originalTitle: found.title,
    year: yearOfDate(found["first-release-date"]),
    coverRef: cover && coverRefFor(env, cover.id),
    extra,
  };
}

const emptyExtra: SongCacheExtra = {
  artistCredit: null,
  artists: [],
  album: null,
  coverMbid: null,
  disambiguation: null,
  url: null,
};

// MusicBrainz's songs, kept with no maximum age for the albums' reasons. Each costs the cron one
// call, two for a merged one, and they share the albums' allowance of a run's subrequests.
export const musicBrainzSongs: CatalogSource<"song"> = {
  externalSource: "musicbrainz",
  mediaType: "song",
  refreshCost: 1,
  refreshShare: musicBrainzRefreshShare,
  maxEntryAge: null,
  search: searchSongs,
  details: songDetails,
  coverRefOf,
  emptyExtra,
  coverUrls,
  classifyFailure,
  metadataOf: (entry) => ({
    ...shownTitles(entry),
    ukrainianTitle: null,
    year: entry.year,
    coverUrls: coverUrls(entry.coverRef),
    artistCredit: entry.extra.artistCredit,
    artists: entry.extra.artists.map((artist) => artist.name),
    album: entry.extra.album?.title ?? null,
    disambiguation: entry.extra.disambiguation,
    url: entry.extra.url,
  }),
  // A song has no About block.
  aboutOf: () => null,
};
