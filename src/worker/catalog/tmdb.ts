// The TMDB catalog source (ADR-0004): turns a search or a film's details into one TMDB call each,
// and TMDB's responses into catalog values. Everything TMDB-shaped stays in this file.
import { z } from "zod";
import type { FilmCacheExtra } from "../../db/schema";
import type { CoverUrls, FilmMetadata } from "../../shared/api";
import { searchLanguage } from "./search-language";
import {
  type CatalogEntry,
  type CatalogEnv,
  type CatalogSearchMatch,
  type CatalogSource,
  type SourceFailure,
  SourceUnavailable,
  shownTitles,
} from "./source";

const imageBaseUrl = "https://image.tmdb.org/t/p";

// Poster thumbnails, at the smallest size TMDB serves: about two device pixels per CSS pixel at a
// thumbnail's size. Search results come in this size only.
const posterBaseUrl = `${imageBaseUrl}/w92`;

function posterUrl(posterPath: string | null): string | null {
  return posterPath ? `${posterBaseUrl}${posterPath}` : null;
}

// Posters as a thumbnail and as large as a poster grid draws them: the widest cell, two columns on
// a phone, is about 160 CSS pixels, some 480 device pixels on a 3x screen.
function posterUrls(posterPath: string | null): CoverUrls | null {
  if (!posterPath) return null;
  return { small: `${posterBaseUrl}${posterPath}`, large: `${imageBaseUrl}/w500${posterPath}` };
}

// The poster path back out of a poster URL this module made, or null for any other URL.
function posterPathOf(url: string | null): string | null {
  const match = url && /^https:\/\/image\.tmdb\.org\/t\/p\/w92(\/[\w-]+\.\w+)$/.exec(url);
  return match ? (match[1] ?? null) : null;
}

// Backdrops, wide enough for a phone's banner and for a larger screen's. TMDB serves no size
// between them.
function backdropUrls(backdropPath: string | null): FilmMetadata["backdropUrls"] {
  if (!backdropPath) return null;
  return {
    small: `${imageBaseUrl}/w780${backdropPath}`,
    large: `${imageBaseUrl}/w1280${backdropPath}`,
  };
}

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

// TMDB takes a key, so a 401 or 403 means ours is wrong or revoked; a 404 is a film it no longer
// has. Anything else, such as a 429 or a 5xx, is worth trying again.
function classifyFailure(status: number): SourceFailure {
  if (status === 404) return "gone";
  if (status === 401 || status === 403) return "access";
  return "temporary";
}

async function get(env: CatalogEnv, path: string, params: Record<string, string>) {
  if (!env.TMDB_ACCESS_TOKEN) {
    throw new SourceUnavailable("TMDB_ACCESS_TOKEN is not set", "access");
  }
  const url = new URL(`${env.TMDB_BASE_URL}${path}`);
  url.search = new URLSearchParams(params).toString();
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${env.TMDB_ACCESS_TOKEN}`, Accept: "application/json" },
    });
  } catch (error) {
    throw new SourceUnavailable(`TMDB ${path} failed`, "temporary", { cause: error });
  }
  if (!response.ok) {
    throw new SourceUnavailable(
      `TMDB ${path} answered ${response.status}`,
      classifyFailure(response.status),
    );
  }
  return response.json().catch(() => undefined);
}

// The first page of TMDB's matches, in TMDB's order, titled in the query's language.
async function searchFilms(env: CatalogEnv, query: string): Promise<CatalogSearchMatch[]> {
  const language = searchLanguage(query);
  const body = TmdbSearchResponse.safeParse(
    await get(env, "/search/movie", { query, language, include_adult: "false", page: "1" }),
  );
  if (!body.success) {
    throw new SourceUnavailable("TMDB search answered in an unknown shape", "temporary");
  }
  return body.data.results.map((film) => ({
    externalReference: { source: "tmdb", mediaType: "film", id: String(film.id) },
    title: titleOf(film),
    originalTitle: film.original_title,
    year: yearOf(film),
    posterUrl: posterUrl(film.poster_path ?? null),
    titleLanguage: language === "uk-UA" ? "uk" : "en",
  }));
}

// One call for both titles, the images, the runtime and the genres: the details in English with
// the film's translations appended. Unlike `title`, the translations list never falls back to
// another language, so it alone says whether a Ukrainian title exists; an empty one counts as none.
async function filmDetails(env: CatalogEnv, id: string): Promise<CatalogEntry> {
  const body = TmdbDetailsResponse.safeParse(
    await get(env, `/movie/${encodeURIComponent(id)}`, {
      language: "en-US",
      append_to_response: "translations",
    }),
  );
  if (!body.success) {
    throw new SourceUnavailable("TMDB details answered in an unknown shape", "temporary");
  }
  const film = body.data;
  const ukrainian = film.translations?.translations.find((t) => t.iso_639_1 === "uk");
  const extra: FilmCacheExtra = {
    backdropPath: film.backdrop_path ?? null,
    // TMDB says 0 for a runtime it doesn't know.
    runtime: film.runtime || null,
    genres: film.genres?.map((genre) => genre.name) ?? [],
  };
  return {
    englishTitle: titleOf(film),
    ukrainianTitle: ukrainian?.data?.title?.trim() || null,
    originalTitle: film.original_title,
    year: yearOf(film),
    coverRef: film.poster_path ?? null,
    extra,
  };
}

// The 90 days are ours: TMDB allows caching for 6 months (ADR-0004).
const maxEntryAge = 90 * 24 * 60 * 60 * 1000;

export const tmdbFilms: CatalogSource<"film"> = {
  externalSource: "tmdb",
  mediaType: "film",
  refreshCost: 1,
  maxEntryAge,
  search: searchFilms,
  details: filmDetails,
  coverRefOf: posterPathOf,
  emptyExtra: { backdropPath: null, runtime: null, genres: null },
  coverUrls: posterUrls,
  classifyFailure,
  metadataOf: (entry) => ({
    ...shownTitles(entry),
    year: entry.year,
    posterUrls: posterUrls(entry.coverRef),
    backdropUrls: backdropUrls(entry.extra.backdropPath),
    runtime: entry.extra.runtime,
    genres: entry.extra.genres ?? [],
  }),
};
