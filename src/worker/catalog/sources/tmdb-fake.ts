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
  // Overviews and taglines by TMDB language. Like TMDB, a missing one comes back as empty.
  texts: Partial<Record<SearchLanguage, { overview: string; tagline: string }>>;
  // Each crew member's name and job, and the cast's names, in TMDB's order.
  crew: [name: string, job: string][];
  cast: string[];
}

// Films as real TMDB had them; their overviews, taglines and credits on 2026-11-16.
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
    texts: {
      "en-US": {
        overview:
          "During its return to the earth, commercial spaceship Nostromo intercepts a distress signal from a distant planet. When a three-member team of the crew discovers a chamber containing thousands of eggs on the planet, a creature inside one of the eggs attacks an explorer. The entire crew is unaware of the impending nightmare set to descend upon them when the alien parasite planted inside its unfortunate host is birthed.",
        tagline: "In space no one can hear you scream.",
      },
      "uk-UA": {
        overview:
          "У далекому майбутньому вантажний космічний корабель, який повертається на Землю, перехоплює слабкий сигнал SOS з невідомої планети. Екіпаж вирішує виконати посадку і розібратися, що до чого. На планеті астронавти скрізь виявляють предмети, схожі на гігантські кокони або личинки.  На жаль, вони навіть не здогадуються, що в цих коконах чекають свого часу огидні безжальні тварюки, сенс існування яких зведено до винищення всього живого...",
        tagline: "В космосі ніхто твій крик не почує.",
      },
    },
    crew: [
      ["Ridley Scott", "Director"],
      ["Dan O'Bannon", "Screenplay"],
    ],
    cast: [
      "Tom Skerritt",
      "Sigourney Weaver",
      "Veronica Cartwright",
      "Harry Dean Stanton",
      "John Hurt",
      "Ian Holm",
    ],
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
    texts: {
      "en-US": {
        overview:
          "Ripley, the sole survivor of the Nostromo's deadly encounter with the monstrous Alien, returns to Earth after drifting through space in hypersleep for 57 years. Although her story is initially met with skepticism, she agrees to accompany a team of Colonial Marines back to LV-426.",
        tagline: "This time it's war.",
      },
      "uk-UA": {
        overview:
          "Капсула з Елен знайдена рятувальниками після багатьох років блукання у космосі. Їй повідомляють, що планета LV-426 колонізована, і їй доведеться повернутися туди, де розпочалося її пекло, тому що зв'язок із колоністами перервався.  І ось у складі групи космічного десанту Ріплі вирушає на прокляту планету. Але тепер на людей там чекає не один Чужий, а тисячі. Хто зможе вижити у цій війні: чудовиська, здатні лише вбивати, або люди, здатні мислити?",
        tagline: "",
      },
    },
    crew: [
      ["James Cameron", "Director"],
      ["Gale Anne Hurd", "Producer"],
    ],
    cast: [
      "Sigourney Weaver",
      "Carrie Henn",
      "Michael Biehn",
      "Paul Reiser",
      "Lance Henriksen",
      "Bill Paxton",
    ],
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
    texts: {
      "en-US": {
        overview:
          "At a tiny Parisian café, the adorable yet painfully shy Amélie accidentally discovers a gift for helping others. Soon Amelie is spending her days as a matchmaker, guardian angel, and all-around do-gooder. But when she bumps into a handsome stranger, will she find the courage to become the star of her very own love story?",
        tagline: "She’ll change your life.",
      },
      "uk-UA": {
        overview:
          "Чи знаєте ви, що всі події, що відбуваються в нашому світі, навіть найбільш незначні, взаємопов'язані найдивовижнішим і чудернацьким чином?  Як політ крихітної мухи може викликати десь далеко могутній ураган, так і дивні, і на перший погляд, незрозумілі вчинки тихої і самотньої дівчини, що живе в світі своїх фантазій, можуть назавжди змінити життя абсолютно різних людей. Цю дівчину звуть Амелі Пулен.",
        tagline: "Одна людина може змінити ваше життя назавжди.",
      },
    },
    crew: [
      ["Bruno Delbonnel", "Director of Photography"],
      ["Jean-Pierre Jeunet", "Director"],
    ],
    cast: [
      "Audrey Tautou",
      "Mathieu Kassovitz",
      "Rufus",
      "Serge Merlin",
      "Jamel Debbouze",
      "Clotilde Mollet",
    ],
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
    texts: {
      "en-US": {
        overview:
          "In the Carpathian Mountains of 19th-century Ukraine, love, hate, life and death among the Hutsul people are as they’ve been since time began. Ivan is drawn to Marichka, the beautiful young daughter of the man who killed his father. But fate tragically decrees that the two lovers will remain apart.",
        tagline: "",
      },
      "uk-UA": {
        overview:
          "Фільм, створений за однойменною повістю Михайла Коцюбинського. Десятки років ворогували два гуцульских роди — Палійчуки та Гутенюки. Але сталось так, що Іван Палійчук покохав красуню із ворожого роду — Марічку, якій судилося прожити коротке, але щасливе життя. Не міг без неї бути щасливим Іванко. Але він жив далі. Оженився. Був коханим. Дітей не було. Господарював. І шукав смерть, яка забрала в нього кохану.",
        tagline: "",
      },
    },
    crew: [
      ["Sergei Parajanov", "Director"],
      ["Ivan Chendej", "Writer"],
    ],
    cast: [
      "Ivan Mykolaichuk",
      "Larisa Kadochnikova",
      "Tatyana Bestayeva",
      "Mykola Hrynko",
      "Spartak Bagashvili",
      "Leonid Yengibarov",
    ],
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
    texts: {
      "en-US": {
        overview:
          "Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth.",
        tagline: "Believe the unbelievable.",
      },
      "uk-UA": {
        overview:
          "Хакер Томас Андерсон одного дня опиняється перед вибором, запропонованим таємничими незнайомцями. Він може продовжувати жити у своєму звичайному світі, який насправді — лише сон. Або ж поглянути в обличчя страшній реальності?",
        tagline: "Звільни свій розум.",
      },
    },
    crew: [
      ["Lana Wachowski", "Director"],
      ["Lilly Wachowski", "Director"],
      ["Owen Paterson", "Production Design"],
    ],
    cast: [
      "Keanu Reeves",
      "Laurence Fishburne",
      "Carrie-Anne Moss",
      "Hugo Weaving",
      "Gloria Foster",
      "Joe Pantoliano",
    ],
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
    texts: {},
    crew: [],
    cast: [],
  },
  // Not a real film: a backdrop (Alien's picture) and no poster, for the film page's placeholder,
  // and an overview short enough to show whole. The Matrix has the same gap, but only the TMDB
  // cache tests may use it.
  {
    id: 999_000_002,
    original_title: "TMDB Fake No Poster",
    release_date: "2020-01-01",
    poster_path: null,
    backdrop_path: "/AmR3JG1VQVxU8TfAvljUhfSFUOx.jpg",
    titles: { "en-US": "TMDB Fake No Poster" },
    runtime: 90,
    genres: ["Drama"],
    texts: { "en-US": { overview: "A film with no poster.", tagline: "" } },
    crew: [],
    cast: [],
  },
  // Not a real film: details with no overview, tagline or credits.
  {
    id: 999_000_003,
    original_title: "TMDB Fake Nothing Known",
    release_date: "2020-01-01",
    poster_path: null,
    backdrop_path: null,
    titles: { "en-US": "TMDB Fake Nothing Known" },
    runtime: 90,
    genres: ["Drama"],
    texts: {},
    crew: [],
    cast: [],
  },
  // Directed by two, in this order.
  {
    id: 6977,
    original_title: "No Country for Old Men",
    release_date: "2007-11-09",
    poster_path: "/6d5XOczc226jECq0LIX0siKtgHR.jpg",
    backdrop_path: "/fCCvn3xsG29TGKJPvZgTRppsDgk.jpg",
    titles: { "en-US": "No Country for Old Men", "uk-UA": "Старим тут не місце" },
    runtime: 122,
    genres: ["Crime", "Thriller", "Western"],
    texts: {
      "en-US": {
        overview:
          "Llewelyn Moss stumbles upon dead bodies, $2 million and a hoard of heroin in a Texas desert, but methodical killer Anton Chigurh comes looking for it, with local sheriff Ed Tom Bell hot on his trail. The roles of prey and predator blur as the violent pursuit of money and justice collide.",
        tagline: "There are no clean getaways.",
      },
      "uk-UA": {
        overview:
          "Звичайний роботяга знаходить в пустелі гору трупів, вантажівку, набиту героїном, і спокусливу суму у два мільйони доларів, готівкою. Він вирішує взяти гроші собі, і результатом стає хвиля насильства, яку не може зупинити вся поліція Західного Техасу.",
        tagline: "Немає порожніх шляхів",
      },
    },
    crew: [
      ["Joel Coen", "Director"],
      ["Scott Rudin", "Producer"],
      ["Ethan Coen", "Director"],
    ],
    cast: [
      "Javier Bardem",
      "Tommy Lee Jones",
      "Josh Brolin",
      "Woody Harrelson",
      "Kelly Macdonald",
      "Garret Dillahunt",
    ],
  },
  // TMDB has no Ukrainian translation of it, so its overview and tagline are English alone.
  {
    id: 11830,
    original_title: "タンポポ",
    release_date: "1985-11-23",
    poster_path: "/ArYdSuX3zY9fMsE4LqmBl7xJq5R.jpg",
    backdrop_path: "/oq8HM9TOSbH54Xy0OBJGzYrtUC7.jpg",
    titles: { "en-US": "Tampopo" },
    runtime: 115,
    genres: ["Comedy"],
    texts: {
      "en-US": {
        overview:
          'In this humorous paean to the joys of food, a pair of truck drivers happen onto a decrepit roadside shop selling ramen noodles. The widowed owner, Tampopo, begs them to help her turn her establishment into a paragon of the "art of noodle-soup making". Interspersed are satirical vignettes about the importance of food to different aspects of human life.',
        tagline: "The first Japanese Noodle Western.",
      },
    },
    crew: [
      ["Jūzō Itami", "Screenplay"],
      ["Jūzō Itami", "Director"],
    ],
    cast: [
      "Tsutomu Yamazaki",
      "Nobuko Miyamoto",
      "Ken Watanabe",
      "Koji Yakusho",
      "Rikiya Yasuoka",
      "Kinzō Sakura",
    ],
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
    texts: {},
    crew: [],
    cast: [],
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

// Like TMDB, details are in the requested language, the title falling back to the Original Title
// and the overview and tagline to empty, and the appended translations list only the languages
// the film really has a title, an overview or a tagline in.
tmdbFake.get("/3/movie/:id", (c) => {
  const film = films.find((f) => String(f.id) === c.req.param("id"));
  if (!film) {
    return c.json(
      { success: false, status_code: 34, status_message: "The resource could not be found." },
      404,
    );
  }
  if (film.id === detailsFailureId) return c.json(serviceOffline, 503);
  const { titles, genres, texts, crew, cast, ...details } = film;
  const language: SearchLanguage = c.req.query("language") === "uk-UA" ? "uk-UA" : "en-US";
  const appended = c.req.query("append_to_response")?.split(",") ?? [];
  const languages = [
    ...new Set([...Object.keys(titles), ...Object.keys(texts)]),
  ] as SearchLanguage[];
  return c.json({
    ...details,
    title: titles[language] ?? film.original_title,
    overview: texts[language]?.overview ?? "",
    tagline: texts[language]?.tagline ?? "",
    genres: genres.map((name, index) => ({ id: index + 1, name })),
    ...(appended.includes("credits") && {
      credits: {
        cast: cast.map((name, order) => ({ id: order + 1, name, character: "", order })),
        crew: crew.map(([name, job], index) => ({ id: index + 100, name, job, department: "" })),
      },
    }),
    ...(appended.includes("translations") && {
      translations: {
        translations: languages.map((tag) => ({
          iso_3166_1: tag.slice(3),
          iso_639_1: tag.slice(0, 2),
          data: {
            title: titles[tag] ?? "",
            overview: texts[tag]?.overview ?? "",
            tagline: texts[tag]?.tagline ?? "",
            homepage: "",
            runtime: 0,
          },
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

// Searching for this and a number finds a series of that id that isn't in `series`, and its
// details answer too, so a test can have a series, and so a cache entry, no other test reads.
// It is still running: its second season lists 4 episodes, 2 of which have aired.
const newSeriesQuery = /^tmdb fake new series (\d+)$/;
const firstNewSeriesId = 999_100_000;

function newSeries(id: number): FakeSeries {
  return {
    id,
    original_name: `New series ${id}`,
    first_air_date: "2025-01-10",
    last_air_date: "2026-11-13",
    status: "Returning Series",
    poster_path: null,
    backdrop_path: null,
    translations: {},
    seasons: { 1: 3, 2: 4 },
    last_episode_to_air: { season_number: 2, episode_number: 2, air_date: "2026-11-13" },
    next_episode_to_air: { season_number: 2, episode_number: 3, air_date: "2099-07-08" },
    created_by: [],
    cast: [],
  };
}

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
  const asked = c.req.query("query") ?? "";
  const newSeriesId = newSeriesQuery.exec(asked)?.[1];
  const query = fold(asked);
  const language = languageOf(c.req.query("language"));
  const matches = newSeriesId
    ? [newSeries(Number(newSeriesId))]
    : series.filter((show) =>
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
  const id = Number(c.req.param("id"));
  const show = series.find((s) => s.id === id) ?? (id >= firstNewSeriesId ? newSeries(id) : null);
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
