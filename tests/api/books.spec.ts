import {
  BacklogResponse,
  ItemHistoryResponse,
  LibraryResponse,
  ListItemResponse,
  MediaItemResponse,
} from "@shared/api";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import { expect, test } from "../support/fixtures";
import {
  bookReference,
  bookSearchResult,
  callsRealOpenLibrary,
  harryPotterId,
  hymn,
  kafkaOnTheShore,
  mergedInto,
  mergedWorkFromSearch,
  mergedWorkId,
  newBook,
  tyhrolovy,
  tyhrolovyId,
  voroshilovgrad,
  voroshilovgradId,
} from "../support/scenarios/books";
import { alien } from "../support/scenarios/films";

// Locally the Worker calls an Open Library fake with fixed data; on staging, the real Open
// Library. So these tests use only the works the fake mirrors.

test("adding a book stores its Ukrainian edition's title beside the English one, its authors and its cover", async ({
  loggedInApi,
}) => {
  const result = await bookSearchResult(loggedInApi, "Гаррі Поттер", harryPotterId);
  const added = await loggedInApi.catalog.addCatalogItem(result);
  expect([200, 201]).toContain(added.status());

  expect(MediaItemResponse.parse(await added.json()).mediaItem).toEqual({
    id: expect.any(Number),
    mediaType: "book",
    externalReference: bookReference(harryPotterId),
    metadata: {
      title: "Harry Potter and the Philosopher's Stone",
      originalTitle: "Harry Potter and the Philosopher's Stone",
      ukrainianTitle: "Гаррі Поттер і філософський камінь",
      year: 1997,
      coverUrls: {
        small: "https://covers.openlibrary.org/b/id/15155833-M.jpg",
        large: "https://covers.openlibrary.org/b/id/15155833-L.jpg",
      },
      authors: ["J. K. Rowling"],
    },
  });
});

test("a book's title is its English edition's, with the work's own as its Original Title", async ({
  loggedInApi,
}) => {
  const { metadata } = await kafkaOnTheShore(loggedInApi);

  expect(metadata).toMatchObject({
    title: "Kafka on the Shore",
    originalTitle: "海辺のカフカ",
    ukrainianTitle: null,
    authors: ["村上春樹"],
  });
});

test("a book with no English edition is titled by its Original Title", async ({ loggedInApi }) => {
  const { metadata } = await tyhrolovy(loggedInApi);

  expect(metadata).toMatchObject({
    title: "Тигролови",
    originalTitle: "Тигролови",
    year: 1946,
    authors: ["Іван Багряний"],
  });
});

test("a book without a Ukrainian edition has no Ukrainian title, and one without a cover no cover", async ({
  loggedInApi,
}) => {
  const translated = await voroshilovgrad(loggedInApi);
  const coverless = await hymn(loggedInApi);

  expect(translated.metadata).toMatchObject({
    title: "Voroshilovgrad",
    originalTitle: "Voroshilovgrad",
    ukrainianTitle: null,
    authors: ["Сергі́й Ві́кторович Жада́н", "Reilly Costigan-Humes", "Isaac Wheeler"],
  });
  expect(translated.metadata.coverUrls).not.toBeNull();
  expect(coverless.metadata.coverUrls).toBeNull();
});

test("a book's page shows it to a User who has done nothing with it", async ({ loggedInApi }) => {
  const mediaItem = await tyhrolovy(loggedInApi);

  const history = loggedInApi.catalog.getMediaItemHistory(mediaItem.id);

  expect(await expectBody(history, 200, ItemHistoryResponse)).toEqual({
    mediaItem,
    logEntries: [],
    currentRating: null,
    inBacklog: false,
  });
});

test("a new User has an empty, private Backlog of books from registration", async ({
  loggedInApi,
}) => {
  const backlog = loggedInApi.backlog.getBacklog({ mediaType: "book" });

  expect((await expectBody(backlog, 200, BacklogResponse)).backlog).toEqual({
    id: expect.any(Number),
    mediaType: "book",
    visibility: "private",
    shareLink: null,
    items: [],
  });
});

test("a book marked Planned is in the Backlog and the Library of books, and taken off it is in neither", async ({
  loggedInApi,
}) => {
  const mediaItem = await tyhrolovy(loggedInApi);
  const addedAt = minutesAgo(30);
  const books = () => loggedInApi.backlog.getBacklog({ mediaType: "book" });
  const library = () => loggedInApi.library.getLibrary({ mediaType: "book" });

  const { listItem } = await expectBody(
    loggedInApi.backlog.addBacklogItem({ mediaItemId: mediaItem.id }, at(addedAt)),
    201,
    ListItemResponse,
  );

  expect(listItem).toEqual({ id: expect.any(Number), mediaItem, position: 0, note: null });
  expect((await expectBody(books())).backlog.items).toEqual([listItem]);
  expect((await expectBody(library(), 200, LibraryResponse)).items).toEqual([
    { mediaItem, backlog: { addedAt }, log: null },
  ]);
  const page = await expectBody(loggedInApi.catalog.getMediaItemHistory(mediaItem.id));
  expect(page.inBacklog).toBe(true);

  const removed = await loggedInApi.backlog.deleteBacklogItem(mediaItem.id);

  expect(removed.status()).toBe(204);
  expect((await expectBody(books())).backlog.items).toEqual([]);
  expect((await expectBody(library())).items).toEqual([]);
});

