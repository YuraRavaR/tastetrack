import type { AlbumMetadata } from "../../shared/api";
import { factsLine } from "./game-label";

type AlbumTypes = {
  primaryType: AlbumMetadata["primaryType"];
  secondaryTypes: readonly string[];
};
type AlbumFacts = Pick<AlbumMetadata, "year" | "artistCredit"> & AlbumTypes;

// What an album is when it isn't a plain studio album, as MusicBrainz names it: "EP", "Live",
// "Remix", and every type it has, in MusicBrainz's order, "Compilation, Soundtrack". Null for a
// plain album, or where unknown (ADR-0013).
export function albumType({ primaryType, secondaryTypes }: AlbumTypes): string | null {
  const types = [...(primaryType === "EP" ? ["EP"] : []), ...secondaryTypes];
  return types.length > 0 ? types.join(", ") : null;
}

function yearOf(year: number | null): string | null {
  return year === null ? null : String(year);
}

// What an album's Search row says under its title: its artist credit, the year of its first
// release and its type, "The Beatles · 2012 · Remix", leaving out whichever is unknown or none. Null
// when none of it is known.
export function artistYearAndType(album: AlbumFacts): string | null {
  return factsLine([album.artistCredit, yearOf(album.year), albumType(album)]);
}

// What an album's page says under its title: the year first, "2016 · Jamala · EP", since its title
// has none, leaving out whichever is unknown or none. Null when none of it is known.
export function albumFacts(album: AlbumFacts): string | null {
  return factsLine([yearOf(album.year), album.artistCredit, albumType(album)]);
}
