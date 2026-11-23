// What MusicBrainz's albums and songs share, as pure rules (ADR-0013): the shape of an MBID and an
// artist credit, a query's words and Lucene escaping, and covers by release group. Both the Worker,
// which searches albums and looks albums and songs up, and the browser, which searches songs, use
// them. Zod Mini, so the client bundle stays small.
import * as z from "zod/mini";

// A MusicBrainz identifier, as it writes them: a lowercase UUID.
export const mbidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export const mbid = new RegExp(`^${mbidPattern}$`);

// Only the fields we use, so MusicBrainz adding or dropping others doesn't break us.
export const ArtistCredit = z.array(
  z.object({
    name: z.string(),
    joinphrase: z.nullish(z.string()),
    artist: z.object({ id: z.string() }),
  }),
);

export type ArtistCredit = z.infer<typeof ArtistCredit>;

// The artist credit as MusicBrainz shows it: each credited name followed by its join phrase.
export function creditOf(credits: ArtistCredit | null | undefined): string | null {
  const credit = (credits ?? [])
    .map((artist) => artist.name + (artist.joinphrase ?? ""))
    .join("")
    .trim();
  return credit || null;
}

// The words of a query or a name, to compare them: lowercased, without accents, apostrophes or
// punctuation, so "Pink Floyd’s" is one word, "floyds".
export function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/['’`]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

// The words a name's match ignores.
const articles = new Set(["the", "a", "an"]);

// The words of a name the query holds, its articles aside, if it holds every one: "The Beatles" is
// in "abbey road beatles", and "The Dark Side of the Moon" in "pink floyd dark side of the moon".
// Null if the query lacks any.
export function namedIn(queryWords: Set<string>, name: string): string[] | null {
  const words = wordsOf(name);
  const significant = words.filter((word) => !articles.has(word));
  const asked = significant.length > 0 ? significant : words;
  return asked.length > 0 && asked.every((word) => queryWords.has(word)) ? asked : null;
}

// The year of a date MusicBrainz writes as YYYY, YYYY-MM or YYYY-MM-DD.
export function yearOfDate(date: string | null | undefined): number | null {
  const year = /^(\d{4})/.exec(date ?? "")?.[1];
  return year ? Number(year) : null;
}

// Lucene's special characters, which a query would otherwise use as its syntax.
export function escaped(query: string): string {
  return query.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, (char) => `\\${char}`);
}

// A release group's address on the Cover Art Archive, under its base URL, which answers with the
// front cover in the size asked for, or 404 when it has none.
export function releaseGroupCoverRef(coverArtArchiveBaseUrl: string, id: string): string {
  return `${coverArtArchiveBaseUrl}/release-group/${id}`;
}

// A cover's thumbnail, 250 pixels square, from its reference.
export function smallCoverOf(coverRef: string): string {
  return `${coverRef}/front-250`;
}
