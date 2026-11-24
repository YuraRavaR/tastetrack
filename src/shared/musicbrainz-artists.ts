// Artist search's rules and an artist's facts (ADR-0013, Artists): the artist search's query, the
// special-purpose artists it hides, what a search row and a lookup say of an artist, and which of
// their release groups their albums list keeps, in what order. The Worker searches artists and
// looks them up with these; they are pure, and here, so that the client can format the years and
// search could move to the browser as song search did.
import * as z from "zod/mini";
import type { CatalogSearchMatch } from "./api";
import { dateKey, isStudio, mbid, searchWordsOf, yearOfDate } from "./musicbrainz";
import { searchLanguage } from "./search-language";

// How many artists a search asks for.
export const artistSearchLimit = 25;

// MusicBrainz's special-purpose artists, by MBID, which Search never shows: Various Artists, the
// bracketed ones such as [unknown], and its test artist. Nothing but the MBID tells them from real
// artists: five real artists are named "Various Artists" (docs/research/music-metadata-sources.md).
export const specialPurposeArtists: ReadonlySet<string> = new Set([
  // Various Artists
  "89ad4ac3-39f7-470e-963a-56509c546377",
  // [unknown]
  "125ec42a-7229-4250-afc5-e057484327fe",
  // [anonymous]
  "f731ccc4-e22a-43af-a747-64213329e088",
  // [traditional]
  "9be7f096-97ec-4615-8957-8d40b5dcbc41",
  // [no artist]
  "eec63d3c-3b81-4ad4-b1e4-7c147d4d2b61",
  // [data]
  "33cf029c-63b0-41a0-9855-be2a3665fb3b",
  // [dialogue]
  "314e1c25-dde7-4e4d-b2f4-0a7b9f7c56dc",
  // [language instruction]
  "80a8851f-444c-4539-892b-ad2a49292aa9",
  // [theatre]
  "a0ef7e1d-44ff-4039-9435-7d5fefdeecc9",
  // [Disney]
  "66ea0139-149f-4a0c-8fbf-5ea9ec4a6e49",
  // [church chimes]
  "90068d37-bae7-4292-be4a-704c145bd616",
  // [unknown animal]
  "459a4aa6-b6b7-4c89-a42b-03acddbe1f80",
  // MusicBrainz Test Artist
  "7e84f845-ac16-41fe-9ff8-df12eb32af55",
]);

// An artist search's query: every word of the User's, joined by AND. Null when no word is left,
// and then no request is made.
export function artistQuery(query: string): string | null {
  const words = searchWordsOf(query);
  return words.length > 0 ? words.join(" AND ") : null;
}

// Only the fields we use, so MusicBrainz adding or dropping others doesn't break us. A search row
// leaves out what it has none of; a lookup gives an empty disambiguation and null dates.
export const Artist = z.object({
  id: z.string().check(z.regex(mbid)),
  name: z.string(),
  type: z.nullish(z.string()),
  country: z.nullish(z.string()),
  "life-span": z.nullish(
    z.object({
      begin: z.nullish(z.string()),
      end: z.nullish(z.string()),
    }),
  ),
  disambiguation: z.nullish(z.string()),
  relations: z.nullish(
    z.array(
      z.object({
        type: z.string(),
        url: z.optional(z.object({ resource: z.string() })),
      }),
    ),
  ),
});

export type Artist = z.infer<typeof Artist>;

// An artist search's answer, whose artists are each read on their own.
const SearchAnswer = z.object({ artists: z.array(z.unknown()) });

// What a search row and a lookup alike say of an artist.
export interface ArtistFacts {
  // MusicBrainz's type, as it gives it, or null.
  artistType: string | null;
  // An ISO 3166-1 code, such as UA or XW (worldwide), set even where the area is a city; null for
  // none, or anything else.
  country: string | null;
  // The begin year, and the end year when MusicBrainz has one: a person's years of birth and
  // death. Without a begin year, neither.
  year: number | null;
  endYear: number | null;
  disambiguation: string | null;
}

// An artist's facts from their search row or lookup.
export function artistFacts(artist: Artist): ArtistFacts {
  const year = yearOfDate(artist["life-span"]?.begin);
  const country = artist.country ?? "";
  return {
    artistType: artist.type || null,
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    year,
    endYear: year === null ? null : yearOfDate(artist["life-span"]?.end),
    disambiguation: artist.disambiguation || null,
  };
}

