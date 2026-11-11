import {
  ItemHistoryResponse,
  LibraryResponse,
  NewInProgressResponse,
  NewLogEntryResponse,
} from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import { expect, test } from "../support/fixtures";
import { kafkaOnTheShore, manualBook, tyhrolovy } from "../support/scenarios/books";

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
    inProgress: { startDate: "2026-10-12", createdAt: startedAt },
    removedFromBacklog: { position: 1, note: "Olena's copy" },
  });
  expect(await bookLibrary(loggedInApi)).toEqual(
    expect.arrayContaining([
      {
        mediaItem,
        backlog: null,
        inProgress: { startDate: "2026-10-12", createdAt: startedAt },
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
    currentRating: 4.5,
    inBacklog: false,
    inProgress: null,
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
    currentRating: null,
    inBacklog: false,
    inProgress: null,
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
  expect(await inProgressOnPage()).toEqual({ startDate: "2026-10-12", createdAt: startedAt });

  const changed = loggedInApi.inProgress.updateStartDate(mediaItem.id, { startDate: "2026-09-30" });

  expect(await expectBody(changed)).toEqual({
    inProgress: { startDate: "2026-09-30", createdAt: startedAt },
  });
  expect(await inProgressOnPage()).toEqual({ startDate: "2026-09-30", createdAt: startedAt });

  const cleared = loggedInApi.inProgress.updateStartDate(mediaItem.id, { startDate: null });

  expect((await expectBody(cleared)).inProgress).toEqual({ startDate: null, createdAt: startedAt });
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
