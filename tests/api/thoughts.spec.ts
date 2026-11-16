import { ItemHistoryResponse, type NewThoughtRequest, ThoughtResponse } from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import { expect, test } from "../support/fixtures";
import { bookProgress, tyhrolovy } from "../support/scenarios/books";
import { alien, manualFilm } from "../support/scenarios/films";
import { chernobyl } from "../support/scenarios/series";

// Thoughts: a User's own dated notes and quotes on a Media Item, in its Item History.

async function keepThought(api: ApiClient, mediaItemId: number, thought: NewThoughtRequest) {
  return (await expectBody(api.thoughts.createThought(mediaItemId, thought), 201)).thought;
}

async function thoughtsOn(api: ApiClient, mediaItemId: number) {
  return (await expectBody(api.catalog.getMediaItemHistory(mediaItemId))).thoughts;
}

const mediaItemsOfEveryKind = {
  film: alien,
  book: tyhrolovy,
  series: chernobyl,
  "Manual Media Item": (api: ApiClient) => manualFilm(api, { title: "Home video" }),
};

for (const [kind, mediaItemOf] of Object.entries(mediaItemsOfEveryKind)) {
  test(`a Thought on a ${kind} can be kept, changed and deleted, and shows in its Item History`, async ({
    loggedInApi,
  }) => {
    const mediaItem = await mediaItemOf(loggedInApi);
    const keptAt = minutesAgo(5);

    const created = loggedInApi.thoughts.createThought(
      mediaItem.id,
      { text: "  Olena says it's her favourite.  ", date: "2026-11-10" },
      at(keptAt),
    );

    const thought = {
      id: expect.any(Number),
      mediaItemId: mediaItem.id,
      text: "Olena says it's her favourite.",
      date: "2026-11-10",
      quote: false,
      progress: null,
      state: "none",
      createdAt: keptAt,
    };
    expect(await expectBody(created, 201, ThoughtResponse)).toEqual({ thought });
    const history = loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
    const { thoughts } = await expectBody(history, 200, ItemHistoryResponse);
    expect(thoughts).toEqual([thought]);
    const id = thoughts[0]?.id ?? 0;

    const edited = loggedInApi.thoughts.updateThought(id, {
      text: "In space no one can hear you scream.",
      date: "2026-11-12",
      quote: true,
    });

    const changed = {
      ...thought,
      id,
      text: "In space no one can hear you scream.",
      date: "2026-11-12",
      quote: true,
    };
    expect(await expectBody(edited, 200, ThoughtResponse)).toEqual({ thought: changed });
    expect(await thoughtsOn(loggedInApi, mediaItem.id)).toEqual([changed]);

    const deleted = await loggedInApi.thoughts.deleteThought(id);

    expect(deleted.status()).toBe(204);
    expect(await thoughtsOn(loggedInApi, mediaItem.id)).toEqual([]);
  });
}

test("a Thought alone leaves the Media Item out of the Library and its Backlog", async ({
  loggedInApi,
}) => {
  const film = await alien(loggedInApi);

  await keepThought(loggedInApi, film.id, { text: "Before I watch.", date: "2026-11-10" });

  const { items } = await expectBody(loggedInApi.library.getLibrary({ mediaType: "film" }));
  expect(items).toEqual([]);
  const history = await expectBody(loggedInApi.catalog.getMediaItemHistory(film.id));
  expect(history).toMatchObject({ logEntries: [], inBacklog: false, inProgress: null });
});

test("a Thought's text is 1 to 2,000 characters once trimmed", async ({ loggedInApi }) => {
  const film = await alien(loggedInApi);

  for (const text of ["", "   \n ", "a".repeat(2_001)]) {
    const refused = loggedInApi.thoughts.createThought(film.id, { text, date: "2026-11-10" });
    expect(await expectBody(refused, 400), `${text.length} characters`).toEqual({
      error: "invalid_request",
    });
  }
  const longest = await keepThought(loggedInApi, film.id, {
    text: `${"a".repeat(2_000)}  `,
    date: "2026-11-10",
  });
  expect(longest.text).toHaveLength(2_000);
  const emptied = loggedInApi.thoughts.updateThought(longest.id, { text: " " });
  expect(await expectBody(emptied, 400)).toEqual({ error: "invalid_request" });
});

