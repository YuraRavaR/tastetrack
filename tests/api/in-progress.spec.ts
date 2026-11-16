import {
  InProgressResponse,
  ItemHistoryResponse,
  LibraryResponse,
  NewInProgressResponse,
  NewLogEntryResponse,
} from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import { expect, test } from "../support/fixtures";
import { bookProgress, kafkaOnTheShore, manualBook, tyhrolovy } from "../support/scenarios/books";
import { alien } from "../support/scenarios/films";
import { chernobyl } from "../support/scenarios/series";

// In Progress: a book the User has started and not finished ("Reading" in the UI).

async function bookLibrary(api: ApiClient) {
  const library = api.library.getLibrary({ mediaType: "book" });
  return (await expectBody(library, 200, LibraryResponse)).items;
}

test("starting a book on the Reading list takes it off, says where it was, and the Library shows it In Progress", async ({
  loggedInApi,
}) => {
  const other = await kafkaOnTheShore(loggedInApi);
  const mediaItem = await tyhrolovy(loggedInApi);
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: other.id }), 201);
  await expectBody(
    loggedInApi.backlog.addBacklogItem({ mediaItemId: mediaItem.id, note: "Olena's copy" }),
    201,
  );
  const startedAt = minutesAgo(5);

  const started = loggedInApi.inProgress.start(
    { mediaItemId: mediaItem.id, startDate: "2026-10-12" },
    at(startedAt),
  );

  expect(await expectBody(started, 201, NewInProgressResponse)).toEqual({
    inProgress: { startDate: "2026-10-12", createdAt: startedAt, progress: null },
    removedFromBacklog: { position: 1, note: "Olena's copy" },
  });
  expect(await bookLibrary(loggedInApi)).toEqual(
    expect.arrayContaining([
      {
        mediaItem,
        backlog: null,
        inProgress: { startDate: "2026-10-12", createdAt: startedAt, progress: null },
        log: null,
      },
    ]),
  );
});

test("starting a book already In Progress is refused, and leaves the Reading list as it is", async ({
  loggedInApi,
}) => {
  const mediaItem = await tyhrolovy(loggedInApi);
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: mediaItem.id }), 201);
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: mediaItem.id }), 201);

  const again = loggedInApi.inProgress.start({ mediaItemId: mediaItem.id });

  expect(await expectBody(again, 409)).toEqual({ error: "already_in_progress" });
  const { backlog } = await expectBody(loggedInApi.backlog.getBacklog({ mediaType: "book" }));
  expect(backlog.items.map((item: { mediaItem: unknown }) => item.mediaItem)).toEqual([mediaItem]);
});

test("finishing a book returns its Log Entry, and the book is Read and no longer In Progress", async ({
  loggedInApi,
}) => {
  const mediaItem = await tyhrolovy(loggedInApi);
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: mediaItem.id }), 201);
  const finishedAt = minutesAgo(1);

  const finished = loggedInApi.inProgress.finish(
    mediaItem.id,
    { rating: 4.5, date: "2026-11-01", review: "Gripping." },
    at(finishedAt),
  );

  const logEntry = {
    id: expect.any(Number),
    mediaItem,
    rating: 4.5,
    date: "2026-11-01",
    review: "Gripping.",
    revisit: false,
    createdAt: finishedAt,
  };
  expect(await expectBody(finished, 201, NewLogEntryResponse)).toEqual({
    logEntry,
    removedFromBacklog: null,
    currentRating: 4.5,
    logEntryCount: 1,
  });
  const history = loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
  expect(await expectBody(history, 200, ItemHistoryResponse)).toEqual({
    mediaItem,
    logEntries: [logEntry],
    thoughts: [],
    currentRating: 4.5,
    inBacklog: false,
    inProgress: null,
    about: { mediaType: "book", description: expect.stringMatching(/^Роман Івана Багряного/) },
  });
  expect(await bookLibrary(loggedInApi)).toEqual([
    {
      mediaItem,
      backlog: null,
      inProgress: null,
      log: { currentRating: 4.5, lastLogEntry: { date: "2026-11-01", createdAt: finishedAt } },
    },
  ]);
});

