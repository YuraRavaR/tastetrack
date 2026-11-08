import { describe, expect, it } from "vitest";
import type { LibraryItem } from "../../shared/api";
import { watched, watchlist } from "./library-tabs";

let nextId = 1;

function item({
  addedAt,
  last,
  rating = 4,
}: {
  addedAt?: string;
  last?: { date: string | null; createdAt: string };
  rating?: number;
}): LibraryItem {
  const id = nextId++;
  return {
    mediaItem: { id, mediaType: "film", externalReference: null, metadata: null },
    backlog: addedAt ? { addedAt } : null,
    log: last ? { currentRating: rating, lastLogEntry: last } : null,
  };
}

const ids = (items: LibraryItem[]) => items.map((libraryItem) => libraryItem.mediaItem.id);

describe("the Watchlist tab", () => {
  it("holds the films in the Backlog, the latest added first", () => {
    const older = item({ addedAt: "2026-10-01T10:00:00.000Z" });
    const logged = item({ last: { date: null, createdAt: "2026-10-05T10:00:00.000Z" } });
    const newer = item({ addedAt: "2026-10-03T10:00:00.000Z" });

    expect(ids(watchlist([older, logged, newer]))).toEqual(ids([newer, older]));
  });

  it("keeps a film logged and planned again", () => {
    const rewatch = item({
      addedAt: "2026-10-01T10:00:00.000Z",
      last: { date: "2026-09-01", createdAt: "2026-09-01T10:00:00.000Z" },
    });

    expect(ids(watchlist([rewatch]))).toEqual(ids([rewatch]));
  });
});

describe("the Watched tab", () => {
  it("holds the logged films, the last watched first, by their last Log Entry in Log Order", () => {
    const planned = item({ addedAt: "2026-10-01T10:00:00.000Z" });
    const september = item({ last: { date: "2026-09-20", createdAt: "2026-10-06T10:00:00.000Z" } });
    const october = item({ last: { date: "2026-10-02", createdAt: "2026-10-02T10:00:00.000Z" } });
    // Undated entries come first in Log Order, so before any dated one.
    const undated = item({ last: { date: null, createdAt: "2026-10-07T10:00:00.000Z" } });

    expect(ids(watched([planned, september, undated, october]))).toEqual(
      ids([october, september, undated]),
    );
  });

  it("puts the one logged later first among films watched the same day", () => {
    const first = item({ last: { date: "2026-10-02", createdAt: "2026-10-02T18:00:00.000Z" } });
    const second = item({ last: { date: "2026-10-02", createdAt: "2026-10-02T21:00:00.000Z" } });

    expect(ids(watched([first, second]))).toEqual(ids([second, first]));
  });
});
