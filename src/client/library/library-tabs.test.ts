import { describe, expect, it } from "vitest";
import type { LibraryItem } from "../../shared/api";
import {
  backlogItems,
  experiencedItems,
  inProgressItems,
  libraryPath,
  libraryTabOfSlug,
  libraryTabsOf,
  libraryTile,
} from "./library-tabs";

let nextId = 1;

function item({
  addedAt,
  started,
  last,
  rating = 4,
}: {
  addedAt?: string;
  started?: { startDate: string | null; createdAt: string };
  last?: { date: string | null; createdAt: string };
  rating?: number;
}): LibraryItem {
  const id = nextId++;
  return {
    mediaItem: { id, mediaType: "film", externalReference: null, metadata: null },
    backlog: addedAt ? { addedAt } : null,
    inProgress: started ?? null,
    log: last ? { currentRating: rating, lastLogEntry: last } : null,
  };
}

const ids = (items: LibraryItem[]) => items.map((libraryItem) => libraryItem.mediaItem.id);

describe("the Backlog tab", () => {
  it("holds the films in the Backlog, the latest added first", () => {
    const older = item({ addedAt: "2026-10-01T10:00:00.000Z" });
    const logged = item({ last: { date: null, createdAt: "2026-10-05T10:00:00.000Z" } });
    const newer = item({ addedAt: "2026-10-03T10:00:00.000Z" });

    expect(ids(backlogItems([older, logged, newer]))).toEqual(ids([newer, older]));
  });

  it("keeps a film logged and planned again", () => {
    const rewatch = item({
      addedAt: "2026-10-01T10:00:00.000Z",
      last: { date: "2026-09-01", createdAt: "2026-09-01T10:00:00.000Z" },
    });

    expect(ids(backlogItems([rewatch]))).toEqual(ids([rewatch]));
  });
});

describe("the In Progress tab", () => {
  it("holds the Media Items In Progress, the latest started first, by start date then when marked", () => {
    const planned = item({ addedAt: "2026-10-01T10:00:00.000Z" });
    const october = item({
      started: { startDate: "2026-10-12", createdAt: "2026-11-01T10:00:00.000Z" },
    });
    const november = item({
      started: { startDate: "2026-11-03", createdAt: "2026-11-03T10:00:00.000Z" },
    });
    // With no start date, the day it was marked In Progress stands in for one.
    const undated = item({ started: { startDate: null, createdAt: "2026-10-20T10:00:00.000Z" } });
    const sameDay = item({
      started: { startDate: "2026-11-03", createdAt: "2026-11-03T12:00:00.000Z" },
    });

    expect(ids(inProgressItems([planned, october, undated, november, sameDay]))).toEqual(
      ids([sameDay, november, undated, october]),
    );
  });
});

describe("the experienced tab", () => {
  it("holds the logged films, the last experienced first, by their last Log Entry in Log Order", () => {
    const planned = item({ addedAt: "2026-10-01T10:00:00.000Z" });
    const september = item({ last: { date: "2026-09-20", createdAt: "2026-10-06T10:00:00.000Z" } });
    const october = item({ last: { date: "2026-10-02", createdAt: "2026-10-02T10:00:00.000Z" } });
    // Undated entries come first in Log Order, so before any dated one.
    const undated = item({ last: { date: null, createdAt: "2026-10-07T10:00:00.000Z" } });

    expect(ids(experiencedItems([planned, september, undated, october]))).toEqual(
      ids([october, september, undated]),
    );
  });

  it("puts the one logged later first among films watched the same day", () => {
    const first = item({ last: { date: "2026-10-02", createdAt: "2026-10-02T18:00:00.000Z" } });
    const second = item({ last: { date: "2026-10-02", createdAt: "2026-10-02T21:00:00.000Z" } });

    expect(ids(experiencedItems([first, second]))).toEqual(ids([second, first]));
  });
});