test("a book finished after an earlier Reading can be a Reread", async ({ loggedInApi }) => {
  const mediaItem = await tyhrolovy(loggedInApi);
  await expectBody(
    loggedInApi.log.createLogEntry({ mediaItemId: mediaItem.id, rating: 3 }, at(minutesAgo(10))),
    201,
  );
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: mediaItem.id }), 201);

  const finished = loggedInApi.inProgress.finish(mediaItem.id, { rating: 5, revisit: true });

  const body = await expectBody(finished, 201, NewLogEntryResponse);
  expect(body.logEntry.revisit).toBe(true);
  expect(body).toMatchObject({ currentRating: 5, logEntryCount: 2 });
});

test("stopping a book leaves no Log Entry and no Reading list item, and the book leaves the Library", async ({
  loggedInApi,
}) => {
  const mediaItem = await tyhrolovy(loggedInApi);
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: mediaItem.id }), 201);
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: mediaItem.id }), 201);

  const stopped = await loggedInApi.inProgress.stop(mediaItem.id);

  expect(stopped.status()).toBe(204);
  const history = loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
  expect(await expectBody(history, 200, ItemHistoryResponse)).toEqual({
    mediaItem,
    logEntries: [],
    thoughts: [],
    currentRating: null,
    inBacklog: false,
    inProgress: null,
    about: { mediaType: "book", description: expect.stringMatching(/^Роман Івана Багряного/) },
  });
  expect(await bookLibrary(loggedInApi)).toEqual([]);
});

test("a book's page says since when it is In Progress, and the start date can be changed or cleared", async ({
  loggedInApi,
}) => {
  const mediaItem = await tyhrolovy(loggedInApi);
  const startedAt = minutesAgo(5);
  await expectBody(
    loggedInApi.inProgress.start(
      { mediaItemId: mediaItem.id, startDate: "2026-10-12" },
      at(startedAt),
    ),
    201,
  );
  const inProgressOnPage = async () => {
    const history = loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
    return (await expectBody(history, 200, ItemHistoryResponse)).inProgress;
  };
  expect(await inProgressOnPage()).toEqual({
    startDate: "2026-10-12",
    createdAt: startedAt,
    progress: null,
  });

  const changed = loggedInApi.inProgress.updateStartDate(mediaItem.id, { startDate: "2026-09-30" });

  expect(await expectBody(changed)).toEqual({
    inProgress: { startDate: "2026-09-30", createdAt: startedAt, progress: null },
  });
  expect(await inProgressOnPage()).toEqual({
    startDate: "2026-09-30",
    createdAt: startedAt,
    progress: null,
  });

  const cleared = loggedInApi.inProgress.updateStartDate(mediaItem.id, { startDate: null });

  expect((await expectBody(cleared)).inProgress).toEqual({
    startDate: null,
    createdAt: startedAt,
    progress: null,
  });
});

test("a start date follows a Log Entry date's rules", async ({ loggedInApi }) => {
  const mediaItem = await tyhrolovy(loggedInApi);

  for (const [startDate, error] of [
    ["2999-01-01", "date_in_future"],
    ["1899-12-31", "date_too_early"],
    ["2026-02-30", "invalid_date"],
  ]) {
    const started = loggedInApi.inProgress.start({ mediaItemId: mediaItem.id, startDate });
    expect(await expectBody(started, 400), startDate).toEqual({ error });
  }
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: mediaItem.id }), 201);
  const changed = loggedInApi.inProgress.updateStartDate(mediaItem.id, { startDate: "2999-01-01" });
  expect(await expectBody(changed, 400)).toEqual({ error: "date_in_future" });
});

test("a book not In Progress can't be finished, stopped or have its start date changed", async ({
  loggedInApi,
}) => {
  const mediaItem = await tyhrolovy(loggedInApi);
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: mediaItem.id }), 201);

  const finished = loggedInApi.inProgress.finish(mediaItem.id, { rating: 4 });
  const stopped = loggedInApi.inProgress.stop(mediaItem.id);
  const changed = loggedInApi.inProgress.updateStartDate(mediaItem.id, { startDate: null });

  for (const response of [finished, stopped, changed]) {
    expect(await expectBody(response, 404)).toEqual({ error: "not_in_progress" });
  }
  const history = loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
  expect(await expectBody(history, 200, ItemHistoryResponse)).toMatchObject({
    logEntries: [],
    inBacklog: true,
  });
});

