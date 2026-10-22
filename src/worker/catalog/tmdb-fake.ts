// A TMDB fake with fixed data, mounted among the test hooks so that the `local` Worker searches it
// instead of real TMDB (wrangler.jsonc). It answers like TMDB for the calls we make and the films
// below, which mirror real TMDB data so the same tests pass here and against TMDB on staging.
import { Hono } from "hono";
import type { SearchLanguage } from "./search-language";

interface FakeFilm {
  id: number;
  original_title: string;
  release_date: string;
  poster_path: string | null;
  // Localized Titles by TMDB language. Like TMDB, a missing one comes back as the Original Title.
  titles: Partial<Record<SearchLanguage, string>>;
  runtime: number;
  genres: string[];
}

const films: FakeFilm[] = [
  {
    id: 348,
    original_title: "Alien",
    release_date: "1979-05-25",
    poster_path: "/vfrQk5IPloGg1v9Rzbh2Eg3VGyM.jpg",
    titles: { "en-US": "Alien", "uk-UA": "Чужий" },
    runtime: 117,
    genres: ["Horror", "Science Fiction"],
  },
  {
    id: 679,
    original_title: "Aliens",
    release_date: "1986-07-18",
    poster_path: "/r1x5JGpyqZU8PYhbs4UcrO1Xb6x.jpg",
    titles: { "en-US": "Aliens", "uk-UA": "Чужі" },
    runtime: 137,
    genres: ["Action", "Thriller", "Science Fiction"],
  },
  {
    id: 194,
    original_title: "Le Fabuleux Destin d'Amélie Poulain",
    release_date: "2001-04-25",
    poster_path: "/nSxDa3M9aMvGVLoItzWTepQ5h5d.jpg",
    titles: { "en-US": "Amélie", "uk-UA": "Амелі" },
    runtime: 122,
    genres: ["Comedy", "Romance"],
  },
  {
    id: 26782,
    original_title: "Тіні забутих предків",
    release_date: "1965-10-18",
    poster_path: "/znV2lj6cbJGO7LZCAafXoDtvt2w.jpg",
    titles: { "en-US": "Shadows of Forgotten Ancestors", "uk-UA": "Тіні забутих предків" },
    runtime: 97,
    genres: ["Drama", "Romance"],
  },
  // Its poster is left out, so the fake claims no poster path it can't vouch for.
  {
    id: 603,
    original_title: "The Matrix",
    release_date: "1999-03-30",
    poster_path: null,
    titles: { "en-US": "The Matrix", "uk-UA": "Матриця" },
    runtime: 136,
    genres: ["Action", "Science Fiction"],
  },
  // Not a real film: the fake fails the details call for it the way TMDB does when it is down.
  {
    id: 999_000_001,
    original_title: "TMDB Fake Details Failure",
    release_date: "2020-01-01",
    poster_path: null,
    titles: { "en-US": "TMDB Fake Details Failure" },
    runtime: 90,
    genres: ["Drama"],
  },
];

const detailsFailureId = 999_000_001;

// Case and accents don't matter to TMDB's search: "amelie" finds "Amélie".
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}

export const tmdbFake = new Hono();

tmdbFake.use(async (c, next) => {
  if (!/^Bearer \S+$/.test(c.req.header("Authorization") ?? "")) {
    return c.json({ success: false, status_code: 7, status_message: "Invalid API key" }, 401);
  }
  await next();
});

// Searching for this makes the fake fail the way TMDB does when it is down.
const failingQuery = "tmdb fake failure";

const serviceOffline = { success: false, status_code: 9, status_message: "Service offline." };

tmdbFake.get("/3/search/movie", (c) => {
  if (c.req.query("query") === failingQuery) {
    return c.json(serviceOffline, 503);
  }
  const query = fold(c.req.query("query") ?? "");
  const language: SearchLanguage = c.req.query("language") === "uk-UA" ? "uk-UA" : "en-US";
  const matches = query
    ? films.filter((film) =>
        [film.original_title, ...Object.values(film.titles)].some((title) =>
          fold(title).includes(query),
        ),
      )
    : [];
  const results = matches.map(({ id, original_title, release_date, poster_path, titles }) => ({
    id,
    original_title,
    release_date,
    poster_path,
    title: titles[language] ?? original_title,
  }));
  return c.json({ page: 1, results, total_pages: 1, total_results: results.length });
});

// Like TMDB, details are in the requested language, falling back to the Original Title, and the
// appended translations list only the languages the film really has a title in.
tmdbFake.get("/3/movie/:id", (c) => {
  const film = films.find((f) => String(f.id) === c.req.param("id"));
  if (!film) {
    return c.json(
      { success: false, status_code: 34, status_message: "The resource could not be found." },
      404,
    );
  }
  if (film.id === detailsFailureId) return c.json(serviceOffline, 503);
  const { titles, genres, ...details } = film;
  const language: SearchLanguage = c.req.query("language") === "uk-UA" ? "uk-UA" : "en-US";
  const withTranslations = c.req.query("append_to_response")?.split(",").includes("translations");
  return c.json({
    ...details,
    title: titles[language] ?? film.original_title,
    genres: genres.map((name, index) => ({ id: index + 1, name })),
    ...(withTranslations && {
      translations: {
        translations: Object.entries(titles).map(([tag, title]) => ({
          iso_3166_1: tag.slice(3),
          iso_639_1: tag.slice(0, 2),
          data: { title },
        })),
      },
    }),
  });
});