test("a Thought's date follows a Log Entry date's rules, and is always given", async ({
  loggedInApi,
}) => {
  const film = await alien(loggedInApi);
  const refusals = [
    { date: "2026-02-30", error: "invalid_date" },
    { date: "1899-12-31", error: "date_too_early" },
    { date: "2999-01-01", error: "date_in_future" },
  ];

  for (const { date, error } of refusals) {
    const refused = loggedInApi.thoughts.createThought(film.id, { text: "Hm.", date });
    expect(await expectBody(refused, 400), date).toEqual({ error });
  }
  const undated = loggedInApi.thoughts.createThought(film.id, { text: "Hm." } as never);
  expect(await expectBody(undated, 400)).toEqual({ error: "invalid_request" });
  const thought = await keepThought(loggedInApi, film.id, { text: "Hm.", date: "1900-01-01" });
  const moved = loggedInApi.thoughts.updateThought(thought.id, { date: "2999-01-01" });
  expect(await expectBody(moved, 400)).toEqual({ error: "date_in_future" });
});

test("a Media Item holds at most 500 of a User's Thoughts", async ({
  loggedInApi,
  loggedInUser,
  otherUserClient,
}) => {
  const film = await alien(loggedInApi);
  const filled = loggedInApi.testHooks.fillThoughts(loggedInUser.username, film.id, 499);
  expect((await filled).status()).toBe(204);

  await keepThought(loggedInApi, film.id, { text: "The 500th.", date: "2026-11-10" });
  const refused = loggedInApi.thoughts.createThought(film.id, {
    text: "The 501st.",
    date: "2026-11-10",
  });

  expect(await expectBody(refused, 409)).toEqual({ error: "too_many_thoughts" });
  expect(await thoughtsOn(loggedInApi, film.id)).toHaveLength(500);
  // The limit is each User's own.
  await keepThought(otherUserClient, film.id, { text: "My first.", date: "2026-11-10" });
});

test("a Thought is written in the state the Media Item is in: Planned, Experienced or none", async ({
  loggedInApi,
}) => {
  const film = await alien(loggedInApi);
  const thought = { text: "Hm.", date: "2026-11-10" };

  const none = await keepThought(loggedInApi, film.id, thought);
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: film.id }), 201);
  const planned = await keepThought(loggedInApi, film.id, thought);
  await expectBody(loggedInApi.log.createLogEntry({ mediaItemId: film.id, rating: 4 }), 201);
  const experienced = await keepThought(loggedInApi, film.id, thought);

  expect([none.state, planned.state, experienced.state]).toEqual([
    "none",
    "planned",
    "experienced",
  ]);
});

test("a Thought on a book In Progress is written while reading, even after an earlier Reading", async ({
  loggedInApi,
}) => {
  const book = await tyhrolovy(loggedInApi);
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: book.id }), 201);
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: book.id }), 201);
  const thought = { text: "Hm.", date: "2026-11-10" };

  const firstReading = await keepThought(loggedInApi, book.id, thought);
  await expectBody(loggedInApi.inProgress.finish(book.id, { rating: 4 }), 201);
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: book.id }), 201);
  const reread = await keepThought(loggedInApi, book.id, thought);

  expect([firstReading.state, reread.state]).toEqual(["in_progress", "in_progress"]);
});

test("changing a Thought keeps the state it was written in", async ({ loggedInApi }) => {
  const film = await alien(loggedInApi);
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: film.id }), 201);
  const thought = await keepThought(loggedInApi, film.id, { text: "Hm.", date: "2026-11-10" });
  await expectBody(loggedInApi.log.createLogEntry({ mediaItemId: film.id, rating: 4 }), 201);

  const edited = loggedInApi.thoughts.updateThought(thought.id, { text: "Hm, hm." });

  expect((await expectBody(edited, 200)).thought).toMatchObject({
    text: "Hm, hm.",
    state: "planned",
  });
});

