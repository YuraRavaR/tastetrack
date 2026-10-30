// The chips that pick a Log Entry's date. `today` is the User's today, as latestLogDate gives it.
export const dateChips = ["today", "yesterday", "other", "none"] as const;

export type DateChip = (typeof dateChips)[number];

const day = 24 * 60 * 60 * 1000;

// A calendar date parses as midnight UTC, so a day's arithmetic never meets a clock change.
function dayBefore(date: string): string {
  return new Date(Date.parse(date) - day).toISOString().slice(0, 10);
}

// The chip that stands for `date`: an undated entry has No date, and any date but today and
// yesterday is an Other date.
export function dateChipFor(date: string | null, today: string): DateChip {
  if (date === null) return "none";
  if (date === today) return "today";
  return date === dayBefore(today) ? "yesterday" : "other";
}

// The date `chip` saves; `otherDate` is what the Other date field holds.
export function dateOfChip(chip: DateChip, today: string, otherDate: string): string | null {
  if (chip === "none") return null;
  if (chip === "other") return otherDate;
  return chip === "today" ? today : dayBefore(today);
}
