// A TMDB fake with fixed data, mounted among the test hooks so that the `local` Worker searches it
// instead of real TMDB (wrangler.jsonc). It answers like TMDB for the calls we make and the films
// and series below, which mirror real TMDB data so the same tests pass here and against TMDB on
// staging.
import { Hono } from "hono";
import type { SearchLanguage } from "./search-language";

interface FakeFilm {
  id: number;
  original_title: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
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
    backdrop_path: "/AmR3JG1VQVxU8TfAvljUhfSFUOx.jpg",
    titles: { "en-US": "Alien", "uk-UA": "Чужий" },
    runtime: 117,
    genres: ["Horror", "Science Fiction"],
  },
  // Its backdrop is left out, so tests can meet a film with a poster and no backdrop.
  {
    id: 679,
    original_title: "Aliens",
    release_date: "1986-07-18",
    poster_path: "/r1x5JGpyqZU8PYhbs4UcrO1Xb6x.jpg",
    backdrop_path: null,
    titles: { "en-US": "Aliens", "uk-UA": "Чужі" },
    runtime: 137,
    genres: ["Action", "Thriller", "Science Fiction"],
  },
  {
    id: 194,
    original_title: "Le Fabuleux Destin d'Amélie Poulain",
    release_date: "2001-04-25",
    poster_path: "/nSxDa3M9aMvGVLoItzWTepQ5h5d.jpg",
    backdrop_path: "/6n53UI4mX9QMfe2S0Pgt8mGebY1.jpg",
    titles: { "en-US": "Amélie", "uk-UA": "Амелі" },
    runtime: 122,
    genres: ["Comedy", "Romance"],
  },
  {
    id: 26782,
    original_title: "Тіні забутих предків",
    release_date: "1965-10-18",
    poster_path: "/znV2lj6cbJGO7LZCAafXoDtvt2w.jpg",
    backdrop_path: "/9UQoFWYiNU1NIz7pQlg5Wnub9In.jpg",
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
    backdrop_path: "/tlm8UkiQsitc8rSuIAscQDCnP8d.jpg",
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
    backdrop_path: null,
    titles: { "en-US": "TMDB Fake Details Failure" },
    runtime: 90,
    genres: ["Drama"],
  },
  // Not a real film: a backdrop (Alien's picture) and no poster, for the film page's placeholder.
  // The Matrix has the same gap, but only the TMDB cache tests may use it.
  {
    id: 999_000_002,
    original_title: "TMDB Fake No Poster",
    release_date: "2020-01-01",
    poster_path: null,
    backdrop_path: "/AmR3JG1VQVxU8TfAvljUhfSFUOx.jpg",
    titles: { "en-US": "TMDB Fake No Poster" },
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

// Searching for this and a number finds a film of that id that isn't in `films`, so a test can
// watch a film no one has added join the catalog, on a local D1 that outlives each test run.
const newFilmQuery = /^tmdb fake new film (\d+)$/;

function newFilm(id: string): FakeFilm {
  return {
    id: Number(id),
    original_title: `New film ${id}`,
    release_date: "2020-01-01",
    poster_path: null,
    backdrop_path: null,
    titles: {},
    runtime: 90,
    genres: [],
  };
}

tmdbFake.get("/3/search/movie", (c) => {
  if (c.req.query("query") === failingQuery) {
    return c.json(serviceOffline, 503);
  }
  const asked = c.req.query("query") ?? "";
  const newFilmId = newFilmQuery.exec(asked)?.[1];
  const query = fold(asked);
  const language: SearchLanguage = c.req.query("language") === "uk-UA" ? "uk-UA" : "en-US";
  const matches = newFilmId
    ? [newFilm(newFilmId)]
    : films.filter((film) =>
        [film.original_title, ...Object.values(film.titles)].some((title) =>
          query ? fold(title).includes(query) : false,
        ),
      );
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

// A TMDB tv episode, as a details call names the last and next to air.
interface FakeEpisode {
  season_number: number;
  episode_number: number;
  air_date: string;
}

interface FakeSeries {
  id: number;
  original_name: string;
  first_air_date: string;
  last_air_date: string;
  status: string;
  poster_path: string | null;
  backdrop_path: string | null;
  // Localized names, overviews and taglines by TMDB language. Like TMDB, a missing name comes back
  // as the Original Title, and a missing overview or tagline as empty.
  translations: Partial<
    Record<SearchLanguage, { name: string; overview: string; tagline: string }>
  >;
  // Episode counts by season number, season 0 being the specials.
  seasons: Record<number, number>;
  last_episode_to_air: FakeEpisode | null;
  next_episode_to_air: FakeEpisode | null;
  created_by: string[];
  cast: string[];
}

// Series as real TMDB had them on 2026-11-15, the overviews shortened.
const series: FakeSeries[] = [
  // Still running, with its season's last episode listed before it airs.
  {
    id: 247718,
    original_name: "MobLand",
    first_air_date: "2025-03-30",
    last_air_date: "2026-11-13",
    status: "Returning Series",
    poster_path: "/5Xc7WpWsgflfgEMoBlf9TmWhfbH.jpg",
    backdrop_path: "/h0OC7ouop8YLwbAVfS3UUE2Lw4T.jpg",
    translations: {
      "en-US": {
        name: "MobLand",
        overview: "Two mob families clash in a war that threatens to topple empires and lives.",
        tagline: "Chaos reigns.",
      },
      "uk-UA": {
        name: "Земля Гангстерів",
        overview:
          "Дві впливові злочинні династії ведуть жорстоку війну за контроль над підпільним світом Лондона.",
        tagline: "І запанує хаос.",
      },
    },
    seasons: { 1: 10, 2: 10 },
    last_episode_to_air: { season_number: 2, episode_number: 9, air_date: "2026-11-13" },
    next_episode_to_air: { season_number: 2, episode_number: 10, air_date: "2026-11-20" },
    created_by: ["Ronan Bennett"],
    cast: [
      "Tom Hardy",
      "Pierce Brosnan",
      "Paddy Considine",
      "Joanne Froggatt",
      "Lara Pulver",
      "Anson Boon",
    ],
  },
  // Ended, a single season.
  {
    id: 87108,
    original_name: "Chernobyl",
    first_air_date: "2019-05-06",
    last_air_date: "2019-06-03",
    status: "Ended",
    poster_path: "/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg",
    backdrop_path: "/900tHlUYUkp7Ol04XFSoAaEIXcT.jpg",
    translations: {
      "en-US": {
        name: "Chernobyl",
        overview:
          "The true story of one of the worst man-made catastrophes in history: the catastrophic nuclear accident at Chernobyl.",
        tagline: "What is the cost of lies?",
      },
      "uk-UA": {
        name: "Чорнобиль",
        overview: "Сюжет розгортається 1986 року під час трагічних подій на Чорнобильській АЕС.",
        tagline: "Яка ціна брехні?",
      },
    },
    seasons: { 1: 5 },
    last_episode_to_air: { season_number: 1, episode_number: 5, air_date: "2019-06-03" },
    next_episode_to_air: null,
    created_by: ["Craig Mazin"],
    cast: [
      "Jared Harris",
      "Stellan Skarsgård",
      "Emily Watson",
      "Paul Ritter",
      "Jessie Buckley",
      "Adam Nagaitis",
    ],
  },
  // Ended, with a season 0 of specials.
  {
    id: 1396,
    original_name: "Breaking Bad",
    first_air_date: "2008-01-20",
    last_air_date: "2013-09-29",
    status: "Ended",
    poster_path: "/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg",
    backdrop_path: "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
    translations: {
      "en-US": {
        name: "Breaking Bad",
        overview:
          "Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and given a prognosis of only two years left to live.",
        tagline: "Change the equation.",
      },
      "uk-UA": {
        name: "Пуститися берега",
        overview:
          "Шкільний учитель хімії Волтер Вайт дізнається, що хворий на рак легенів, і вирішує зайнятися виготовленням метамфетаміну.",
        tagline: "Як далеко ти готовий зайти заради родини?",
      },
    },
    seasons: { 0: 9, 1: 7, 2: 13, 3: 13, 4: 13, 5: 16 },
    last_episode_to_air: { season_number: 5, episode_number: 16, air_date: "2013-09-29" },
    next_episode_to_air: null,
    created_by: ["Vince Gilligan"],
    cast: ["Bryan Cranston", "Aaron Paul", "Anna Gunn", "RJ Mitte", "Dean Norris", "Betsy Brandt"],
  },
  // Not a real series: a backdrop (Chernobyl's picture) and no poster, no translation and no
  // tagline, and no creators TMDB knows of.
  {
    id: 999_000_102,
    original_name: "TMDB Fake No Poster Series",
    first_air_date: "2021-09-01",
    last_air_date: "2021-09-08",
    status: "Canceled",
    poster_path: null,
    backdrop_path: "/900tHlUYUkp7Ol04XFSoAaEIXcT.jpg",
    translations: {},
    seasons: { 1: 2 },
    last_episode_to_air: { season_number: 1, episode_number: 2, air_date: "2021-09-08" },
    next_episode_to_air: null,
    created_by: [],
    cast: [],
  },
];

function languageOf(language: string | undefined): SearchLanguage {
  return language === "uk-UA" ? "uk-UA" : "en-US";
}

function nameOf(show: FakeSeries, language: SearchLanguage): string {
  return show.translations[language]?.name ?? show.original_name;
}

tmdbFake.get("/3/search/tv", (c) => {
  if (c.req.query("query") === failingQuery) {
    return c.json(serviceOffline, 503);
  }
  const query = fold(c.req.query("query") ?? "");
  const language = languageOf(c.req.query("language"));
  const matches = series.filter((show) =>
    [show.original_name, ...Object.values(show.translations).map((t) => t.name)].some((name) =>
      query ? fold(name).includes(query) : false,
    ),
  );
  const results = matches.map((show) => ({
    id: show.id,
    name: nameOf(show, language),
    original_name: show.original_name,
    first_air_date: show.first_air_date,
    poster_path: show.poster_path,
    backdrop_path: show.backdrop_path,
    overview: show.translations[language]?.overview ?? "",
  }));
  return c.json({ page: 1, results, total_pages: 1, total_results: results.length });
});

// Like TMDB, details are in the requested language, the name falling back to the Original Title,
// and the appended translations list only the languages the series really has one in. Seasons
// come in number order, season 0 first.
tmdbFake.get("/3/tv/:id", (c) => {
  const show = series.find((s) => String(s.id) === c.req.param("id"));
  if (!show) {
    return c.json(
      { success: false, status_code: 34, status_message: "The resource could not be found." },
      404,
    );
  }
  const language = languageOf(c.req.query("language"));
  const appended = c.req.query("append_to_response")?.split(",") ?? [];
  const { translations, seasons, created_by, cast, ...details } = show;
  return c.json({
    ...details,
    name: nameOf(show, language),
    overview: translations[language]?.overview ?? "",
    tagline: translations[language]?.tagline ?? "",
    number_of_seasons: Object.keys(seasons).filter((n) => n !== "0").length,
    seasons: Object.entries(seasons).map(([number, count]) => ({
      season_number: Number(number),
      episode_count: count,
      name: number === "0" ? "Specials" : `Season ${number}`,
    })),
    created_by: created_by.map((name, index) => ({ id: index + 1, name })),
    ...(appended.includes("credits") && {
      credits: { cast: cast.map((name, order) => ({ id: order + 1, name, order })), crew: [] },
    }),
    ...(appended.includes("translations") && {
      translations: {
        translations: Object.entries(translations).map(([tag, data]) => ({
          iso_3166_1: tag.slice(3),
          iso_639_1: tag.slice(0, 2),
          data: { ...data, homepage: "" },
        })),
      },
    }),
  });
});
