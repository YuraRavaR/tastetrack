import { CatalogSearchResponse } from "@shared/api";
import { expectBody } from "../support/api/responses";
import { expect, test } from "../support/fixtures";
import {
  bookReference,
  bookSearchResults,
  callsRealOpenLibrary,
  hymnId,
  tyhrolovyId,
  voroshilovgradId,
} from "../support/scenarios/books";

// Locally the Worker searches an Open Library fake with fixed data; on staging, the real Open
// Library. So these tests look only for works the fake mirrors.

test("a Cyrillic query on Books finds the Ukrainian work first, with its authors, year and cover", async ({
  loggedInApi,
}) => {
  const { results, manualResults } = await expectBody(
    loggedInApi.catalog.searchCatalog({ mediaType: "book", query: "Тигролови" }),
    200,
    CatalogSearchResponse,
  );

  expect(manualResults).toEqual([]);
  // Its Media Item exists once any test has added the book.
  const [first] = results;
  if (!first) throw new Error("No results");
  const { mediaItemId, ...found } = first;
  expect(mediaItemId === null || Number.isInteger(mediaItemId)).toBe(true);
  expect(found).toEqual({
    externalReference: bookReference(tyhrolovyId),
    title: "Тигролови",
    originalTitle: "Тигролови",
    year: 1946,
    posterUrl: "https://covers.openlibrary.org/b/id/12648826-M.jpg",
    titleLanguage: "uk",
    authors: ["Іван Багряний"],
    inLog: false,
    inBacklog: false,
    currentRating: null,
    logEntryCount: 0,
    lists: [],
  });
});

test("a Cyrillic query still finds a Ukrainian work held only in translation", async ({
  loggedInApi,
}) => {
  const results = await bookSearchResults(loggedInApi, "Ворошиловград");

  // Its only edition titled in Cyrillic is Russian, so the result keeps the work's title.
  expect(results).toContainEqual(
    expect.objectContaining({
      externalReference: bookReference(voroshilovgradId),
      title: "Voroshilovgrad",
      originalTitle: "Voroshilovgrad",
      year: 2012,
      authors: ["Сергі́й Ві́кторович Жада́н", "Reilly Costigan-Humes", "Isaac Wheeler"],
    }),
  );
});

test("an English query is answered with the English edition's title, the work's alongside", async ({
  loggedInApi,
}) => {
  const results = await bookSearchResults(loggedInApi, "Kafka on the Shore");

  expect(results[0]).toMatchObject({
    title: "Kafka on the Shore",
    originalTitle: "海辺のカフカ",
    year: 2001,
    titleLanguage: "en",
    authors: ["村上春樹"],
  });
});

test("a work without a cover has no cover URL", async ({ loggedInApi }) => {
  const results = await bookSearchResults(loggedInApi, "Himn demokratychnoï molodi");

  expect(results).toContainEqual(
    expect.objectContaining({ externalReference: bookReference(hymnId), posterUrl: null }),
  );
});

test("films stay out of a search on Books, and books out of one on Films", async ({
  loggedInApi,
}) => {
  const books = await bookSearchResults(loggedInApi, "alien");
  const { results: films } = await expectBody(
    loggedInApi.catalog.searchCatalog({ mediaType: "film", query: "Тигролови" }),
  );

  for (const result of books) expect(result.externalReference.mediaType).toBe("book");
  for (const result of [...films]) expect(result.externalReference.mediaType).toBe("film");
  expect(films).not.toContainEqual(expect.objectContaining({ title: "Тигролови" }));
});

test("when Open Library fails, searching Books is a 502", async ({ loggedInApi }) => {
  test.skip(callsRealOpenLibrary(), "Only the Open Library fake can be made to fail");

  // The fake answers this query with a 503.
  const failed = await expectBody(
    loggedInApi.catalog.searchCatalog({ mediaType: "book", query: "open library fake failure" }),
    502,
  );

  expect(failed).toEqual({ error: "catalog_unavailable" });
});
