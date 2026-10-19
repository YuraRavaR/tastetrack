// A TMDB fake with fixed data, mounted among the test hooks so that the `local` Worker searches it
// instead of real TMDB (wrangler.jsonc). It answers like TMDB for the calls we make and the films
// below, which mirror real TMDB data so the same tests pass here and against TMDB on staging.
import { Hono } from "hono";

interface FakeFilm {
  id: number;
  original_title: string;
  release_date: string;
  poster_path: string | null;
  // Localized Titles by TMDB language; a missing one comes back empty, as TMDB has no fallback.
  titles: Partial<Record<"en-US" | "uk-UA", string>>;
}

const films: FakeFilm[] = [
  {
    id: 348,
    original_title: "Alien",
    release_date: "1979-05-25",
    poster_path: "/vfrQk5IPloGg1v9Rzbh2Eg3VGyM.jpg",
    titles: { "en-US": "Alien", "uk-UA": "Чужий" },
  },
  {
    id: 679,
    original_title: "Aliens",
    release_date: "1986-07-18",
    poster_path: "/r1x5JGpyqZU8PYhbs4UcrO1Xb6x.jpg",
    titles: { "en-US": "Aliens", "uk-UA": "Чужі" },
  },
  {
    id: 194,
    original_title: "Le Fabuleux Destin d'Amélie Poulain",
    release_date: "2001-04-25",
    poster_path: "/nSxDa3M9aMvGVLoItzWTepQ5h5d.jpg",
    titles: { "en-US": "Amélie", "uk-UA": "Амелі" },
  },
  {
    id: 48035,
    original_title: "Тіні забутих предків",
    release_date: "1965-09-04",
    poster_path: null,
    titles: { "en-US": "Shadows of Forgotten Ancestors", "uk-UA": "Тіні забутих предків" },
  },
];

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

tmdbFake.get("/3/search/movie", (c) => {
  if (c.req.query("query") === failingQuery) {
    return c.json({ success: false, status_code: 9, status_message: "Service offline." }, 503);
  }
  const query = fold(c.req.query("query") ?? "");
  const language = c.req.query("language") === "uk-UA" ? "uk-UA" : "en-US";
  const matches = query
    ? films.filter((film) =>
        [film.original_title, ...Object.values(film.titles)].some((title) =>
          fold(title).includes(query),
        ),
      )
    : [];
  const results = matches.map(({ titles, ...film }) => ({
    ...film,
    title: titles[language] ?? "",
  }));
  return c.json({ page: 1, results, total_pages: 1, total_results: results.length });
});
