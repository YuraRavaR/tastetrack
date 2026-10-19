// The TMDB adapter (ADR-0004): turns a search into one TMDB call and its response into catalog
// search results. Everything TMDB-shaped stays in this file.
import { z } from "zod";
import type { CatalogSearchResult } from "../../shared/api";
import { searchLanguage } from "./search-language";

export interface TmdbConfig {
  baseUrl: string;
  // TMDB's "API Read Access Token", sent as a bearer token.
  accessToken: string | undefined;
}

// TMDB didn't answer, or answered with anything but a usable 200.
export class TmdbUnavailable extends Error {}

// Poster thumbnails, at the smallest size TMDB serves: about two device pixels per CSS pixel at
// the size the results show them.
const posterBaseUrl = "https://image.tmdb.org/t/p/w92";

// Only the fields we use, so TMDB adding or dropping others doesn't break search.
const TmdbSearchResponse = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      title: z.string().optional(),
      original_title: z.string(),
      release_date: z.string().optional(),
      poster_path: z.string().nullable().optional(),
    }),
  ),
});

type TmdbFilm = z.infer<typeof TmdbSearchResponse>["results"][number];

function toResult(film: TmdbFilm): CatalogSearchResult {
  const year = Number.parseInt(film.release_date?.slice(0, 4) ?? "", 10);
  return {
    externalReference: { source: "tmdb", mediaType: "film", id: String(film.id) },
    // TMDB has no language fallback, so a missing translation can come back empty.
    title: film.title?.trim() || film.original_title,
    originalTitle: film.original_title,
    year: Number.isNaN(year) ? null : year,
    posterUrl: film.poster_path ? `${posterBaseUrl}${film.poster_path}` : null,
  };
}

// The first page of TMDB's matches, in TMDB's order, titled in the query's language.
export async function searchFilms(
  config: TmdbConfig,
  query: string,
): Promise<CatalogSearchResult[]> {
  if (!config.accessToken) throw new TmdbUnavailable("TMDB_ACCESS_TOKEN is not set");
  const url = new URL(`${config.baseUrl}/search/movie`);
  url.search = new URLSearchParams({
    query,
    language: searchLanguage(query),
    include_adult: "false",
    page: "1",
  }).toString();

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${config.accessToken}`, Accept: "application/json" },
    });
  } catch (error) {
    throw new TmdbUnavailable("TMDB search failed", { cause: error });
  }
  if (!response.ok) throw new TmdbUnavailable(`TMDB search answered ${response.status}`);
  const body = TmdbSearchResponse.safeParse(await response.json().catch(() => undefined));
  if (!body.success) throw new TmdbUnavailable("TMDB search answered in an unknown shape");
  return body.data.results.map(toResult);
}
