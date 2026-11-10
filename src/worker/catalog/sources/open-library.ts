// The Open Library catalog source (ADR-0011): a book is a work, and everything Open Library-shaped
// stays in this file. Both a search and a book's details go through Open Library's search, the
// one call that gives a work with its authors' names, its first-published year and its edition in
// a language; a work's own record names its authors only by key, and its editions come in pages.
import { z } from "zod";
import type { CoverUrls } from "../../../shared/api";
import {
  type CatalogEntry,
  type CatalogEnv,
  type CatalogSearchMatch,
  type CatalogSource,
  type SourceFailure,
  SourceUnavailable,
  shownTitles,
} from "../source";
import { searchLanguage } from "./search-language";

// Covers are asked for by cover ID alone, which Open Library doesn't rate-limit as it does lookups
// by ISBN: the medium size for a thumbnail, the large one for a grid or the book's page.
const coverBaseUrl = "https://covers.openlibrary.org/b/id";

function coverUrls(coverId: string | null): CoverUrls | null {
  if (!coverId) return null;
  return { small: `${coverBaseUrl}/${coverId}-M.jpg`, large: `${coverBaseUrl}/${coverId}-L.jpg` };
}

// The cover ID back out of a thumbnail URL this module made, or null for any other URL.
function coverIdOf(url: string | null): string | null {
  const match = url && /^https:\/\/covers\.openlibrary\.org\/b\/id\/(\d+)-M\.jpg$/.exec(url);
  return match ? (match[1] ?? null) : null;
}

// The languages we keep titles in: what Open Library's `lang` calls each, and the MARC code its
// editions carry.
const languages = { en: "eng", uk: "ukr" } as const;

type Language = keyof typeof languages;

// Only the fields we use, so Open Library adding or dropping others doesn't break us. With `lang`,
// a work comes with one edition: one in that language if it has any, else some other.
const Work = z.object({
  key: z.string(),
  title: z.string(),
  author_name: z.array(z.string()).optional(),
  first_publish_year: z.number().optional(),
  cover_i: z.number().optional(),
  editions: z
    .object({
      docs: z.array(
        z.object({ title: z.string().optional(), language: z.array(z.string()).optional() }),
      ),
    })
    .optional(),
});

type Work = z.infer<typeof Work>;

const workFields = [
  "key",
  "title",
  "author_name",
  "first_publish_year",
  "cover_i",
  "editions",
  "editions.title",
  "editions.language",
].join(",");

const SearchResponse = z.object({ docs: z.array(z.unknown()) });

// A work's own record, of which we read only what became of the work.
const WorkRecord = z.object({
  type: z.object({ key: z.string() }),
  location: z.string().optional(),
});

const workKey = /^\/works\/(OL\d+W)$/;

// Open Library takes no key, so a 403 means it is blocking us; a 404 is a work it doesn't have.
// Anything else, such as a 429 or a 5xx, is worth trying again.
function classifyFailure(status: number): SourceFailure {
  if (status === 404) return "gone";
  if (status === 403) return "access";
  return "temporary";
}

// Every request says who is asking, TasteTrack and how to reach its Operator, as Open Library
// asks of its clients; without the contact we don't ask at all.
async function get(env: CatalogEnv, path: string, params: Record<string, string> = {}) {
  if (!env.OPEN_LIBRARY_CONTACT) {
    throw new SourceUnavailable("OPEN_LIBRARY_CONTACT is not set", "access");
  }
  const url = new URL(`${env.OPEN_LIBRARY_BASE_URL}${path}`);
  url.search = new URLSearchParams(params).toString();
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": `TasteTrack (${env.OPEN_LIBRARY_CONTACT})`,
        Accept: "application/json",
      },
    });
  } catch (error) {
    throw new SourceUnavailable(`Open Library ${path} failed`, "temporary", { cause: error });
  }
  if (!response.ok) {
    throw new SourceUnavailable(
      `Open Library ${path} answered ${response.status}`,
      classifyFailure(response.status),
    );
  }
  return response.json().catch(() => undefined);
}

// One search for works, each with its edition in the language. `lang` is a hint that ranks and
// excludes nothing; the language filter is never used, since it drops works with no edition in
// the language. A work that isn't shaped as we read it is left out.
async function searchWorks(
  env: CatalogEnv,
  q: string,
  language: Language,
  limit: number,
): Promise<Work[]> {
  const body = SearchResponse.safeParse(
    await get(env, "/search.json", {
      q,
      lang: language,
      limit: String(limit),
      fields: workFields,
    }),
  );
  if (!body.success) {
    throw new SourceUnavailable("Open Library search answered in an unknown shape", "temporary");
  }
  return body.data.docs.flatMap((doc) => {
    const work = Work.safeParse(doc);
    return work.success ? [work.data] : [];
  });
}

