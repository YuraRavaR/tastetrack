// What the app says of an artist (`docs/mockups/artists/`). Pure functions with no I/O.
import type { AlbumMetadata, ArtistMetadata } from "../../shared/api";
import { artistYears, specialPurposeArtists } from "../../shared/musicbrainz-artists";
import { t } from "../i18n/t";
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

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

// A country by its name, "Ukraine" for MusicBrainz's UA; null for a code that names no country, as
// MusicBrainz's XW (worldwide) or XE (Europe), which Intl gives back as it is, and SU, the Soviet
// Union, which Intl names Russia (ADR-0013, Artists).
function countryName(code: string): string | null {
  if (code === "SU") return null;
  try {
    const name = regionNames.of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
}

type ArtistFactsOf = Pick<ArtistMetadata, "artistType" | "country" | "year" | "endYear">;

// What an artist's row and page say under their name: their type, their country and their years,
// "Group · Ukraine · 1994–", leaving out whichever MusicBrainz doesn't know and a code that names
// no country. Null when none of it is known.
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
