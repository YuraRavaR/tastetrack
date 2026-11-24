// What the app says of an artist (`docs/mockups/artists/`). Pure functions with no I/O.
import type { AlbumMetadata, ArtistMetadata } from "../../shared/api";
import { artistYears, specialPurposeArtists } from "../../shared/musicbrainz-artists";
import { type MessageId, t } from "../i18n/t";
import { factsLine } from "./game-label";

// What stands in for an artist's photo: the first letter of each of their first two words, upper
// case, "ІД" for Ігор Діденчук and "K" for KALUSH. Marks that are no letter or digit don't count.
export function artistInitials(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toLocaleUpperCase() ?? "")
    .join("");
}

// The codes MusicBrainz gives areas of its own, by the catalogue's name for each.
const musicBrainzAreas: Record<string, MessageId> = {
  XW: "artist.country.XW",
  XE: "artist.country.XE",
  SU: "artist.country.SU",
  XC: "artist.country.XC",
  XG: "artist.country.XG",
  YU: "artist.country.YU",
  CS: "artist.country.CS",
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

// A country by its name, "Ukraine" for MusicBrainz's UA; a code no one names stays a code.
function countryName(code: string): string {
  const own = musicBrainzAreas[code];
  if (own) return t(own);
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

type ArtistFactsOf = Pick<ArtistMetadata, "artistType" | "country" | "year" | "endYear">;

// What an artist's row and page say under their name: their type, their country and their years,
// "Group · Ukraine · 1994–", leaving out whichever MusicBrainz doesn't know. Null when it knows
// none of it.
export function artistFacts(artist: ArtistFactsOf): string | null {
  return factsLine([
    artist.artistType,
    artist.country === null ? null : countryName(artist.country),
    artistYears(artist.year, artist.endYear),
  ]);
}

type PhotoCredit = NonNullable<ArtistMetadata["photoCredit"]>;

// The line under an artist's photo, "Photo: Alexander Khanin · CC BY-SA 4.0 · Wikimedia Commons",
// without the author when Commons names none.
export function photoCredit({ author, licence }: PhotoCredit): string {
  return author === null
    ? t("artist.photoCreditNoAuthor", { licence })
    : t("artist.photoCredit", { author, licence });
}

// One part of an artist credit: a credited artist's name with their MBID, or text with none, as a
// joining phrase (", ", " feat. ") or an artist with no page.
export interface CreditPart {
  text: string;
  mbid: string | null;
}

// An album's or a song's artist credit, "Bedouin, DakhaBrakha", in parts, each credited artist by
// their MBID, so that a page links each to the artist's page and keeps the joining phrases text.
// The credited names are found in the credit in its order. A special-purpose artist, such as
// Various Artists, has no page, and a name the credit doesn't hold where its list says stays text,
// as does the rest of the credit after it. None for no credit.
export function creditParts(
  artistCredit: string | null,
  creditedArtists: AlbumMetadata["creditedArtists"],
): CreditPart[] {
  if (artistCredit === null) return [];
  const parts: CreditPart[] = [];
  const text = (part: string) => {
    if (!part) return;
    const last = parts.at(-1);
    if (last && last.mbid === null) last.text += part;
    else parts.push({ text: part, mbid: null });
  };
  let rest = artistCredit;
  for (const { name, mbid } of creditedArtists) {
    const at = rest.indexOf(name);
    if (at === -1) break;
    text(rest.slice(0, at));
    if (specialPurposeArtists.has(mbid)) text(name);
    else parts.push({ text: name, mbid });
    rest = rest.slice(at + name.length);
  }
  text(rest);
  return parts;
}
