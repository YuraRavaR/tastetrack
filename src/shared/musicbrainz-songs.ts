// Song search's rules (ADR-0013, Songs): the recording search's query, and what is made of
// MusicBrainz's answer, hidden takes left out, look-alikes collapsed, reranked, each row with its
// album and cover. The browser searches songs and applies them; the Worker uses the album and cover
// rule when it looks a song up. Pure, so neither needs the other to test them.
import * as z from "zod/mini";
import type { CatalogSearchMatch } from "./api";
import {
  ArtistCredit,
  creditOf,
  dateKey,
  isStudio,
  mbid,
  namedIn,
  releaseGroupCoverRef,
  searchWordsOf,
  smallCoverOf,
  wordsOf,
  yearOfDate,
} from "./musicbrainz";
import { searchLanguage } from "./search-language";

// How many recordings a song search asks for: 25 lost two of the songs meant, and 100 found no
// more.
export const songSearchLimit = 50;

// Only the fields we use, so MusicBrainz adding or dropping others doesn't break us. A search
// leaves out a release group's secondary-types when there are none, and a lookup gives them as an
// empty list.
const ReleaseGroup = z.object({
  id: z.string().check(z.regex(mbid)),
  title: z.string(),
  "primary-type": z.nullish(z.string()),
  "secondary-types": z.nullish(z.array(z.string())),
});

type ReleaseGroup = z.infer<typeof ReleaseGroup>;

const Release = z.object({
  id: z.string(),
  status: z.nullish(z.string()),
  date: z.nullish(z.string()),
  "release-group": z.optional(ReleaseGroup),
});

type Release = z.infer<typeof Release>;

export const Recording = z.object({
  id: z.string().check(z.regex(mbid)),
  title: z.string(),
  "artist-credit": z.optional(ArtistCredit),
  disambiguation: z.nullish(z.string()),
  video: z.nullish(z.boolean()),
  "first-release-date": z.nullish(z.string()),
  releases: z.nullish(z.array(Release)),
});

export type Recording = z.infer<typeof Recording>;

// A recording search's answer, whose recordings are each read on their own.
const SearchAnswer = z.object({ recordings: z.array(z.unknown()) });

// How many releases a recording is on, by MBID: a search lists a release that has it twice twice.
function releasesOf(recording: Recording): number {
  return new Set((recording.releases ?? []).map((release) => release.id)).size;
}

