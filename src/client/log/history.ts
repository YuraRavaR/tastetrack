import type { LogEntry, Thought } from "../../shared/api";
import { inLogOrder } from "../../shared/log";

// One row of a Media Item's History: a Log Entry or a Thought.
export type HistoryItem =
  | { kind: "logEntry"; logEntry: LogEntry }
  | { kind: "thought"; thought: Thought };

// A Media Item's History, newest first: its Log Entries, which keep their Log Order, and its
// Thoughts, each by its date. On the same day a Log Entry and a Thought go by creation time, and
// undated Log Entries stay at the bottom. Log Order already sorts dated rows this way, and every
// Thought has a date, so the two merge in Log Order.
export function historyNewestFirst(
  logEntries: readonly LogEntry[],
  thoughts: readonly Thought[],
): HistoryItem[] {
  const rows = [
    ...logEntries.map((logEntry) => ({
      item: { kind: "logEntry", logEntry } as const,
      ...logEntry,
    })),
    ...thoughts.map((thought) => ({ item: { kind: "thought", thought } as const, ...thought })),
  ].map((row) => ({ ...row, createdAt: new Date(row.createdAt) }));
  return inLogOrder(rows)
    .map((row) => row.item)
    .toReversed();
}
