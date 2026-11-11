import { type ManualMediaItemEditRequest, MediaItemResponse } from "@shared/api";
import { expectBody } from "../support/api/responses";
import { at } from "../support/clock";
import { expect, test } from "../support/fixtures";
import { manualBook } from "../support/scenarios/books";
import { manualFilm } from "../support/scenarios/films";

// A Ukrainian novel Open Library doesn't have.
const dotsia = "Доця";

test("a User adds a book by hand with its authors, and the book shows them wherever it shows", async ({
  loggedInApi,
}) => {
  const { mediaItem } = await expectBody(
    loggedInApi.catalog.addManualMediaItem({
      mediaType: "book",
      title: ` ${dotsia} `,
      originalTitle: " Dotsia ",
      year: 2019,
      authors: ["  Тамара Горіха Зерня ", "Translator Name"],
    }),
    201,
    MediaItemResponse,
  );

  expect(mediaItem).toEqual({
    id: expect.any(Number),
    mediaType: "book",
    externalReference: null,
    metadata: {
      title: dotsia,
      originalTitle: "Dotsia",
      ukrainianTitle: null,
      year: 2019,
      coverUrls: null,
      authors: ["Тамара Горіха Зерня", "Translator Name"],
    },
  });
  const mediaItemId = mediaItem.id;
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId }), 201);
  const { backlog } = await expectBody(loggedInApi.backlog.getBacklog({ mediaType: "book" }));
  expect(backlog.items.map((item: { mediaItem: object }) => item.mediaItem)).toEqual([mediaItem]);
  const search = loggedInApi.catalog.searchCatalog({ mediaType: "book", query: "доця" });
  const { manualResults } = await expectBody(search);
  expect(manualResults).toEqual([expect.objectContaining({ mediaItem, inBacklog: true })]);

  const logged = await expectBody(loggedInApi.log.createLogEntry({ mediaItemId, rating: 5 }), 201);

  expect(logged.logEntry.mediaItem).toEqual(mediaItem);
  const library = await expectBody(loggedInApi.library.getLibrary({ mediaType: "book" }));
  expect(library.items.map((item: { mediaItem: object }) => item.mediaItem)).toEqual([mediaItem]);
  const history = await expectBody(loggedInApi.catalog.getMediaItemHistory(mediaItemId));
  expect(history).toMatchObject({ mediaItem, currentRating: 5 });
  // Not among the User's films.
  const films = await expectBody(loggedInApi.library.getLibrary({ mediaType: "film" }));
  expect(films.items).toEqual([]);
});

test("only a title is needed, and a book added so has no authors", async ({ loggedInApi }) => {
  const mediaItem = await manualBook(loggedInApi, { title: dotsia, authors: ["  "] });

  expect(mediaItem.metadata).toEqual({
    title: dotsia,
    originalTitle: dotsia,
    ukrainianTitle: null,
    year: null,
    coverUrls: null,
    authors: [],
  });
});

test("a manual book's implausible values are refused, and a book may be centuries older than a film", async ({
  loggedInApi,
}) => {
  // The latest year is five years on, in UTC: 2030.
  const clock = at("2025-12-31T23:30:00Z");

  for (const data of [
    { title: "   " },
    { title: "Book", year: 2031 },
    { title: "Book", year: -3001 },
    { title: "Book", authors: ["x".repeat(201)] },
    { title: "Book", authors: Array.from({ length: 21 }, (_, i) => `Author ${i}`) },
    { title: "Book", authors: "Тамара Горіха Зерня" },
    // A film's details aren't a book's.
    { title: "Book", runtime: 300 },
    { title: "Book", genres: ["Drama"] },
  ]) {
    const response = await loggedInApi.catalog.addManualMediaItem(
      { mediaType: "book", ...data } as never,
      clock,
    );
    expect(response.status(), JSON.stringify(data)).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  }
  const filmWithAuthors = await loggedInApi.catalog.addManualMediaItem(
    { mediaType: "film", title: "Film", authors: ["Someone"] } as never,
    clock,
  );
  expect(filmWithAuthors.status()).toBe(400);

  for (const data of [
    { title: "Енеїда", year: 1798 },
    { title: "Epic of Gilgamesh", year: -2100 },
    { title: "Announced", year: 2030, authors: Array.from({ length: 20 }, () => "y".repeat(200)) },
  ]) {
    const response = await loggedInApi.catalog.addManualMediaItem(
      { mediaType: "book", ...data },
      clock,
    );
    expect(response.status(), JSON.stringify(data)).toBe(201);
  }
});

