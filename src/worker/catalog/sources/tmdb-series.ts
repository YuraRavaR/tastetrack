// The TMDB catalog source of series (ADR-0004): a series is a TMDB tv show, the whole show, and
// a search or its details are one TMDB call each. Calls, images and failures are the films'
// (./tmdb.ts); what is tv-shaped stays in this file.
import { z } from "zod";
import type { SeriesCacheExtra } from "../../../db/schema";
import type { SeriesStatus } from "../../../shared/api";
import {
  type CatalogEntry,
  type CatalogEnv,
  type CatalogSearchMatch,
  type CatalogSource,
  SourceUnavailable,
  shownTitles,
} from "../source";
import { searchLanguage } from "./search-language";
import {
  backdropUrls,
  classifyFailure,
  configured,
  get,
  maxEntryAge,
  posterPathOf,
  posterUrl,
  posterUrls,
  textOf,
} from "./tmdb";

// Only the fields we use, so TMDB adding or dropping others doesn't break us.
const TmdbSeries = z.object({
  id: z.number(),
  name: z.string().optional(),
  original_name: z.string(),
  first_air_date: z.string().nullable().optional(),
  poster_path: z.string().nullable().optional(),
});

type TmdbSeries = z.infer<typeof TmdbSeries>;

const TmdbSearchResponse = z.object({ results: z.array(TmdbSeries) });