// An artist's years as the app shows them: the begin year and a dash ("1994–"), with the end year
// after it when there is one ("1994–2015"). An artist MusicBrainz marks as ended with no end date
// shows only the dash, which says no more than MusicBrainz knows. Null with no begin year.
export function artistYears(year: number | null, endYear: number | null): string | null {
  return year === null ? null : `${year}–${endYear ?? ""}`;
}

// The search rows MusicBrainz's answer to the artist search for `query` makes, in MusicBrainz's
// order, which already ranks the artist meant first, less the special-purpose artists. Each is
// named in its original script, with no photo. An artist of unknown shape is left out; an answer of
// unknown shape is null.
export function artistSearchMatches(query: string, answer: unknown): CatalogSearchMatch[] | null {
  const body = SearchAnswer.safeParse(answer);
  if (!body.success) return null;
  const titleLanguage = searchLanguage(query) === "uk-UA" ? "uk" : "en";
  return body.data.artists.flatMap((each) => {
    const parsed = Artist.safeParse(each);
    if (!parsed.success || specialPurposeArtists.has(parsed.data.id)) return [];
    const artist = parsed.data;
    const { year, ...facts } = artistFacts(artist);
    return [
      {
        externalReference: { source: "musicbrainz", mediaType: "artist", id: artist.id },
        title: artist.name,
        originalTitle: artist.name,
        year,
        posterUrl: null,
        titleLanguage,
        authors: [],
        ...facts,
      },
    ];
  });
}

// How many release groups an albums list holds at most.
export const artistAlbumsLimit = 100;

// Every secondary type but Soundtrack, which an albums list leaves out: a studio album has none, or
// Soundtrack alone.
const nonStudioSecondaryTypes = [
  "compilation",
  "live",
  "remix",
  "dj-mix",
  "mixtape/street",
  "demo",
  "interview",
  "spokenword",
  "audiobook",
  "audio drama",
  "field recording",
];

// The release-group search for an artist's albums list: their Albums and EPs with no secondary type
// but Soundtrack, with at least one Official release. The search filters before the limit, as a
// browse wouldn't, so the first 100 are studio albums, and the Beatles' A Hard Day's Night is among
// them.
export function artistAlbumsQuery(artistId: string): string {
  const others = nonStudioSecondaryTypes.map((type) => `secondarytype:"${type}"`).join(" OR ");
  return (
    `arid:${artistId} AND (primarytype:album OR primarytype:ep) AND NOT (${others}) ` +
    "AND status:official"
  );
}

// Only the fields we use of a release group in a search's answer.
const AlbumRow = z.object({
  id: z.string().check(z.regex(mbid)),
  title: z.string(),
  "first-release-date": z.nullish(z.string()),
  "primary-type": z.nullish(z.string()),
  "secondary-types": z.nullish(z.array(z.string())),
});

const AlbumsAnswer = z.object({ "release-groups": z.array(z.unknown()) });

// One album of an artist's albums list.
export interface ArtistAlbum {
  mbid: string;
  title: string;
  year: number | null;
  primaryType: "Album" | "EP";
}

// The albums list of MusicBrainz's answer to artistAlbumsQuery: the studio Albums and EPs, the
// type rule applied again to what came back, oldest first by first release, a missing date last,
// then by title. A release group of unknown shape is left out; an answer of unknown shape is null.
export function artistAlbums(answer: unknown): ArtistAlbum[] | null {
  const body = AlbumsAnswer.safeParse(answer);
  if (!body.success) return null;
  const rows = body.data["release-groups"].flatMap((each) => {
    const row = AlbumRow.safeParse(each);
    if (!row.success || !isStudio(row.data)) return [];
    const primaryType = row.data["primary-type"];
    if (primaryType !== "Album" && primaryType !== "EP") return [];
    return [{ row: row.data, primaryType }] as const;
  });
  // Date keys compare by code point: a locale's collation puts "~", no date, before digits.
  const byDate = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return rows
    .sort(
      (a, b) =>
        byDate(dateKey(a.row["first-release-date"]), dateKey(b.row["first-release-date"])) ||
        a.row.title.localeCompare(b.row.title),
    )
    .map(({ row, primaryType }) => ({
      mbid: row.id,
      title: row.title,
      year: yearOfDate(row["first-release-date"]),
      primaryType,
    }));
}
