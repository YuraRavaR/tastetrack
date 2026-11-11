// Catalog rules shared by the Worker, which enforces them, and the client, which keeps input within
// them. Plain values, so the client bundle doesn't pull in the API schemas.

// Longer queries are refused; no title worth finding needs more.
export const maxSearchQueryLength = 100;

// A Manual Media Item's title, and its Original Title when it has one, are 1 to this many
// characters once trimmed.
export const maxManualTitleLength = 200;

// The years a film can have: from the first films, made in 1888, to five years from now, for films
// announced ahead. "Now" is the Worker's, in UTC.
export const earliestFilmYear = 1888;

export function latestFilmYear(now: Date): number {
  return now.getUTCFullYear() + 5;
}

// The years a book can have: it may be centuries older than any film, so the year is only kept
// within reason, up to the same five years from now.
export const earliestBookYear = -3000;

// A manual book's authors: at most this many names, each at most `maxManualTitleLength` characters
// once trimmed. Empty names are dropped.
export const maxManualAuthors = 20;

// A film's runtime, in minutes.
export const filmRuntime = { min: 1, max: 1_000 } as const;

// The genres a film can have: TMDB's film genres, so that a Manual Media Item's genres are named
// the same as a catalog-backed film's.
export const filmGenres = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "TV Movie",
  "Thriller",
  "War",
  "Western",
] as const;

export type FilmGenre = (typeof filmGenres)[number];

// Search lists at most this many of the User's matching Manual Media Items.
export const maxManualSearchResults = 20;

// A User holds at most this many Manual Media Items.
export const maxManualMediaItems = 1_000;

// A page fetches the metadata of at most this many films missing from the catalog cache, and shows
// the rest as placeholders, which the client then loads this many at a time (ADR-0004).
export const maxMetadataFills = 10;

// The Media Types a User can have In Progress: started and not yet finished (ADR-0005). A film is
// watched in one sitting, so it has none.
export const progressMediaTypes = ["book"] as const;

export type ProgressMediaType = (typeof progressMediaTypes)[number];

export function canProgress(mediaType: string): mediaType is ProgressMediaType {
  return (progressMediaTypes as readonly string[]).includes(mediaType);
}