test("another User's book In Progress is theirs alone, and their Manual Media Item can't be started", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const mediaItem = await tyhrolovy(loggedInApi);
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: mediaItem.id }), 201);
  const theirs = await manualBook(otherUserClient, { title: "Доця" });

  const stopped = otherUserClient.inProgress.stop(mediaItem.id);
  const started = loggedInApi.inProgress.start({ mediaItemId: theirs.id });

  expect(await expectBody(stopped, 404)).toEqual({ error: "not_in_progress" });
  expect(await expectBody(started, 400)).toEqual({ error: "unknown_media_item" });
  expect(await bookLibrary(otherUserClient)).toEqual([]);
  expect((await bookLibrary(loggedInApi)).map((item) => item.inProgress)).toEqual([
    expect.objectContaining({ startDate: null }),
  ]);
});

test("a film can't be started, as a film has no In Progress, and stays on the Watchlist", async ({
  loggedInApi,
}) => {
  const film = await alien(loggedInApi);
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: film.id }), 201);

  const started = loggedInApi.inProgress.start({ mediaItemId: film.id });

  expect(await expectBody(started, 400)).toEqual({ error: "not_progressable" });
  const library = loggedInApi.library.getLibrary({ mediaType: "film" });
  expect((await expectBody(library, 200, LibraryResponse)).items).toEqual([
    { mediaItem: film, backlog: { addedAt: expect.any(String) }, inProgress: null, log: null },
  ]);
});

// A book's Progress: the page the User is on and, if they give it, how many pages their edition
// has. Both are the User's own, so a catalog-backed book and a Manual Media Item follow one rule.

// A book from the catalog and one the User added by hand.
async function twoBooks(api: ApiClient) {
  return [await tyhrolovy(api), await manualBook(api, { title: "Доця", year: 2019 })];
}

test("a book can be started at a page, with or without the page count, and the Library carries it", async ({
  loggedInApi,
}) => {
  const [catalogBook, ownBook] = await twoBooks(loggedInApi);

  const started = loggedInApi.inProgress.start({
    mediaItemId: catalogBook.id,
    progress: bookProgress(142, 380),
  });
  const startedOwn = loggedInApi.inProgress.start({
    mediaItemId: ownBook.id,
    progress: bookProgress(12),
  });

  expect((await expectBody(started, 201, NewInProgressResponse)).inProgress).toMatchObject({
    progress: { mediaType: "book", page: 142, pageCount: 380 },
  });
  expect((await expectBody(startedOwn, 201)).inProgress.progress).toEqual({
    mediaType: "book",
    page: 12,
  });
  const progressOf = new Map(
    (await bookLibrary(loggedInApi)).map((item) => [item.mediaItem.id, item.inProgress?.progress]),
  );
  expect(progressOf.get(catalogBook.id)).toEqual(bookProgress(142, 380));
  expect(progressOf.get(ownBook.id)).toEqual(bookProgress(12));
});

test("a book's page and page count can be changed, the page count dropped, and both cleared", async ({
  loggedInApi,
}) => {
  for (const mediaItem of await twoBooks(loggedInApi)) {
    await expectBody(
      loggedInApi.inProgress.start({ mediaItemId: mediaItem.id, startDate: "2026-10-12" }),
      201,
    );
    const progressOnPage = async () => {
      const history = loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
      return (await expectBody(history, 200, ItemHistoryResponse)).inProgress?.progress;
    };

    const changed = loggedInApi.inProgress.update(mediaItem.id, {
      progress: bookProgress(88, 272),
    });

    expect((await expectBody(changed, 200, InProgressResponse)).inProgress).toMatchObject({
      startDate: "2026-10-12",
      progress: bookProgress(88, 272),
    });
    expect(await progressOnPage()).toEqual(bookProgress(88, 272));

    // The last page changes nothing else: the book is still In Progress.
    const lastPage = loggedInApi.inProgress.update(mediaItem.id, {
      progress: bookProgress(272, 272),
    });
    expect((await expectBody(lastPage)).inProgress.progress).toEqual(bookProgress(272, 272));

    const pageOnly = loggedInApi.inProgress.update(mediaItem.id, { progress: bookProgress(140) });
    expect((await expectBody(pageOnly)).inProgress.progress).toEqual(bookProgress(140));

    const dated = loggedInApi.inProgress.update(mediaItem.id, { startDate: "2026-10-01" });
    expect((await expectBody(dated)).inProgress.progress).toEqual(bookProgress(140));

    const cleared = loggedInApi.inProgress.update(mediaItem.id, { progress: null });
    expect((await expectBody(cleared)).inProgress).toMatchObject({
      startDate: "2026-10-01",
      progress: null,
    });
    expect(await progressOnPage()).toBeNull();
  }
});

