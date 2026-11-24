// The MusicBrainz catalog source of artists (ADR-0013, Artists): an artist is a MusicBrainz artist
// of any type. A search is one artist search, and an artist's details are a lookup and a
// release-group search for their albums list, through the albums' queue, User-Agent and retry
// (./musicbrainz.ts), then their photo from Wikidata and Wikimedia Commons (./wikimedia.ts). The
// search, hiding, facts and albums rules are in src/shared/musicbrainz-artists.ts.
import type { ArtistCacheExtra } from "../../../db/schema";
import type { CoverUrls } from "../../../shared/api";
import { mbid } from "../../../shared/musicbrainz";
import {
  Artist,
  artistAlbums,
  artistAlbumsLimit,
  artistAlbumsQuery,
  artistFacts,
  artistQuery,
  artistSearchLimit,
  artistSearchMatches,
} from "../../../shared/musicbrainz-artists";
import {
  type CatalogEntry,
  type CatalogEnv,
  type CatalogSearchMatch,
  type CatalogSource,
  SourceUnavailable,
  shownTitles,
} from "../source";
import {
  bodyOf,
  classifyFailure,
  coverRefFor,
  coversOf,
  get,
  lookUp,
  musicBrainzRefreshShare,
} from "./musicbrainz";
import { filePathOf, readPhoto, WikimediaUnavailable, wikidataIdOf } from "./wikimedia";

const day = 24 * 60 * 60 * 1000;

// How long an artist's entry is kept, and a photo kept through failed refreshes after it was read:
// Commons files are deleted, renamed and relicensed, and an active artist's albums list grows.
const maxAge = 30 * day;

// An artist's page on MusicBrainz.
function pageOf(id: string): string {
  return `https://musicbrainz.org/artist/${id}`;
}

// The first page of the artist search, less the special-purpose artists, in MusicBrainz's order. A
// query with no word left finds nothing, without a request.
async function searchArtists(env: CatalogEnv, query: string): Promise<CatalogSearchMatch[]> {
  const words = artistQuery(query);
  if (words === null) return [];
  const path = "/artist/";
  const answer = await get(env, path, { query: words, limit: String(artistSearchLimit) });
  const matches = artistSearchMatches(query, bodyOf(path, answer));
  if (!matches) {
    throw new SourceUnavailable("MusicBrainz search answered in an unknown shape", "temporary");
  }
  return matches;
}

// The artist's albums list, by one release-group search. A busy search fails the add or refresh
// as a busy lookup does.
async function albumsOf(env: CatalogEnv, artistId: string): Promise<ArtistCacheExtra["albums"]> {
  const path = "/release-group/";
  const answer = await get(env, path, {
    query: artistAlbumsQuery(artistId),
    limit: String(artistAlbumsLimit),
  });
  const albums = artistAlbums(bodyOf(path, answer));
  if (!albums) {
    throw new SourceUnavailable(
      "MusicBrainz's albums list answered in an unknown shape",
      "temporary",
    );
  }
  return albums.map((album) => ({ ...album, coverRef: coverRefFor(env, album.mbid) }));
}

// The artist's photo, read now from Wikimedia: none without a Wikidata ID, a P18 image or the file
// on Commons. When a Wikimedia call fails it is the photo the entry being refreshed had, if that
// was read within the maximum age, and none otherwise; the failure is logged, and never fails the
// details call.
async function photoOf(
  env: CatalogEnv,
  wikidataId: string | null,
  now: Date,
  previous: CatalogEntry<"artist"> | undefined,
): Promise<ArtistCacheExtra["photo"]> {
  if (wikidataId === null) return null;
  try {
    const photo = await readPhoto(env, wikidataId);
    return photo && { ...photo, readAt: now.toISOString() };
  } catch (error) {
    if (!(error instanceof WikimediaUnavailable)) throw error;
    console.error(error);
    const kept = previous?.extra.photo;
    return kept && now.getTime() - Date.parse(kept.readAt) <= maxAge ? kept : null;
  }
}

// An artist's entry: their lookup with URL relations, the albums list of the MBID it answered with,
// then their photo. Their name, in its original script, is their Original Title, and they have no
// Localized Title in any language.
async function artistDetails(
  env: CatalogEnv,
  id: string,
  now: Date,
  previous?: CatalogEntry<"artist">,
): Promise<CatalogEntry<"artist">> {
  if (!mbid.test(id)) throw new SourceUnavailable(`MusicBrainz has no artist ${id}`, "gone");
  const artist = Artist.safeParse(await lookUp(env, "artist", id, { inc: "url-rels" }));
  if (!artist.success) {
    throw new SourceUnavailable("MusicBrainz's artist answered in an unknown shape", "temporary");
  }
  const found = artist.data;
  const albums = await albumsOf(env, found.id);
  const wikidataId = wikidataIdOf(found.relations);
  const photo = await photoOf(env, wikidataId, now, previous);
  const { year, ...facts } = artistFacts(found);
  return {
    englishTitle: null,
    ukrainianTitle: null,
    originalTitle: found.name,
    year,
    coverRef: photo && filePathOf(env, photo.file),
    extra: { ...facts, url: pageOf(found.id), wikidataId, photo, albums },
  };
}

// A photo in a width for a thumbnail and one for the artist's page, as Commons' standard
// thumbnail sizes.
function photoUrls(coverRef: string | null): CoverUrls | null {
  if (!coverRef) return null;
  return { small: `${coverRef}?width=250`, large: `${coverRef}?width=500` };
}

const emptyExtra: ArtistCacheExtra = {
  artistType: null,
  country: null,
  endYear: null,
  disambiguation: null,
  url: null,
  wikidataId: null,
  photo: null,
  albums: null,
};

// MusicBrainz's artists, kept at most 30 days. Each costs the cron two MusicBrainz calls, three for
// a merged one, which MusicBrainz's share counts with the albums' and songs', and up to two
// Wikimedia ones, which only the run's budget counts.
export const musicBrainzArtists: CatalogSource<"artist"> = {
  externalSource: "musicbrainz",
  mediaType: "artist",
  refreshCost: 4,
  refreshShareCost: 2,
  refreshShare: musicBrainzRefreshShare,
  maxEntryAge: maxAge,
  refreshesFromPrevious: true,
  search: searchArtists,
  details: artistDetails,
  // A search row has no photo.
  coverRefOf: () => null,
  emptyExtra,
  coverUrls: photoUrls,
  classifyFailure,
  metadataOf: (entry) => ({
    ...shownTitles(entry),
    ukrainianTitle: null,
    year: entry.year,
    endYear: entry.extra.endYear,
    artistType: entry.extra.artistType,
    country: entry.extra.country,
    disambiguation: entry.extra.disambiguation,
    photoUrls: photoUrls(entry.coverRef),
    photoCredit: entry.extra.photo && {
      author: entry.extra.photo.author,
      licence: entry.extra.photo.licence,
      url: entry.extra.photo.url,
    },
    url: entry.extra.url,
  }),
  // An artist has no About block; their page shows their albums list, once their details are in.
  aboutOf: (entry) =>
    entry.extra.albums && {
      mediaType: "artist",
      albums: entry.extra.albums.map(({ coverRef, ...album }) => ({
        ...album,
        coverUrls: coversOf(coverRef),
      })),
    },
};