// The title of the edition the work came with, if that edition is in the language asked for.
function editionTitle(work: Work, language: Language): string | null {
  const edition = work.editions?.docs[0];
  if (!edition?.language?.includes(languages[language])) return null;
  return edition.title?.trim() || null;
}

function coverIdIn(work: Work): string | null {
  return work.cover_i === undefined ? null : String(work.cover_i);
}

// The first matches, in Open Library's order. A query with a Cyrillic letter asks for Ukrainian
// editions, any other for English ones, and a work with an edition in that language is titled by
// it; the rest keep the work's own title.
async function searchBooks(env: CatalogEnv, query: string): Promise<CatalogSearchMatch[]> {
  const language: Language = searchLanguage(query) === "uk-UA" ? "uk" : "en";
  const works = await searchWorks(env, query, language, 20);
  return works.flatMap((work) => {
    const id = workKey.exec(work.key)?.[1];
    if (!id) return [];
    return {
      externalReference: { source: "openlibrary", mediaType: "book", id },
      title: editionTitle(work, language) ?? work.title,
      originalTitle: work.title,
      year: work.first_publish_year ?? null,
      posterUrl: coverUrls(coverIdIn(work))?.small ?? null,
      titleLanguage: language,
      authors: work.author_name ?? [],
    };
  });
}

// One work by its ID, with its edition in the language, or null when search doesn't have it.
async function workIn(env: CatalogEnv, id: string, language: Language): Promise<Work | null> {
  const [work] = await searchWorks(env, `key:/works/${id}`, language, 1);
  return work ?? null;
}

// What became of a work search doesn't have: the ID of the work Open Library merged it into, whose
// record the old ID answers with as a redirect. A work it deleted, or never had, is gone.
async function mergedInto(env: CatalogEnv, id: string): Promise<string> {
  const record = WorkRecord.safeParse(await get(env, `/works/${encodeURIComponent(id)}.json`));
  if (!record.success) {
    throw new SourceUnavailable("Open Library's work answered in an unknown shape", "temporary");
  }
  const { type, location } = record.data;
  if (type.key === "/type/delete") {
    throw new SourceUnavailable(`Open Library deleted work ${id}`, "gone");
  }
  const target = type.key === "/type/redirect" ? workKey.exec(location ?? "")?.[1] : undefined;
  if (!target) {
    throw new SourceUnavailable(`Open Library's search doesn't have work ${id}`, "temporary");
  }
  return target;
}

// Two calls, one after the other: the work with its Ukrainian edition, then with its English one.
// The Original Title is the work's, and each Localized Title an edition's in that language, none
// when the work has no such edition. A work search doesn't have costs one call instead of the
// second, to learn what became of it; only a merged work costs two more, for the work it became.
// The entry stays under the ID asked for.
async function bookDetails(
  env: CatalogEnv,
  id: string,
  merged = false,
): Promise<CatalogEntry<"book">> {
  const ukrainian = await workIn(env, id, "uk");
  if (!ukrainian) {
    if (merged) {
      throw new SourceUnavailable(`Open Library's search doesn't have work ${id}`, "temporary");
    }
    return bookDetails(env, await mergedInto(env, id), true);
  }
  const english = (await workIn(env, id, "en")) ?? ukrainian;
  return {
    englishTitle: editionTitle(english, "en"),
    ukrainianTitle: editionTitle(ukrainian, "uk"),
    originalTitle: english.title,
    year: english.first_publish_year ?? null,
    coverRef: coverIdIn(english),
    extra: { authors: english.author_name ?? [] },
  };
}

export const openLibraryBooks: CatalogSource<"book"> = {
  externalSource: "openlibrary",
  mediaType: "book",
  refreshCost: 2,
  // Open Library sets no limit on how long its data may be kept (ADR-0011).
  maxEntryAge: null,
  search: searchBooks,
  details: (env, id) => bookDetails(env, id),
  coverRefOf: coverIdOf,
  emptyExtra: { authors: [] },
  coverUrls,
  classifyFailure,
  metadataOf: (entry) => ({
    ...shownTitles(entry),
    year: entry.year,
    coverUrls: coverUrls(entry.coverRef),
    authors: entry.extra.authors,
  }),
};
