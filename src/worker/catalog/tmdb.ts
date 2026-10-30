// The TMDB adapter (ADR-0004): turns a search or a film's details into one TMDB call each, and
// TMDB's responses into catalog values. Everything TMDB-shaped stays in this file.
import { z } from "zod";
import type { CatalogSearchResult, FilmMetadata } from "../../shared/api";
import { searchLanguage } from "./search-language";

export interface TmdbConfig {
  baseUrl: string;
  // TMDB's "API Read Access Token", sent as a bearer token.
  accessToken: string | undefined;
}

// TMDB didn't answer, or answered with anything but a usable 200.
export class TmdbUnavailable extends Error {}

const imageBaseUrl = "https://image.tmdb.org/t/p";

// Poster thumbnails, at the smallest size TMDB serves: about two device pixels per CSS pixel at a
// thumbnail's size. A film's banner shows one larger, and softer, when the film has no backdrop.
const posterBaseUrl = `${imageBaseUrl}/w92`;

export function posterUrl(posterPath: string | null): string | null {
  return posterPath ? `${posterBaseUrl}${posterPath}` : null;
}

// The poster path back out of a poster URL this adapter made, or null for any other URL, so a
// client can't make the app show images from elsewhere.
export function posterPathOf(url: string | null): string | null {
  const match = url && /^https:\/\/image\.tmdb\.org\/t\/p\/w92(\/[\w-]+\.\w+)$/.exec(url);
  return match ? (match[1] ?? null) : null;
}

// Backdrops, wide enough for a phone's banner and for a larger screen's. TMDB serves no size
// between them.
export function backdropUrls(backdropPath: string | null): FilmMetadata["backdropUrls"] {
  if (!backdropPath) return null;
  return {
    small: `${imageBaseUrl}/w780${backdropPath}`,
    large: `${imageBaseUrl}/w1280${backdropPath}`,
  };
}

// A search result before what the app holds about it, its Media Item and the User's Log and
// Backlog, is added to it.
export type CatalogSearchMatch = Omit<CatalogSearchResult, "mediaItemId" | "inLog" | "inBacklog">;

// Only the fields we use, so TMDB adding or dropping others doesn't break us.
const TmdbFilm = z.object({
  id: z.number(),
  title: z.string().optional(),
  original_title: z.string(),
  release_date: z.string().optional(),
  poster_path: z.string().nullable().optional(),
});

type TmdbFilm = z.infer<typeof TmdbFilm>;

const TmdbSearchResponse = z.object({ results: z.array(TmdbFilm) });

const TmdbDetailsResponse = TmdbFilm.extend({
  backdrop_path: z.string().nullable().optional(),
  runtime: z.number().nullable().optional(),
  genres: z.array(z.object({ name: z.string() })).optional(),
  translations: z
    .object({
      translations: z.array(
        z.object({
          iso_639_1: z.string(),
          data: z.object({ title: z.string().optional() }).optional(),
        }),
      ),
    })
    .optional(),
});

function yearOf(film: TmdbFilm): number | null {
  const year = Number.parseInt(film.release_date?.slice(0, 4) ?? "", 10);
  return Number.isNaN(year) ? null : year;
}

// TMDB titles a film it has no translation for with its Original Title; an empty or missing
// title is treated the same way, in case that ever changes.
function titleOf(film: TmdbFilm): string {
  return film.title?.trim() || film.original_title;
}

async function get(config: TmdbConfig, path: string, params: Record<string, string>) {
  if (!config.accessToken) throw new TmdbUnavailable("TMDB_ACCESS_TOKEN is not set");
  const url = new URL(`${config.baseUrl}${path}`);
  url.search = new URLSearchParams(params).toString();
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${config.accessToken}`, Accept: "application/json" },
    });
  } catch (error) {
    throw new TmdbUnavailable(`TMDB ${path} failed`, { cause: error });
  }
  if (!response.ok) throw new TmdbUnavailable(`TMDB ${path} answered ${response.status}`);
  return response.json().catch(() => undefined);
}

// The first page of TMDB's matches, in TMDB's order, titled in the query's language.
export async function searchFilms(
  config: TmdbConfig,
  query: string,
): Promise<CatalogSearchMatch[]> {
  const language = searchLanguage(query);
  const body = TmdbSearchResponse.safeParse(
    await get(config, "/search/movie", { query, language, include_adult: "false", page: "1" }),
  );
  if (!body.success) throw new TmdbUnavailable("TMDB search answered in an unknown shape");
  return body.data.results.map((film) => ({
    externalReference: { source: "tmdb", mediaType: "film", id: String(film.id) },
    title: titleOf(film),
    originalTitle: film.original_title,
    year: yearOf(film),
    posterUrl: posterUrl(film.poster_path ?? null),
    titleLanguage: language === "uk-UA" ? "uk" : "en",
  }));
}

// What the cache keeps about a film. A title is null when TMDB has none in that language.
export interface FilmDetails {
  englishTitle: string | null;
  ukrainianTitle: string | null;
  originalTitle: string;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  // Null when unknown; genres are empty when unknown.
  runtime: number | null;
  genres: string[];
}

// One call for both titles, the images, the runtime and the genres: the details in English with
// the film's translations appended. Unlike `title`, the translations list never falls back to
// another language, so it alone says whether a Ukrainian title exists; an empty one counts as none.
export async function filmDetails(config: TmdbConfig, id: string): Promise<FilmDetails> {
  const body = TmdbDetailsResponse.safeParse(
    await get(config, `/movie/${encodeURIComponent(id)}`, {
      language: "en-US",
      append_to_response: "translations",
    }),
  );
  if (!body.success) throw new TmdbUnavailable("TMDB details answered in an unknown shape");
  const film = body.data;
  const ukrainian = film.translations?.translations.find((t) => t.iso_639_1 === "uk");
  return {
    englishTitle: titleOf(film),
    ukrainianTitle: ukrainian?.data?.title?.trim() || null,
    originalTitle: film.original_title,
    year: yearOf(film),
    posterPath: film.poster_path ?? null,
    backdropPath: film.backdrop_path ?? null,
    // TMDB says 0 for a runtime it doesn't know.
    runtime: film.runtime || null,
    genres: film.genres?.map((genre) => genre.name) ?? [],
  };
}
