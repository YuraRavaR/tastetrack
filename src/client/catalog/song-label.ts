import type { SongMetadata } from "../../shared/api";
import { t } from "../i18n/t";
import { factsLine } from "./game-label";

type SongFacts = Pick<SongMetadata, "year" | "artistCredit" | "album">;

function yearOf(year: number | null): string | null {
  return year === null ? null : String(year);
}

// "from Земля", the studio Album a song is from; null when it is on none (ADR-0013). Its title is
// text, never a link (`docs/mockups/songs/`).
function fromAlbum(album: string | null): string | null {
  return album === null ? null : t("song.fromAlbum", { album });
}

// What a song's Search row says under its title: its artist credit, the year of its first release
// and the album it is from, "Океан Ельзи · 2013 · from Земля", leaving out whichever is unknown or
// none. Null when none of it is known.
export function artistYearAndAlbum(song: SongFacts): string | null {
  return factsLine([song.artistCredit, yearOf(song.year), fromAlbum(song.album)]);
}

// What a song's page says under its title: the year first, "2013 · Океан Ельзи · from Земля",
// since its title has none, leaving out whichever is unknown or none. Null when none of it is known.
export function songFacts(song: SongFacts): string | null {
  return factsLine([yearOf(song.year), song.artistCredit, fromAlbum(song.album)]);
}
