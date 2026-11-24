// The MusicBrainz catalog source of songs (ADR-0013, Songs): a song is a recording, one across every
// release it is on, and a song's details are one MusicBrainz request, through the albums' queue,
// User-Agent and retry (./musicbrainz.ts). Its cover is the Cover Art Archive's front cover of a
// release group the recording is on, linked and never fetched. The browser searches songs, with the
// rules in src/shared/musicbrainz-songs.ts, so this source has no search.
import type { SongCacheExtra } from "../../../db/schema";
import { creditOf, mbid, yearOfDate } from "../../../shared/musicbrainz";
import { albumAndCover, Recording } from "../../../shared/musicbrainz-songs";
import {
  type CatalogEntry,
  type CatalogEnv,
  type CatalogSource,
  SourceUnavailable,
  shownTitles,
} from "../source";
import {
  classifyFailure,
  coverRefFor,
  coverRefOf,
  coverUrls,
  creditedArtists,
  lookUp,
  musicBrainzRefreshShare,
} from "./musicbrainz";

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
    creditedArtists: entry.extra.artists,
    album: entry.extra.album?.title ?? null,
    disambiguation: entry.extra.disambiguation,
    url: entry.extra.url,
  }),
  // A song has no About block.
  aboutOf: () => null,
};
