// Progress: how far a User has got in a Media Item that is In Progress, in a shape set by its Media
// Type (ADR-0005). Pure functions with no I/O, shared by the Worker, which enforces the rules, and
// the client, which keeps input within them. Plain values, so the client bundle doesn't pull in the
// API schemas.

// A series' Progress: the last episode the User watched. The season counts from 1, as season 0
// holds TMDB's specials, which a series' Progress leaves out. The episode counts from 0, which
// means none watched yet in that season, as after "Watch more" from a season, or a manual series'
// move to its next season.
export interface SeriesProgress {
  mediaType: "series";
  season: number;
  episode: number;
}

// A book's Progress: the page the User is on, and how many pages their edition has if they gave
// it. Page 0 means not started, as episode 0 does for a series. Both are the User's own: the
// catalog lists a work, not the edition in hand.
export interface BookProgress {
  mediaType: "book";
  page: number;
  pageCount?: number;
}

// A union discriminated by Media Type, with a member for each Media Type that has Progress.
export type Progress = SeriesProgress | BookProgress;

// `progress` if it is of `mediaType`, or null: a Media Item's Progress, read as its own shape.
export function progressFor<M extends Progress["mediaType"]>(
  progress: Progress | null | undefined,
  mediaType: M,
): Extract<Progress, { mediaType: M }> | null {
  return progress?.mediaType === mediaType
    ? (progress as Extract<Progress, { mediaType: M }>)
    : null;
}

// The highest page, and the most pages an edition may have.
export const maxPage = 100_000;

// The first regular season; season 0 holds the specials.
export const firstSeason = 1;

// Why a Progress is refused.
export type ProgressProblem = "invalid_progress" | "progress_mismatch";

function isWhole(value: number, min: number, max = Number.POSITIVE_INFINITY): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

// Why `progress` can't be kept for a Media Item of `mediaType`, or null when it can: it is for
// another Media Type, or one with no Progress (`progress_mismatch`), or out of its shape's range
// (`invalid_progress`), as a book's page past its page count is. Only the shape and the range are
// checked, never what the catalog lists, which can lag behind what has aired.
export function progressProblem(progress: Progress, mediaType: string): ProgressProblem | null {
  if (progress.mediaType !== mediaType) return "progress_mismatch";
  if (progress.mediaType === "series") {
    const { season, episode } = progress;
    return isWhole(season, firstSeason) && isWhole(episode, 0) ? null : "invalid_progress";
  }
  return bookPageProblem(progress) === null ? null : "invalid_progress";
}

// Why a book's page and page count can't be kept, naming which of them is wrong, so the client can
// say it under the right field: a page out of range, a page count out of range, or a page past the
// page count. Null when both can.
export type BookPageProblem = "page_out_of_range" | "page_count_out_of_range" | "past_last_page";

export function bookPageProblem({
  page,
  pageCount,
}: Omit<BookProgress, "mediaType">): BookPageProblem | null {
  if (!isWhole(page, 0, maxPage)) return "page_out_of_range";
  if (pageCount === undefined) return null;
  if (!isWhole(pageCount, 1, maxPage)) return "page_count_out_of_range";
  return page > pageCount ? "past_last_page" : null;
}

// One episode of a series, by its season and its number in that season.
export interface Episode {
  season: number;
  episode: number;
}

// What a series' cache entry says of its length: its regular seasons in order, each with how many
// episodes it lists, and the last episode that has aired. A manual series, and a catalog-backed one
// before its details are cached, list no seasons.
export interface SeriesLength {
  seasons: readonly { season: number; episodeCount: number }[];
  lastAiredEpisode: Episode | null;
}

// What follows from a series' Progress. nextEpisode is the one after the last watched, or the first
// of the next season that lists episodes, and null when the series lists none after it.
// watchedEpisodes of episodeCount is how far through all it lists the User is. caughtUp says
// they have watched the last episode that has aired, or that none has, whatever a running season
// lists ahead of airing. Without seasons the next episode is the next number in the same season,
// and there is no count and no catching up.
export interface SeriesOutlook {
  nextEpisode: Episode | null;
  watchedEpisodes: number | null;
  episodeCount: number | null;
  caughtUp: boolean;
}

// No Progress means not started: as if the User had watched none of the first season.
const notStarted: Episode = { season: firstSeason, episode: 0 };

function isAtOrAfter(a: Episode, b: Episode): boolean {
  return a.season > b.season || (a.season === b.season && a.episode >= b.episode);
}

// What follows from a series' Progress, or from none, and the seasons it lists (SeriesOutlook).
export function seriesOutlook(
  progress: SeriesProgress | null,
  { seasons, lastAiredEpisode }: SeriesLength,
): SeriesOutlook {
  const last: Episode = progress ?? notStarted;
  if (seasons.length === 0) {
    return {
      nextEpisode: { season: last.season, episode: last.episode + 1 },
      watchedEpisodes: null,
      episodeCount: null,
      caughtUp: false,
    };
  }
  const inSeason = seasons.find(({ season }) => season === last.season)?.episodeCount ?? 0;
  const nextSeason = seasons.find(({ season, episodeCount }) => {
    return season > last.season && episodeCount > 0;
  });
  const nextEpisode =
    last.episode < inSeason
      ? { season: last.season, episode: last.episode + 1 }
      : nextSeason
        ? { season: nextSeason.season, episode: 1 }
        : null;
  const before = seasons.filter(({ season }) => season < last.season);
  return {
    nextEpisode,
    watchedEpisodes:
      before.reduce((sum, { episodeCount }) => sum + episodeCount, 0) +
      Math.min(last.episode, inSeason),
    episodeCount: seasons.reduce((sum, { episodeCount }) => sum + episodeCount, 0),
    caughtUp: lastAiredEpisode === null || isAtOrAfter(last, lastAiredEpisode),
  };
}