// Whether a recording is hidden from Search: a video, one on no release, or one whose
// disambiguation starts with "live" or holds "karaoke", ignoring case. The query hides those it can
// match as words; this catches what it lets through, such as "livestream".
function isHidden(recording: Recording): boolean {
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
// word is left, and then no request is made.
export function recordingQuery(query: string): string | null {
  const words = searchWordsOf(query);
  if (words.length === 0) return null;
  const everyWord = words.map((word) => `(recording:${word} OR artist:${word})`).join(" AND ");
  const hidden = "NOT video:true AND NOT comment:live AND NOT comment:karaoke AND reid:*";
  const boosts =
    "secondarytype:compilation^5 secondarytype:soundtrack^5 primarytype:single^5 primarytype:album^5";
  return `+(${everyWord} AND ${hidden}) ${boosts}`;
}

// A plain release group: one with no secondary type.
function isPlain(group: ReleaseGroup): boolean {
  return (group["secondary-types"] ?? []).length === 0;
}

// The primary types a song's album and cover prefer, in this order, before any other.
const primaryTypeOrder = ["Album", "EP", "Single"];

// A release group's place in primaryTypeOrder, any other type after them.
function primaryTypeRank(group: ReleaseGroup): number {
  const rank = primaryTypeOrder.indexOf(group["primary-type"] ?? "");
  return rank === -1 ? primaryTypeOrder.length : rank;
}

// The release group a song's album and cover come from, among its Official releases: a studio one
// before the rest; then Album, EP, Single and any other type, a plain one before a soundtrack of
// the same type; then the earliest release, a missing month or day counting as the end of its
// period; then the release's MBID, so a tie is always broken alike. Null for a song on no Official
// release.
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
    Number(isPlain(b.group)) - Number(isPlain(a.group)) ||
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

// The words of a recording's artist credit, less "and", so a credit joined by "&" is one joined by
// "and".
function creditWordsOf(recording: Recording): string[] {
  return wordsOf(creditOf(recording["artist-credit"]) ?? "").filter((word) => word !== "and");
}

// The words of a title and of a recording's artist credit as one key: recordings with the same key
// are one row.
function rowKey(title: string, recording: Recording): string {
  return JSON.stringify([wordsOf(title), creditWordsOf(recording)]);
}

// Recordings with the same words in the title and in the artist credit, as one row each, in the
// order of each row's first recording. A row is represented by its recording on the most
// releases, then the one first released, then the first in MusicBrainz's order.
function collapsed(recordings: Recording[]): Row[] {
  const rows = new Map<string, Row>();
  for (const [order, recording] of recordings.entries()) {
    const key = rowKey(recording.title, recording);
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

// A part of a title in round, square or curly brackets at its start or its end: "(I’ve Had) …",
// "… (Remastered)", "… {MD122}".
const bracketedAtStart = /^\s*(\([^()]*\)|\[[^[\]]*\]|\{[^{}]*\})/;
const bracketedAtEnd = /(\([^()]*\)|\[[^[\]]*\]|\{[^{}]*\})\s*$/;

// A title without the bracketed part at its start, at its end, or both. A bracketed part in the
// middle is never left out.
function withoutBracketedParts(title: string): string[] {
  const withoutStart = title.replace(bracketedAtStart, "");
  const withoutEnd = title.replace(bracketedAtEnd, "");
  return [withoutStart, withoutEnd, withoutStart.replace(bracketedAtEnd, "")];
}

// The ways a query can name a title in full: as it is, then without its bracketed parts.
function titleVariants(title: string): string[] {
  return [title, ...withoutBracketedParts(title)];
}

// The rows less one-release takes: a row whose recording is on one release, and whose title
// without the bracketed part at its start, at its end or both, and credit, have the words of
// another row's on more releases ("Karma Police {MD122}" beside the studio "Karma Police"). A take
// with no such row beside it stays.
function withoutTakes(rows: Row[]): Row[] {
  const onMoreReleases = new Set(
    rows
      .filter((row) => releasesOf(row.recording) > 1)
      .map((row) => rowKey(row.recording.title, row.recording)),
  );
  return rows.filter(
    ({ recording }) =>
      releasesOf(recording) !== 1 ||
      !withoutBracketedParts(recording.title).some((title) =>
        onMoreReleases.has(rowKey(title, recording)),
      ),
  );
}

// How much of a song the query names: one for its title, with or without a bracketed part at its
// start or its end, and one for any of its credited artists in the words the title left, so a
// word counts for one of them, as for albums.
function namedByQuery(queryWords: Set<string>, recording: Recording): number {
  const title = titleVariants(recording.title)
    .map((variant) => namedIn(queryWords, variant))
    .find((words) => words !== null);
  const left = new Set([...queryWords].filter((word) => !title?.includes(word)));
  const artist = (recording["artist-credit"] ?? []).some((credit) => namedIn(left, credit.name));
  return (title ? 1 : 0) + (artist ? 1 : 0);
}

// The rows reranked: the songs whose title and artist the query names first, then those it names
// one of the two of; within each, more releases first, then MusicBrainz's order.
function ranked(query: string, rows: Row[]): Row[] {
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

// The search rows MusicBrainz's answer to the recording search for `query` makes, in their order,
// with covers under the Cover Art Archive's base URL. A recording of unknown shape is left out;
// an answer of unknown shape is null.
export function songSearchMatches(
  query: string,
  answer: unknown,
  coverArtArchiveBaseUrl: string,
): CatalogSearchMatch[] | null {
  const body = SearchAnswer.safeParse(answer);
  if (!body.success) return null;
  const recordings = body.data.recordings.flatMap((each) => {
    const recording = Recording.safeParse(each);
    return recording.success && !isHidden(recording.data) ? [recording.data] : [];
  });
  const titleLanguage = searchLanguage(query) === "uk-UA" ? "uk" : "en";
  return ranked(query, withoutTakes(collapsed(recordings))).map(({ recording }) => {
    const { album, cover } = albumAndCover(recording);
    return {
      externalReference: { source: "musicbrainz", mediaType: "song", id: recording.id },
      title: recording.title,
      originalTitle: recording.title,
      year: yearOfDate(recording["first-release-date"]),
      posterUrl: cover
        ? smallCoverOf(releaseGroupCoverRef(coverArtArchiveBaseUrl, cover.id))
        : null,
      titleLanguage,
      authors: [],
      artistCredit: creditOf(recording["artist-credit"]),
      album: album?.title ?? null,
      disambiguation: recording.disambiguation || null,
    };
  });
}
