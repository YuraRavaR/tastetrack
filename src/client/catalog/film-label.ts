import { t } from "../i18n/t";

export interface Titled {
  title: string;
  originalTitle: string;
  year: number | null;
}

// The title, then in brackets the Original Title when it differs and the year when known:
// "Alien (1979)", "Чужий (Alien, 1979)".
export function filmLabel({ title, originalTitle, year }: Titled): string {
  const showOriginal = originalTitle !== title;
  if (showOriginal && year !== null) {
    return t("film.labelWithOriginalAndYear", { title, originalTitle, year: String(year) });
  }
  if (showOriginal) return t("film.labelWithOriginal", { title, originalTitle });
  if (year !== null) return t("film.labelWithYear", { title, year: String(year) });
  return title;
}

export interface Described {
  runtime: number | null;
  genres: string[];
}

// The runtime and genres, leaving out whichever is unknown: "122 min · Comedy, Romance". Null when
// neither is known.
export function filmFacts({ runtime, genres }: Described): string | null {
  const genreList = genres.join(", ");
  if (runtime === null) return genreList || null;
  const minutes = t("film.runtime", { minutes: runtime });
  return genreList ? t("film.runtimeAndGenres", { runtime: minutes, genres: genreList }) : minutes;
}