test("a Thought keeps the Progress it is given, in its Media Type's shape, and it can be cleared", async ({
  loggedInApi,
}) => {
  const book = await tyhrolovy(loggedInApi);
  const series = await chernobyl(loggedInApi);

  const onBook = await keepThought(loggedInApi, book.id, {
    text: "Words from the book.",
    date: "2026-11-10",
    quote: true,
    progress: bookProgress(142, 272),
  });
  const onSeries = await keepThought(loggedInApi, series.id, {
    text: "Season 2 drags.",
    date: "2026-11-10",
    progress: { mediaType: "series", season: 2, episode: 5 },
  });

  expect(onBook).toMatchObject({ quote: true, progress: bookProgress(142, 272) });
  expect(onSeries.progress).toEqual({ mediaType: "series", season: 2, episode: 5 });
  const moved = loggedInApi.thoughts.updateThought(onBook.id, { progress: bookProgress(17) });
  expect((await expectBody(moved, 200)).thought.progress).toEqual(bookProgress(17));
  const cleared = loggedInApi.thoughts.updateThought(onBook.id, { progress: null });
  expect((await expectBody(cleared, 200)).thought.progress).toBeNull();
});

test("a Progress of the wrong shape is refused", async ({ loggedInApi }) => {
  const film = await alien(loggedInApi);
  const book = await tyhrolovy(loggedInApi);
  const episode = { mediaType: "series", season: 2, episode: 5 } as const;
  const refusals = [
    { mediaItemId: film.id, progress: bookProgress(3), error: "progress_mismatch" },
    { mediaItemId: book.id, progress: episode, error: "progress_mismatch" },
    { mediaItemId: book.id, progress: bookProgress(300, 272), error: "invalid_progress" },
    { mediaItemId: book.id, progress: bookProgress(-1), error: "invalid_progress" },
  ];

  for (const { mediaItemId, progress, error } of refusals) {
    const thought = { text: "Hm.", date: "2026-11-10", progress };
    const refused = loggedInApi.thoughts.createThought(mediaItemId, thought);
    expect(await expectBody(refused, 400), JSON.stringify(progress)).toEqual({ error });
  }
  const kept = await keepThought(loggedInApi, book.id, { text: "Hm.", date: "2026-11-10" });
  const moved = loggedInApi.thoughts.updateThought(kept.id, { progress: episode });
  expect(await expectBody(moved, 400)).toEqual({ error: "progress_mismatch" });
  expect(await thoughtsOn(loggedInApi, film.id)).toEqual([]);
});

test("a Media Item's Thoughts are in date order, with creation time breaking ties", async ({
  loggedInApi,
}) => {
  const film = await alien(loggedInApi);
  const keep = (text: string, date: string, minutes: number) => {
    const created = loggedInApi.thoughts.createThought(
      film.id,
      { text, date },
      at(minutesAgo(minutes)),
    );
    return expectBody(created, 201);
  };
  await keep("Later that day", "2026-11-10", 1);
  await keep("Earlier day", "2026-11-09", 2);
  await keep("Same day, first", "2026-11-10", 3);

  const thoughts = await thoughtsOn(loggedInApi, film.id);

  expect(thoughts.map((thought: { text: string }) => thought.text)).toEqual([
    "Earlier day",
    "Same day, first",
    "Later that day",
  ]);
});

test("another User's Thought is unknown, and their Item History never shows it", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const film = await alien(loggedInApi);
  const manual = await manualFilm(loggedInApi, { title: "Home video" });
  const thought = await keepThought(loggedInApi, film.id, { text: "Mine.", date: "2026-11-10" });

  const edited = otherUserClient.thoughts.updateThought(thought.id, { text: "Theirs." });
  const deleted = otherUserClient.thoughts.deleteThought(thought.id);
  const onManual = otherUserClient.thoughts.createThought(manual.id, {
    text: "Theirs.",
    date: "2026-11-10",
  });

  expect(await expectBody(edited, 404)).toEqual({ error: "unknown_thought" });
  expect(await expectBody(deleted, 404)).toEqual({ error: "unknown_thought" });
  expect(await expectBody(onManual, 404)).toEqual({ error: "unknown_media_item" });
  expect(await thoughtsOn(otherUserClient, film.id)).toEqual([]);
  expect(await thoughtsOn(loggedInApi, film.id)).toEqual([thought]);
});