test("a book's page out of range, past the page count, or a series' Progress is refused, and it stays as it was", async ({
  loggedInApi,
}) => {
  const [mediaItem, ownBook] = await twoBooks(loggedInApi);
  const kept = bookProgress(50, 300);
  await expectBody(
    loggedInApi.inProgress.start({ mediaItemId: mediaItem.id, progress: kept }),
    201,
  );
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: ownBook.id }), 201);

  for (const [refused, error] of [
    [bookProgress(-1), "invalid_progress"],
    [bookProgress(100_001), "invalid_progress"],
    [bookProgress(12.5), "invalid_progress"],
    [bookProgress(1, 0), "invalid_progress"],
    [bookProgress(1, 100_001), "invalid_progress"],
    [bookProgress(381, 380), "invalid_progress"],
    [{ mediaType: "series", season: 1, episode: 2 }, "progress_mismatch"],
    [{ mediaType: "book" }, "invalid_request"],
    [{ mediaType: "book", page: "142" }, "invalid_request"],
  ] as const) {
    const changed = loggedInApi.inProgress.update(mediaItem.id, { progress: refused as never });
    expect(await expectBody(changed, 400), JSON.stringify(refused)).toEqual({ error });
  }
  const pastLastPage = loggedInApi.inProgress.update(ownBook.id, {
    progress: bookProgress(312, 272),
  });
  expect(await expectBody(pastLastPage, 400)).toEqual({ error: "invalid_progress" });
  const history = loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
  expect((await expectBody(history, 200, ItemHistoryResponse)).inProgress?.progress).toEqual(kept);
});

test("a book can't be started past its last page, nor a series at a page, and neither is started", async ({
  loggedInApi,
}) => {
  const [book, series] = [await tyhrolovy(loggedInApi), await chernobyl(loggedInApi)];

  const bookStart = loggedInApi.inProgress.start({
    mediaItemId: book.id,
    progress: bookProgress(400, 380),
  });
  const seriesStart = loggedInApi.inProgress.start({
    mediaItemId: series.id,
    progress: bookProgress(12),
  });

  expect(await expectBody(bookStart, 400)).toEqual({ error: "invalid_progress" });
  expect(await expectBody(seriesStart, 400)).toEqual({ error: "progress_mismatch" });
  for (const { id } of [book, series]) {
    const history = loggedInApi.catalog.getMediaItemHistory(id);
    expect((await expectBody(history, 200, ItemHistoryResponse)).inProgress).toBeNull();
  }
});

test("finishing or stopping a book leaves no Progress, and starting it again starts with none", async ({
  loggedInApi,
}) => {
  const [finished, stopped] = [await tyhrolovy(loggedInApi), await kafkaOnTheShore(loggedInApi)];
  for (const { id } of [finished, stopped]) {
    const progress = bookProgress(380, 380);
    await expectBody(loggedInApi.inProgress.start({ mediaItemId: id, progress }), 201);
  }

  const { logEntry } = await expectBody(
    loggedInApi.inProgress.finish(finished.id, { rating: 4 }),
    201,
    NewLogEntryResponse,
  );
  expect((await loggedInApi.inProgress.stop(stopped.id)).status()).toBe(204);

  expect(Object.keys(logEntry)).not.toContain("progress");
  expect(await bookLibrary(loggedInApi)).toEqual([
    expect.objectContaining({ mediaItem: finished, inProgress: null }),
  ]);
  for (const { id } of [finished, stopped]) {
    const again = loggedInApi.inProgress.start({ mediaItemId: id });
    expect((await expectBody(again, 201)).inProgress.progress).toBeNull();
  }
});