test("a planned book stays out of the film Backlog and Library, and a planned film out of the books'", async ({
  loggedInApi,
}) => {
  const book = await tyhrolovy(loggedInApi);
  const film = await alien(loggedInApi);
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: book.id }), 201);
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: film.id }), 201);

  for (const [mediaType, mediaItem] of [
    ["book", book],
    ["film", film],
  ] as const) {
    const { backlog } = await expectBody(loggedInApi.backlog.getBacklog({ mediaType }));
    const { items } = await expectBody(loggedInApi.library.getLibrary({ mediaType }));
    expect(backlog.items.map((item: { mediaItem: unknown }) => item.mediaItem)).toEqual([
      mediaItem,
    ]);
    expect(items.map((item: { mediaItem: unknown }) => item.mediaItem)).toEqual([mediaItem]);
  }
});

test("adding the same book again finds its Media Item", async ({ loggedInApi }) => {
  const first = await tyhrolovy(loggedInApi);
  const result = await bookSearchResult(loggedInApi, "Тигролови", tyhrolovyId);

  expect(result.mediaItemId).toBe(first.id);
  const { mediaItem } = await expectBody(loggedInApi.catalog.addCatalogItem(result), 200);
  expect(mediaItem).toEqual(first);
});

// Voroshilovgrad is taken out of the cache by this test alone, and used from the catalog by this
// file's tests alone, which run one after another.
test("an evicted book entry is refilled by the next page that shows it", async ({
  loggedInApi,
}) => {
  const mediaItem = await voroshilovgrad(loggedInApi);
  const evicted = await loggedInApi.testHooks.evictFromCatalogCache(
    bookReference(voroshilovgradId),
  );
  expect(evicted.status()).toBe(204);

  const cold = await loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
  const warm = await loggedInApi.catalog.getMediaItemHistory(mediaItem.id);

  expect((await expectBody(cold)).mediaItem).toEqual(mediaItem);
  expect((await expectBody(warm)).mediaItem).toEqual(mediaItem);
  // The first page wrote the entry back, so the second found it and had nothing to write.
  const queries = (page: typeof cold) => Number(page.headers()["x-d1-query-count"]);
  expect(queries(cold)).toBe(queries(warm) + 1);
});

test("a merged work's page shows the title and cover of the work it became, under its own External Reference", async ({
  loggedInApi,
}) => {
  const added = await loggedInApi.catalog.addCatalogItem(mergedWorkFromSearch);
  expect([200, 201]).toContain(added.status());
  const { mediaItem } = await added.json();

  const page = await expectBody(loggedInApi.catalog.getMediaItemHistory(mediaItem.id));

  expect(page.mediaItem).toEqual({
    id: mediaItem.id,
    mediaType: "book",
    externalReference: bookReference(mergedWorkId),
    metadata: {
      title: mergedInto.title,
      originalTitle: mergedInto.title,
      ukrainianTitle: null,
      year: mergedInto.year,
      coverUrls: {
        small: expect.stringMatching(/^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-M\.jpg$/),
        large: expect.stringMatching(/^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-L\.jpg$/),
      },
      authors: [mergedInto.author],
    },
  });
});

test("a book whose details Open Library doesn't give is added with what search said", async ({
  loggedInApi,
}) => {
  test.skip(callsRealOpenLibrary(), "Only the Open Library fake has a work without details");
  const { id, query, title } = newBook();
  const result = await bookSearchResult(loggedInApi, query, id);
  expect(result.mediaItemId).toBeNull();

  const { mediaItem } = await expectBody(loggedInApi.catalog.addCatalogItem(result), 201);

  // The authors come with the details alone: what a client says search said isn't kept.
  expect(mediaItem.metadata).toEqual({
    title,
    originalTitle: title,
    ukrainianTitle: null,
    year: 2020,
    coverUrls: null,
    authors: [],
  });
  expect((await bookSearchResult(loggedInApi, query, id)).mediaItemId).toBe(mediaItem.id);
});

test("a book first published long before any film can be added", async ({ loggedInApi }) => {
  test.skip(callsRealOpenLibrary(), "Only the Open Library fake has a work no one has added");
  const { id, query } = newBook();
  const result = await bookSearchResult(loggedInApi, query, id);

  const added = loggedInApi.catalog.addCatalogItem({ ...result, year: 1605 });

  expect((await expectBody(added, 201)).mediaItem.metadata?.year).toBe(1605);
});

test("a search result is added only under its Media Type's own External Source and ids", async ({
  loggedInApi,
}) => {
  const result = await bookSearchResult(loggedInApi, "Тигролови", tyhrolovyId);

  for (const externalReference of [
    { source: "tmdb", mediaType: "book", id: tyhrolovyId },
    { source: "openlibrary", mediaType: "film", id: tyhrolovyId },
    { source: "openlibrary", mediaType: "book", id: "348" },
    { source: "openlibrary", mediaType: "book", id: "OL2094429M" },
    { source: "tmdb", mediaType: "film", id: tyhrolovyId },
  ]) {
    const response = await loggedInApi.catalog.addCatalogItem({
      ...result,
      externalReference,
    } as never);
    expect(response.status(), JSON.stringify(externalReference)).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  }
});

test("a book can't be added by hand yet", async ({ loggedInApi }) => {
  const response = await loggedInApi.catalog.addManualMediaItem({
    mediaType: "book",
    title: "Доця",
  } as never);

  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: "invalid_request" });
});
