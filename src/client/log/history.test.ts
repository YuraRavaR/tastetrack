import { describe, expect, it } from "vitest";
import type { LogEntry, MediaItem, Thought } from "../../shared/api";
import { historyNewestFirst } from "./history";

const mediaItem = { id: 1 } as MediaItem;

function logEntry(id: number, date: string | null, createdAt: string): LogEntry {
  return { id, mediaItem, rating: 4, date, review: null, revisit: false, createdAt };
}

function thought(id: number, date: string, createdAt: string): Thought {
  return {
    id,
    mediaItemId: 1,
    text: `Thought ${id}`,
    date,
    quote: false,
    progress: null,
    state: "none",
    createdAt,
  };
}

// Each row as "entry 3" or "thought 7", top to bottom.
function rows(logEntries: LogEntry[], thoughts: Thought[]): string[] {
  return historyNewestFirst(logEntries, thoughts).map((item) =>
    item.kind === "logEntry" ? `entry ${item.logEntry.id}` : `thought ${item.thought.id}`,
  );
}

describe("a Media Item's History", () => {
  it("puts each Thought among the Log Entries by its date, newest first", () => {
    const entries = [
      logEntry(1, "2024-02-02", "2024-02-02T20:00:00Z"),
      logEntry(2, "2026-10-01", "2026-10-01T20:00:00Z"),
    ];
    const thoughts = [
      thought(7, "2024-01-10", "2024-01-10T09:00:00Z"),
      thought(8, "2024-02-04", "2024-02-04T09:00:00Z"),
      thought(9, "2026-11-15", "2026-11-15T09:00:00Z"),
    ];

    expect(rows(entries, thoughts)).toEqual([
      "thought 9",
      "entry 2",
      "thought 8",
      "entry 1",
      "thought 7",
    ]);
  });

  it("orders a Log Entry and a Thought of the same day by when they were made", () => {
    const entries = [logEntry(1, "2026-11-10", "2026-11-10T20:00:00Z")];
    const thoughts = [
      thought(7, "2026-11-10", "2026-11-10T09:00:00Z"),
      thought(8, "2026-11-10", "2026-11-10T21:00:00Z"),
    ];

    expect(rows(entries, thoughts)).toEqual(["thought 8", "entry 1", "thought 7"]);
  });

  it("keeps undated Log Entries at the bottom, below every Thought", () => {
    const entries = [
      logEntry(1, null, "2026-11-12T20:00:00Z"),
      logEntry(2, "2026-11-01", "2026-11-01T20:00:00Z"),
    ];
    const thoughts = [thought(7, "1990-05-01", "2026-11-13T09:00:00Z")];

    expect(rows(entries, thoughts)).toEqual(["entry 2", "thought 7", "entry 1"]);
  });

  it("is empty with neither", () => {
    expect(rows([], [])).toEqual([]);
  });
});
