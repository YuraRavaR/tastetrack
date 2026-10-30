// The Log's rules: Ratings, Log Entry dates, Log Order and the Current Rating. Pure functions with
// no I/O, shared by the Worker, which enforces them, and the client, which keeps input within them.

// A Rating is 0.5 to 5 stars in half-star steps, the same for every Media Type. It is stored as
// the number of half stars, 1 to 10, so there is no zero and no fraction.
export const ratingStars = { min: 0.5, max: 5, step: 0.5 } as const;

// The stored Rating for `stars`, or null when it isn't a whole number of half stars in range.
export function storedRating(stars: number): number | null {
  const halves = stars * 2;
  const inRange = halves >= ratingStars.min * 2 && halves <= ratingStars.max * 2;
  return Number.isInteger(halves) && inRange ? halves : null;
}

export function toStars(stored: number): number {
  return stored / 2;
}

// Reviews longer than this are refused.
export const maxReviewLength = 10_000;

// A Log Entry's date is a whole calendar day, written YYYY-MM-DD, so it means the same day
// wherever it is read. ISO dates in this form compare correctly as strings.
export const earliestLogDate = "1900-01-01";

const calendarDate = /^(\d{4})-(\d{2})-(\d{2})$/;

const day = 24 * 60 * 60 * 1000;

function isCalendarDate(date: string): boolean {
  const match = calendarDate.exec(date);
  if (!match) return false;
  const [, year, month, dayOfMonth] = match.map(Number) as [number, number, number, number];
  const parsed = new Date(Date.UTC(year, month - 1, dayOfMonth));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === dayOfMonth
  );
}

// `instant` as a calendar date in `timeZone`; throws a RangeError for an unknown time zone.
function dateIn(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// The latest date a Log Entry may have: today where the User is, so a late-evening entry is never
// refused as "tomorrow". Without a usable time zone it is tomorrow in UTC, which is no earlier
// than today anywhere on Earth.
export function latestLogDate(now: Date, timeZone: string | undefined): string {
  if (timeZone) {
    try {
      return dateIn(now, timeZone);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
    }
  }
  return dateIn(new Date(now.getTime() + day), "UTC");
}

export type LogDateProblem = "invalid_date" | "date_too_early" | "date_in_future";

// Why `date` can't be a Log Entry's date, or null when it can.
export function logDateProblem(
  date: string,
  now: Date,
  timeZone: string | undefined,
): LogDateProblem | null {
  if (!isCalendarDate(date)) return "invalid_date";
  if (date < earliestLogDate) return "date_too_early";
  if (date > latestLogDate(now, timeZone)) return "date_in_future";
  return null;
}

export interface LogOrdered {
  date: string | null;
  createdAt: Date;
}

// Log Order, the one ordering of Log Entries: undated entries first by creation time, then dated
// entries by date, with creation time breaking ties. Creation time never changes, so editing an
// entry never moves it among same-day entries. Entries created at the same moment keep the order
// they are given in.
export function inLogOrder<T extends LogOrdered>(entries: readonly T[]): T[] {
  return entries.toSorted((a, b) => {
    if (a.date !== b.date) {
      if (a.date === null) return -1;
      if (b.date === null) return 1;
      return a.date < b.date ? -1 : 1;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

// The Current Rating: the Rating of the last of one Media Item's Log Entries in Log Order, so a
// backdated entry never overrides a later opinion. Null without entries. The Rating is returned
// as given, stored or in stars.
export function currentRating(
  entries: readonly (LogOrdered & { rating: number })[],
): number | null {
  return inLogOrder(entries).at(-1)?.rating ?? null;
}

// The earliest date among `entries`, or null when none is dated. A creation date is never used in
// its place: it is when the entry was logged, not when the Media Item was experienced.
export function firstLogDate(entries: readonly { date: string | null }[]): string | null {
  return (
    entries
      .map((entry) => entry.date)
      .filter((date) => date !== null)
      .toSorted()[0] ?? null
  );
}
