// What a series being watched shows, worked out from the User's Progress and what the series'
// cache entry lists (seriesOutlook, which the Worker shares), and the steps the picker takes.
import type { MediaItem } from "../../shared/api";
import {
  type Episode,
  firstSeason,
  type SeriesLength,
  type SeriesProgress,
  seriesOutlook,
} from "../../shared/progress";

export type Series = Extract<MediaItem, { mediaType: "series" }>;

// A manual series, and a catalog-backed one whose details aren't cached, list no seasons.
const unknownLength: SeriesLength = { seasons: [], lastAiredEpisode: null };

// What a series' row and card say. `next` is the episode the check marks watched, with how many
// episodes its season lists, when the series lists them; null once the User is caught up, or has
// watched all it lists. `airs` is then the next episode and its day, when TMDB gives it. `watched`
// of `count` is the bar; both null for a series that lists no seasons.
export interface Watching {
  next: (Episode & { seasonLength: number | null }) | null;
  airs: { episode: Episode; date: string } | null;
  watched: number | null;
  count: number | null;
}

export function watchingOf({ metadata }: Series, progress: SeriesProgress | null): Watching {
  const outlook = seriesOutlook(progress, metadata ?? unknownLength);
  const { nextEpisode } = outlook;
  const seasonOf = (episode: Episode) => {
    return metadata?.seasons.find(({ season }) => season === episode.season)?.episodeCount ?? null;
  };
  const caughtUp = outlook.caughtUp || nextEpisode === null;
  return {
    next: caughtUp || !nextEpisode ? null : { ...nextEpisode, seasonLength: seasonOf(nextEpisode) },
    airs:
      caughtUp && nextEpisode && metadata?.nextAirDate
        ? { episode: nextEpisode, date: metadata.nextAirDate }
        : null,
    watched: outlook.watchedEpisodes,
    count: outlook.episodeCount,
  };
}

// The Progress after the check: `episode` is the last one watched.
export function watched(episode: Episode): SeriesProgress {
  return { mediaType: "series", season: episode.season, episode: episode.episode };
}

// The last episode watched, as the picker shows it: none of the first season before any Progress.
export function lastWatched(progress: SeriesProgress | null): Episode {
  return progress ?? { season: firstSeason, episode: 0 };
}

// The picker's steps. Another season starts with none of it watched, which is how a User moves a
// manual series on to its next season. Neither has an upper end: TMDB can lag behind what aired.
export function stepSeason(progress: SeriesProgress | null, by: 1 | -1): SeriesProgress {
  const season = Math.max(firstSeason, lastWatched(progress).season + by);
  return { mediaType: "series", season, episode: 0 };
}

export function stepEpisode(progress: SeriesProgress | null, by: 1 | -1): SeriesProgress {
  const last = lastWatched(progress);
  return { mediaType: "series", season: last.season, episode: Math.max(0, last.episode + by) };
}
