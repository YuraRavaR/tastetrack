// An Open Library fake with fixed data, mounted among the test hooks so that the `local` Worker
// searches it instead of the real Open Library (wrangler.jsonc). It answers like Open Library for
// the calls we make and the works below, which mirror real Open Library data (checked 2026-11-10,
// their descriptions 2026-11-16) so the same tests pass here and against Open Library on staging.
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
  // As Open Library has it, `\r\n` and Markdown links included; none for a work it has none for.
  description?: string;
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
    description:
      "Роман Івана Багряного Тигролови (1944) перший великий твір письменника, в якому вражаюче правдиво зображено страшну людську трагедію в часи сталінських репресій. Герой роману, як тисячі й тисячі тих, хто потрапив у лабети НКВС, приречений канути в безвість, щезнути. Та не такий Григорій Многогрішний, нащадок славетного козацького роду, щоби скоритися долі. Його веде віра в свою силу і правду. Це й допомагає йому вистояти за будь-яких обставин, повернути собі свободу, а разом з нею і життя.",
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
    description:
      "Поэт и прозаик Сергей Жадан (р. 1974) - видная фигура современной украинской культурной жизни. Он организует общественные акции, выступает совместно с рок-группами, переводит немецких и русских поэтов. Его называют лицом и голосом новой украинской литературы.\r\n" +
      'Роман "Ворошиловград", как и все тексты Жадана, полон поэтических метафор, неожиданных поворотов сюжета, воспоминай и сновидений, и в то же время повествует о событиях реальных и современных. Главный герой, Герман, отправляется на Донбасс, в город своего детства, окруженный бескрайними кукурузными полями. Его брат, владелец автозаправки, неожиданно пропал, а на саму заправку "положила глаз" местная мафия. Неожиданно для себя Герман осознает, что "продать всё и свалить" - не только неправильно, но и невозможно и надо защищать свой бизнес, свою территорию, своих женщин, свою память.\r\n' +
      'Роман удостоен премии Би-Би-Си "Книга года".',
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
    description:
      "Turning the envelope over, his hand trembling, Harry saw a purple wax seal bearing a coat of arms; a lion, an eagle, a badger and a snake surrounding a large letter 'H'.\r\n\r\n" +
      "HARRY POTTER has never even heard of Hogwarts when the LETTERS start dropping on the doormat at number four, Privet Drive. Addressed in GREEN INK on yellowish parchment with a PURPLE SEAL, they are swiftly confiscated by his GRISLY aunt and uncle. Then, on Harry's eleventh birthday, a great beetle-eyed giant of a man called RUBEUS HAGRID bursts in with some ASTONISHING news: Harry Potter is a wizard, and he has a place at Hogwarts School of Witchcraft and Wizardry. An incredible adventure is about to begin!",
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
    description:
      "A boy trying to escape a gruesome oedipedal prophecy, a simple man who can talk to cats, a mysterious librarian, and a woman waiting for a long-dead lover.",
    editions: [
      { title: "Kafka on the Shore", language: "eng" },
      { title: "Kafka am Strand", language: "ger" },
    ],
  },
  // A work whose description names others as Markdown reference links, listed at its end, and
  // has no Ukrainian edition.
  {
    id: "OL8479867W",
    title: "The Name of the Wind",
    authors: ["Patrick Rothfuss", "Marc Simonetti"],
    firstPublishYear: 2007,
    cover: 11480483,
    description:
      "***The Name of the Wind***, also called ***The Kingkiller Chronicle: Day One***, is a heroic fantasy novel written by American author Patrick Rothfuss. It is the first book in the ongoing fantasy trilogy ***The Kingkiller Chronicle***. It was published on March 27, 2007, by DAW Books, the novel has been hailed as a masterpiece of high fantasy.\r\n\r\n" +
      'The story begins the tale of Kvothe (pronounced "quothe"), a young man who becomes the most notorious magician his world has ever known. Kvothe narrates his own journey, from his childhood in a troupe of traveling players to his years as a near-feral orphan in a crime-ridden city, and his daring entrance into a prestigious and perilous school of magic.\r\n\r\n' +
      "Patrick Rothfuss's debut novel has been praised for its fresh and earthy originality, transporting readers into the mind of a wizard and the world that shaped him. It explores the truth behind the legend of a hero and how one can become entangled in their own mythology. Rothfuss's powerful storytelling and robust writing have earned him comparisons to renowned fantasy authors such as [Tad Williams][1], [George R. R. Martin][2], and [Robert Jordan][3].\r\n\r\n" +
      "Followed by: [***The Wise Man's Fear***][4]\r\n\r\n\r\n" +
      "([Source: special note from the publisher][5])\r\n\r\n" +
      "  [1]: https://openlibrary.org/authors/OL292141A/\r\n" +
      "  [2]: https://openlibrary.org/authors/OL234664A/\r\n" +
      "  [3]: https://openlibrary.org/authors/OL233594A\r\n" +
      "  [4]: https://openlibrary.org/works/OL8479869W\r\n" +
      "  [5]: https://patrickrothfuss.com/content/note.html",
    editions: [{ title: "The Name of the Wind", language: "eng" }],
  },
  // A work whose description ends with inline Markdown links to the books it is in, as Open
  // Library has it, first published in 1920.
  {
    id: "OL468431W",
    title: "The Great Gatsby",
    authors: ["F. Scott Fitzgerald"],
    firstPublishYear: 1920,
    cover: 10590366,
    description:
      "Here is a novel, glamorous, ironical, compassionate – a marvelous fusion into unity of the curious incongruities of the life of the period – which reveals a hero like no other – one who could live at no other time and in no other place. But he will live as a character, we surmise, as long as the memory of any reader lasts.\r\n\r\n" +
      '"There was something gorgeous about him, some heightened sensitivity to the promises of life.... It was an extraordinary gift for hope, a romantic readiness such as I have never found in any other person and which it is not likely I shall ever find again."\r\n\r\n' +
      "It is the story of this Jay Gatsby who came so mysteriously to West Egg, of his sumptuous entertainments, and of his love for Daisy Buchanan – a story that ranges from pure lyrical beauty to sheer brutal realism, and is infused with a sense of the strangeness of human circumstance in a heedless universe.\r\n\r\n" +
      "It is a magical, living book, blended of irony, romance, and mysticism.\r\n\r\n" +
      "\\--first edition jacket\r\n\r\n" +
      "---\r\n\r\n" +
      "Also contained in:\r\n\r\n" +
      "- [The Fitzgerald Reader](https://openlibrary.org/works/OL468551W/The_Fitzgerald_Reader)\r\n" +
      "- [Three Novels of F. Scott Fitzgerald](https://openlibrary.org/works/OL468557W)",
    editions: [{ title: "The Great Gatsby", language: "eng" }],
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
  const fields = (c.req.query("fields") ?? "").split(",");
  // Open Library fails whenever a search asks for both, and a work's description comes alone.
  if (fields.includes("description")) {
    if (fields.includes("editions")) return c.text("Internal Server Error", 500);
    const docs = found(asked)
      .slice(0, limit)
      .map(({ work }) => ({
        key: `/works/${work.id}`,
        ...(work.description !== undefined && { description: work.description }),
      }));
    return c.json({ numFound: docs.length, start: 0, numFoundExact: true, q: asked, docs });
  }
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