test("another User can't see a manual book", async ({ loggedInApi, otherUserClient }) => {
  const theirs = await manualBook(otherUserClient, { title: dotsia, authors: ["Тамара"] });

  const history = await expectBody(loggedInApi.catalog.getMediaItemHistory(theirs.id), 404);
  expect(history).toEqual({ error: "unknown_media_item" });
  const search = loggedInApi.catalog.searchCatalog({ mediaType: "book", query: dotsia });
  expect((await expectBody(search)).manualResults).toEqual([]);
  const patch = otherUserClient.catalog.updateManualMediaItem(theirs.id, { authors: [] });
  expect((await expectBody(patch)).mediaItem.metadata.authors).toEqual([]);
  const mine = loggedInApi.catalog.updateManualMediaItem(theirs.id, { authors: ["Me"] });
  expect(await expectBody(mine, 404)).toEqual({ error: "unknown_media_item" });
});

test("a manual book with the title or Original Title of another of the User's, and its year, is a possible duplicate", async ({
  loggedInApi,
  otherUserClient,
}) => {
  await manualBook(loggedInApi, { title: dotsia, year: 2019 });
  await manualBook(loggedInApi, {
    title: "Felix Austria",
    originalTitle: "Фелікс Австрія",
    year: 2014,
  });
  const post = (title: string, originalTitle: string | null, year: number) => {
    return loggedInApi.catalog.addManualMediaItem({
      mediaType: "book",
      title,
      originalTitle,
      year,
    });
  };

  for (const [title, originalTitle, year] of [
    [" ДОЦЯ ", null, 2019],
    // Its Original Title is the other's title.
    ["Dotsia", dotsia, 2019],
    // Its title is the other's Original Title.
    ["фелікс австрія", null, 2014],
  ] as const) {
    const response = post(title, originalTitle, year);
    expect(await expectBody(response, 409), title).toEqual({ error: "possible_duplicate" });
  }

  // Another year is another book, and another User's books don't count.
  expect((await post(dotsia, null, 2020)).status()).toBe(201);
  expect((await manualBook(otherUserClient, { title: dotsia, year: 2019 })).id).toEqual(
    expect.any(Number),
  );
});

test("a manual book and a manual film with the same title and year are no duplicates", async ({
  loggedInApi,
}) => {
  await manualFilm(loggedInApi, { title: "Тигролови", year: 1994 });

  const book = await manualBook(loggedInApi, { title: "Тигролови", year: 1994 });
  const film = loggedInApi.catalog.addManualMediaItem({
    mediaType: "film",
    title: "Тигролови",
    year: 1994,
  });

  expect(book.mediaType).toBe("book");
  expect(await expectBody(film, 409)).toEqual({ error: "possible_duplicate" });
});

test("the User edits a manual book's authors, by the same rules, and a book takes no film's details", async ({
  loggedInApi,
}) => {
  const book = await manualBook(loggedInApi, { title: dotsia, authors: ["Тамара"] });
  const patch = (changes: ManualMediaItemEditRequest) => {
    return loggedInApi.catalog.updateManualMediaItem(book.id, changes);
  };

  const edited = await expectBody(
    patch({ authors: [" Тамара Горіха Зерня ", "", "Someone Else"], year: 2019 }),
    200,
    MediaItemResponse,
  );

  expect(edited.mediaItem.metadata).toMatchObject({
    title: dotsia,
    year: 2019,
    authors: ["Тамара Горіха Зерня", "Someone Else"],
  });
  for (const changes of [{ runtime: 90 }, { genres: ["Drama"] }, { authors: ["x".repeat(201)] }]) {
    const response = patch(changes as never);
    expect(await expectBody(response, 400), JSON.stringify(changes)).toEqual({
      error: "invalid_request",
    });
  }
  const film = await manualFilm(loggedInApi, { title: "Home movie" });
  const filmPatch = loggedInApi.catalog.updateManualMediaItem(film.id, { authors: ["Me"] });
  expect(await expectBody(filmPatch, 400)).toEqual({ error: "invalid_request" });
  const history = await expectBody(loggedInApi.catalog.getMediaItemHistory(book.id));
  expect(history.mediaItem).toEqual(edited.mediaItem);
});