describe("a Media Type's tile in Saved", () => {
  it("counts both tabs, a film planned again for a rewatch in each", () => {
    const planned = item({ addedAt: "2026-10-01T10:00:00.000Z" });
    const watched = item({ last: { date: "2026-09-01", createdAt: "2026-09-01T10:00:00.000Z" } });
    const rewatch = item({
      addedAt: "2026-10-02T10:00:00.000Z",
      last: { date: "2026-08-01", createdAt: "2026-08-01T10:00:00.000Z" },
    });

    expect(libraryTile([planned, watched, rewatch]).counts).toEqual({
      backlog: 2,
      inProgress: 0,
      experienced: 2,
    });
  });

  it("counts the Media Items In Progress, and lists them as their tab orders them", () => {
    const first = item({
      started: { startDate: "2026-10-12", createdAt: "2026-10-12T10:00:00.000Z" },
    });
    const second = item({
      started: { startDate: "2026-11-03", createdAt: "2026-11-03T10:00:00.000Z" },
    });
    const tile = libraryTile([first, second]);

    expect(tile.counts.inProgress).toBe(2);
    expect(tile.empty).toBe(false);
    expect(ids(tile.inProgress)).toEqual(ids([second, first]));
  });

  it("fans out the three films added to the Backlog last, the latest first", () => {
    const added = (day: string) => item({ addedAt: `2026-10-${day}T10:00:00.000Z` });
    const first = added("01");
    const second = added("02");
    const third = added("03");
    const fourth = added("04");
    const fifth = added("05");
    const covers = (items: LibraryItem[]) => libraryTile(items).covers.map(({ id }) => id);

    expect(covers([first, fourth, second, fifth, third])).toEqual(ids([fifth, fourth, third]));
    expect(covers([first])).toEqual(ids([first]));
  });

  it("is empty only while both tabs are", () => {
    const planned = item({ addedAt: "2026-10-01T10:00:00.000Z" });
    const watched = item({ last: { date: "2026-09-01", createdAt: "2026-09-01T10:00:00.000Z" } });

    expect(libraryTile([]).empty).toBe(true);
    expect(libraryTile([planned]).empty).toBe(false);
    expect(libraryTile([watched]).empty).toBe(false);
  });

  it("fans out no logged film, so a Library with nothing planned has no covers", () => {
    const watched = item({ last: { date: "2026-09-01", createdAt: "2026-09-01T10:00:00.000Z" } });

    expect(libraryTile([watched]).covers).toEqual([]);
  });
});

describe("a tab's address", () => {
  it("uses the UI's words for a film's tabs", () => {
    expect(libraryPath("film", "backlog")).toBe("/saved/films/watchlist");
    expect(libraryPath("film", "experienced")).toBe("/saved/films/watched");
  });

  it("uses the UI's words for a book's tabs", () => {
    expect(libraryPath("book", "backlog")).toBe("/saved/books/reading-list");
    expect(libraryPath("book", "experienced")).toBe("/saved/books/read");
  });

  it("names the tab it was made for", () => {
    expect(libraryTabOfSlug("film", "watchlist")).toBe("backlog");
    expect(libraryTabOfSlug("film", "watched")).toBe("experienced");
    expect(libraryTabOfSlug("film", "backlog")).toBeNull();
    expect(libraryTabOfSlug("book", "reading-list")).toBe("backlog");
  });

  it("names no tab by another Media Type's word", () => {
    expect(libraryTabOfSlug("book", "watchlist")).toBeNull();
    expect(libraryTabOfSlug("film", "reading-list")).toBeNull();
  });
});

describe("a Media Type's tabs", () => {
  it("are the Backlog and what was experienced, for films", () => {
    expect(libraryTabsOf("film")).toEqual(["backlog", "experienced"]);
  });

  it("are the Reading list, Reading and Read, for books", () => {
    expect(libraryTabsOf("book")).toEqual(["backlog", "inProgress", "experienced"]);
    expect(libraryTabOfSlug("book", "read")).toBe("experienced");
    expect(libraryTabOfSlug("book", "reading")).toBe("inProgress");
    expect(libraryPath("book", "inProgress")).toBe("/saved/books/reading");
  });

  it("have no In Progress tab for films", () => {
    expect(libraryTabOfSlug("film", "reading")).toBeNull();
    expect(libraryTabOfSlug("film", "watching")).toBeNull();
  });
});