const TmdbEpisode = z
  .object({
    season_number: z.number(),
    episode_number: z.number(),
    air_date: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

const TmdbDetailsResponse = TmdbSeries.extend({
  backdrop_path: z.string().nullable().optional(),
  last_air_date: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  overview: z.string().nullable().optional(),
  tagline: z.string().nullable().optional(),
  seasons: z
    .array(z.object({ season_number: z.number(), episode_count: z.number().nullable().optional() }))
    .optional(),
  last_episode_to_air: TmdbEpisode,
  next_episode_to_air: TmdbEpisode,
  created_by: z.array(z.object({ name: z.string() })).optional(),
  credits: z.object({ cast: z.array(z.object({ name: z.string() })) }).optional(),
  translations: z
    .object({
      translations: z.array(
        z.object({
          iso_639_1: z.string(),
          data: z
            .object({
              name: z.string().optional(),
              overview: z.string().optional(),
              tagline: z.string().optional(),
            })
            .optional(),
        }),
      ),
    })
    .optional(),
});

type Season = SeriesCacheExtra["seasons"][number];
type Episode = NonNullable<SeriesCacheExtra["lastAiredEpisode"]>;

// TMDB writes a date it doesn't know as an empty string or leaves it out.
function yearOf(date: string | null | undefined): number | null {
  const year = Number.parseInt(date?.slice(0, 4) ?? "", 10);
  return Number.isNaN(year) ? null : year;
}

// A calendar day, YYYY-MM-DD, or null for anything TMDB writes otherwise.
function dayOf(date: string | null | undefined): string | null {
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

// As for films, an empty or missing name counts as none, and the Original Title stands in.
function titleOf(series: TmdbSeries): string {
  return series.name?.trim() || series.original_name;
}

// TMDB's statuses by the names it gives them. One it adds later reads as unknown, null, rather
// than failing the details call.
const statuses: Record<string, SeriesStatus> = {
  "Returning Series": "returning",
  "In Production": "in_production",
  Planned: "planned",
  Pilot: "pilot",
  Ended: "ended",
  Canceled: "canceled",
};

// The regular episode before `next`, or null when it is a series' first.
function episodeBefore(next: Episode, seasons: Season[]): Episode | null {
  if (next.episode > 1) return { season: next.season, episode: next.episode - 1 };
  const earlier = seasons.filter((s) => s.season < next.season && s.episodeCount > 0).at(-1);
  return earlier ? { season: earlier.season, episode: earlier.episodeCount } : null;
}

// The last regular episode that has aired. TMDB's last episode to air may be a special, of
// season 0: then it is the one before the next regular episode, when TMDB knows that, or the final
// one of a series that has ended. Otherwise it can't be told without a call per season.
function lastAiredEpisode(
  last: Episode | null,
  next: Episode | null,
  seasons: Season[],
  status: SeriesStatus | null,
): Episode | null {
  if (last && last.season >= 1) return last;
  if (!last) return null;
  if (next && next.season >= 1) return episodeBefore(next, seasons);
  if (status !== "ended" && status !== "canceled") return null;
  const final = seasons.filter((s) => s.episodeCount > 0).at(-1);
  return final ? { season: final.season, episode: final.episodeCount } : null;
}

// TMDB's last or next episode to air as a season and episode number, whichever season it is in.
function episodeOf(episode: z.infer<typeof TmdbEpisode>): Episode | null {
  return episode ? { season: episode.season_number, episode: episode.episode_number } : null;
}

// The first page of TMDB's matches, in TMDB's order, titled in the query's language.
async function searchSeries(env: CatalogEnv, query: string): Promise<CatalogSearchMatch[]> {
  const language = searchLanguage(query);
  const body = TmdbSearchResponse.safeParse(
    await get(env, "/search/tv", { query, language, include_adult: "false", page: "1" }),
  );
  if (!body.success) {
    throw new SourceUnavailable("TMDB tv search answered in an unknown shape", "temporary");
  }
  return body.data.results.map((series) => ({
    externalReference: { source: "tmdb", mediaType: "series", id: String(series.id) },
    title: titleOf(series),
    originalTitle: series.original_name,
    year: yearOf(series.first_air_date),
    posterUrl: posterUrl(series.poster_path ?? null),
    titleLanguage: language === "uk-UA" ? "uk" : "en",
    authors: [],
  }));
}

// One call for everything a series' entry holds: the details in English with its translations
// and credits appended. As for films, the translations list alone says whether a Ukrainian title,
// overview or tagline exists; an empty one counts as none.
async function seriesDetails(env: CatalogEnv, id: string): Promise<CatalogEntry<"series">> {
  const body = TmdbDetailsResponse.safeParse(
    await get(env, `/tv/${encodeURIComponent(id)}`, {
      language: "en-US",
      append_to_response: "translations,credits",
    }),
  );
  if (!body.success) {
    throw new SourceUnavailable("TMDB tv details answered in an unknown shape", "temporary");
  }
  const series = body.data;
  const ukrainian = series.translations?.translations.find((t) => t.iso_639_1 === "uk")?.data;
  const status = (series.status && statuses[series.status]) || null;
  const seasons = (series.seasons ?? [])
    .filter((season) => season.season_number >= 1)
    .map((season) => ({ season: season.season_number, episodeCount: season.episode_count ?? 0 }))
    .sort((a, b) => a.season - b.season);
  const next = episodeOf(series.next_episode_to_air);
  const extra: SeriesCacheExtra = {
    backdropPath: series.backdrop_path ?? null,
    firstAirYear: yearOf(series.first_air_date),
    lastAirYear: yearOf(series.last_air_date),
    status,
    seasons,
    lastAiredEpisode: lastAiredEpisode(
      episodeOf(series.last_episode_to_air),
      next,
      seasons,
      status,
    ),
    nextAirDate: dayOf(series.next_episode_to_air?.air_date),
    overview: { en: textOf(series.overview), uk: textOf(ukrainian?.overview) },
    tagline: { en: textOf(series.tagline), uk: textOf(ukrainian?.tagline) },
    creators: series.created_by?.map((creator) => creator.name) ?? [],
    cast: series.credits?.cast.slice(0, 5).map((member) => member.name) ?? [],
  };
  return {
    englishTitle: titleOf(series),
    ukrainianTitle: textOf(ukrainian?.name),
    originalTitle: series.original_name,
    year: yearOf(series.first_air_date),
    coverRef: series.poster_path ?? null,
    extra,
  };
}

// TMDB's series, under TMDB's 90-day expiry, each costing the cron one subrequest to refresh.
export const tmdbSeries: CatalogSource<"series"> = {
  externalSource: "tmdb",
  mediaType: "series",
  refreshCost: 1,
  maxEntryAge,
  search: searchSeries,
  details: seriesDetails,
  coverRefOf: posterPathOf,
  emptyExtra: {
    backdropPath: null,
    firstAirYear: null,
    lastAirYear: null,
    status: null,
    seasons: [],
    lastAiredEpisode: null,
    nextAirDate: null,
    overview: { en: null, uk: null },
    tagline: { en: null, uk: null },
    creators: [],
    cast: [],
  },
  coverUrls: posterUrls,
  configured,
  classifyFailure,
  metadataOf: (entry) => ({
    ...shownTitles(entry),
    year: entry.year,
    posterUrls: posterUrls(entry.coverRef),
    backdropUrls: backdropUrls(entry.extra.backdropPath),
    firstAirYear: entry.extra.firstAirYear,
    lastAirYear: entry.extra.lastAirYear,
    status: entry.extra.status,
    seasons: entry.extra.seasons,
    lastAiredEpisode: entry.extra.lastAiredEpisode,
    nextAirDate: entry.extra.nextAirDate,
  }),
  // As for films, nothing to show without an overview in either language or anyone in the
  // credits: a tagline alone isn't enough. A row filled from a search result alone has none.
  aboutOf: ({ extra: { overview, tagline, creators, cast } }) =>
    overview.en || overview.uk || creators.length > 0 || cast.length > 0
      ? { mediaType: "series", overview, tagline, creators, cast }
      : null,
};