test("a Share Link and the Library never carry a Thought", async ({
  loggedInApi,
  createApiClient,
}) => {
  const film = await alien(loggedInApi);
  const { list } = await expectBody(
    loggedInApi.lists.createList({ name: "Space horror", mediaType: "film" }),
    201,
  );
  await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId: film.id }), 201);
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: film.id }), 201);
  await keepThought(loggedInApi, film.id, { text: "My secret thought.", date: "2026-11-10" });
  const { shareLink } = await expectBody(loggedInApi.lists.createShareLink(list.id), 201);
  const visitor = await createApiClient();

  // Each body, with something it does show.
  const bodies = [
    [await (await visitor.sharedLists.getSharedList(shareLink.token)).text(), "Alien"],
    [await (await visitor.sharedLists.getSharedListPage(shareLink.token)).text(), "Space horror"],
    [await (await loggedInApi.library.getLibrary({ mediaType: "film" })).text(), "Alien"],
  ];

  for (const [body, shown] of bodies) {
    expect(body).toContain(shown);
    expect(body).not.toContain("My secret thought.");
  }
});

test("Thoughts stay through Abandon, leaving the Backlog and deleting a Log Entry", async ({
  loggedInApi,
}) => {
  const book = await tyhrolovy(loggedInApi);
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: book.id }), 201);
  const planned = await keepThought(loggedInApi, book.id, { text: "Why.", date: "2026-11-01" });
  expect((await loggedInApi.backlog.deleteBacklogItem(book.id)).status()).toBe(204);
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: book.id }), 201);
  const reading = await keepThought(loggedInApi, book.id, { text: "Hm.", date: "2026-11-02" });
  expect((await loggedInApi.inProgress.stop(book.id)).status()).toBe(204);
  const { logEntry } = await expectBody(
    loggedInApi.log.createLogEntry({ mediaItemId: book.id, rating: 3 }),
    201,
  );
  const read = await keepThought(loggedInApi, book.id, { text: "So.", date: "2026-11-03" });

  expect((await loggedInApi.log.deleteLogEntry(logEntry.id)).status()).toBe(204);

  expect(await thoughtsOn(loggedInApi, book.id)).toEqual([planned, reading, read]);
});

test("deleting a Manual Media Item deletes its Thoughts", async ({ loggedInApi }) => {
  const manual = await manualFilm(loggedInApi, { title: "Home video" });
  const thought = await keepThought(loggedInApi, manual.id, { text: "Hm.", date: "2026-11-10" });
  const records = { thoughts: [thought.id] };
  expect(await expectBody(loggedInApi.testHooks.getStoredRecords(records))).toMatchObject(records);

  expect((await loggedInApi.catalog.deleteManualMediaItem(manual.id)).status()).toBe(204);

  expect(await expectBody(loggedInApi.testHooks.getStoredRecords(records))).toMatchObject({
    thoughts: [],
  });
});

test("Thoughts need a session", async ({ api }) => {
  const thought = { text: "Hm.", date: "2026-11-10" };
  expect((await api.thoughts.createThought(1, thought)).status()).toBe(401);
  expect((await api.thoughts.updateThought(1, { text: "Hm." })).status()).toBe(401);
  expect((await api.thoughts.deleteThought(1)).status()).toBe(401);
});

// ADR-0009: a page loads in a fixed number of D1 queries, however much it holds.
test("an Item History loads in the same number of queries for 1 Thought as for 20", async ({
  loggedInApi,
  loggedInUser,
  otherUserClient,
}) => {
  const film = await alien(loggedInApi);
  await keepThought(loggedInApi, film.id, { text: "One.", date: "2026-11-10" });
  await keepThought(otherUserClient, film.id, { text: "One.", date: "2026-11-10" });
  const filled = loggedInApi.testHooks.fillThoughts(loggedInUser.username, film.id, 19);
  expect((await filled).status()).toBe(204);
  const queriesFor = async (api: ApiClient, count: number) => {
    const response = await api.catalog.getMediaItemHistory(film.id);
    expect(await response.json()).toMatchObject({ thoughts: { length: count } });
    return response.headers()["x-d1-query-count"];
  };

  const one = await queriesFor(otherUserClient, 1);
  const twenty = await queriesFor(loggedInApi, 20);

  expect(one).toMatch(/^\d+$/);
  expect(twenty).toBe(one);
});
