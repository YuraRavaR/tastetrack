// An Open Library fake with fixed data, mounted among the test hooks so that the `local` Worker
// searches it instead of the real Open Library (wrangler.jsonc). It answers like Open Library for
// the calls we make and the works below, which mirror real Open Library data (checked 2026-11-10)
// so the same tests pass here and against Open Library on staging.
import { Hono } from "hono";

interface FakeEdition {
  title: string;
  // The MARC code of its language, as Open Library's editions carry it.
  language: string;
}

interface FakeWork {
  id: string;
  title: string;
  authors: string[];
  firstPublishYear: number;
  cover: number | null;
  editions: FakeEdition[];
}

const works: FakeWork[] = [
  // A Ukrainian novel with a Ukrainian edition and a cover, and no English edition.
  {
    id: "OL2094429W",
    title: "Тигролови",
    authors: ["Іван Багряний"],
    firstPublishYear: 1946,
    cover: 12648826,
    editions: [{ title: "Тигролови", language: "ukr" }],
  },
  // A Ukrainian novel with no Ukrainian edition: titled in transliteration, its translators among
  // its authors, its author's name with stress marks, and its only Cyrillic edition Russian.
  {
    id: "OL19962759W",
    title: "Voroshilovgrad",
    authors: ["Сергі́й Ві́кторович Жада́н", "Reilly Costigan-Humes", "Isaac Wheeler"],
    firstPublishYear: 2012,
    cover: 12649478,
    editions: [
      { title: "Voroshilovgrad", language: "eng" },
      { title: "Ворошиловград", language: "rus" },
      { title: "Die Erfindung des Jazz im Donbass", language: "ger" },
    ],
  },
  // A work without a cover.
  {
    id: "OL12697597W",
    title: "Himn demokratychnoï molodi",
    authors: ["Сергі́й Ві́кторович Жада́н"],
    firstPublishYear: 2006,
    cover: null,
    editions: [{ title: "Himn demokratychnoï molodi", language: "ukr" }],
  },
  // A work with English and Ukrainian editions under different titles.
  {
    id: "OL82563W",
    title: "Harry Potter and the Philosopher's Stone",
    authors: ["J. K. Rowling"],
    firstPublishYear: 1997,
    cover: 15155833,
    editions: [
      { title: "Harry Potter and the Philosopher's Stone", language: "eng" },
      { title: "Гаррі Поттер і філософський камінь", language: "ukr" },
    ],
  },
  // A work whose English edition is titled differently from the work, with no Ukrainian edition.
  {
    id: "OL2625431W",
    title: "海辺のカフカ",
    authors: ["村上春樹"],
    firstPublishYear: 2001,
    cover: 4982600,
    editions: [
      { title: "Kafka on the Shore", language: "eng" },
      { title: "Kafka am Strand", language: "ger" },
    ],
  },
  // The work another was merged into, below.
  {
    id: "OL99995W",
    title: "One Coffee With (Sigrid Harald Mysteries)",
    authors: ["Margaret Maron"],
    firstPublishYear: 1981,
    cover: 459862,
    editions: [{ title: "One Coffee With (Sigrid Harald Mysteries)", language: "eng" }],
  },
];

// Works Open Library merged into another, by their old ID: search no longer has them, and their
// record is a redirect to the work they became.
const merged: Record<string, string> = { OL100005W: "OL99995W" };

// What Open Library's `lang` calls a language, to the MARC code its editions carry.
const marcCodes: Record<string, string> = { en: "eng", uk: "ukr" };

// Case and accents don't matter to Open Library's search, nor do the stress marks in a name.
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}

export const openLibraryFake = new Hono();

// Open Library blocks clients that don't say who they are; the fake is as strict, so a test
// notices a request without the Operator's contact.
openLibraryFake.use(async (c, next) => {
  if (!/^TasteTrack \(\S.*\)$/.test(c.req.header("User-Agent") ?? "")) {
    return c.text("Forbidden", 403);
  }
  await next();
});

// Searching for this makes the fake fail the way Open Library does when it is down.
const failingQuery = "open library fake failure";

// Searching for this and a work ID finds a work of that ID that isn't in `works`, so a test can
// watch a book no one has added join the catalog, on a local D1 that outlives each test run. Like
// a work Open Library has just deleted, it has no details.
const newBookQuery = /^open library fake new book (OL\d+W)$/;

function newBook(id: string): FakeWork {
  return {
    id,
    title: `New book ${id}`,
    authors: ["Open Library Fake"],
    firstPublishYear: 2020,
    cover: null,
    editions: [],
  };
}

const workQuery = /^key:\/works\/(OL\d+W)$/;

// The works a query finds, each with the editions the query matched: every edition of a work
// asked for by its key, and those with the words in their title otherwise, or all of them when
// the words are in the work's title or an author's name alone.
function found(asked: string): { work: FakeWork; editions: FakeEdition[] }[] {
  const id = workQuery.exec(asked)?.[1];
  if (id) {
    return works
      .filter((work) => work.id === id)
      .map((work) => ({ work, editions: work.editions }));
  }
  const newBookId = newBookQuery.exec(asked)?.[1];
  if (newBookId) return [{ work: newBook(newBookId), editions: [] }];
  const query = fold(asked);
  if (!query) return [];
  return works.flatMap((work) => {
    const matching = work.editions.filter((edition) => fold(edition.title).includes(query));
    const named = [work.title, ...work.authors].some((text) => fold(text).includes(query));
    if (matching.length === 0 && !named) return [];
    return { work, editions: matching.length > 0 ? matching : work.editions };
  });
}

// Like Open Library, each work comes with one edition: one in the language asked for if the
// query matched any, else another, whatever its language.
openLibraryFake.get("/search.json", (c) => {
  const asked = c.req.query("q") ?? "";
  if (asked === failingQuery) return c.text("Service Unavailable", 503);
  const language = marcCodes[c.req.query("lang") ?? "en"];
  const limit = Number(c.req.query("limit") ?? 100);
  const docs = found(asked)
    .slice(0, limit)
    .map(({ work, editions }) => {
      const edition = editions.find((each) => each.language === language) ?? editions[0];
      return {
        key: `/works/${work.id}`,
        title: work.title,
        author_name: work.authors,
        first_publish_year: work.firstPublishYear,
        ...(work.cover !== null && { cover_i: work.cover }),
        editions: {
          numFound: editions.length,
          start: 0,
          numFoundExact: true,
          docs: edition ? [{ title: edition.title, language: [edition.language] }] : [],
        },
      };
    });
  return c.json({ numFound: docs.length, start: 0, numFoundExact: true, q: asked, docs });
});

// A work's own record: a redirect for a merged work, and a 404 for one Open Library never had.
openLibraryFake.get("/works/:file{OL\\d+W\\.json}", (c) => {
  const id = c.req.param("file").replace(/\.json$/, "");
  const key = `/works/${id}`;
  const target = merged[id];
  if (target) {
    return c.json({ key, type: { key: "/type/redirect" }, location: `/works/${target}` });
  }
  const work = works.find((each) => each.id === id);
  if (!work) return c.json({ error: "notfound", key }, 404);
  return c.json({
    key,
    title: work.title,
    type: { key: "/type/work" },
    ...(work.cover !== null && { covers: [work.cover] }),
  });
});
