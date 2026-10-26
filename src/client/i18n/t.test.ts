import { describe, expect, it } from "vitest";
import { formatCalendarDate, formatDate, t } from "./t";

describe("English plurals", () => {
  it.each([
    [0, "0 films"],
    [1, "1 film"],
    [2, "2 films"],
    [5, "5 films"],
    [11, "11 films"],
    [21, "21 films"],
  ])("%i → %s", (count, expected) => {
    expect(t("films.count", { count })).toBe(expected);
  });
});

describe("how many Lists", () => {
  it.each([
    [0, "0 Lists"],
    [1, "1 List"],
    [2, "2 Lists"],
    [100, "100 Lists"],
  ])("%i → %s", (count, expected) => {
    expect(t("lists.count", { count })).toBe(expected);
  });
});

describe("what deleting a Manual Media Item deletes with it", () => {
  it.each([
    [0, "You have no Log Entries for it."],
    [1, "Your Log Entry for it will be deleted."],
    [2, "Your 2 Log Entries for it will be deleted."],
  ])("%i Log Entries → %s", (count, expected) => {
    expect(t("manualItem.deleteLogEntries", { count })).toBe(expected);
  });

  it.each([
    [0, "It isn't on your Watchlist or in any of your Lists."],
    [1, "It will be removed from 1 List, where your Watchlist counts as a List."],
    [2, "It will be removed from 2 Lists, where your Watchlist counts as a List."],
  ])("%i List Items → %s", (count, expected) => {
    expect(t("manualItem.deleteListItems", { count })).toBe(expected);
  });
});

describe("how many times a film was watched", () => {
  it.each([
    [0, "Not watched yet"],
    [1, "Watched once"],
    [2, "Watched 2 times"],
    [5, "Watched 5 times"],
    [11, "Watched 11 times"],
    [21, "Watched 21 times"],
  ])("%i → %s", (count, expected) => {
    expect(t("itemHistory.timesExperienced", { count })).toBe(expected);
  });
});

describe("Ratings", () => {
  it.each([
    [0.5, "0.5 stars"],
    [1, "1 star"],
    [1.5, "1.5 stars"],
    [5, "5 stars"],
  ])("%s → %s", (stars, expected) => {
    expect(t("rating.stars", { stars })).toBe(expected);
  });
});

describe("dates", () => {
  // Midday UTC, so the date is the same in every time zone the tests might run in.
  it("are written short month name, day, year", () => {
    expect(formatDate(new Date("2026-10-26T12:00:00Z"))).toBe("Oct 26, 2026");
  });

  // British English would write "Sept"; US English, "Sep".
  it.each([
    ["2026-01-05T12:00:00Z", "Jan 5, 2026"],
    ["2026-06-30T12:00:00Z", "Jun 30, 2026"],
    ["2026-09-26T12:00:00Z", "Sep 26, 2026"],
  ])("%s → %s, always with a three-letter month", (iso, expected) => {
    expect(formatDate(new Date(iso))).toBe(expected);
  });
});

describe("calendar days", () => {
  // The same day in every time zone, though midnight UTC is the day before west of Greenwich.
  it.each([
    ["2026-10-26", "Oct 26, 2026"],
    ["1900-01-01", "Jan 1, 1900"],
    ["2001-09-15", "Sep 15, 2001"],
  ])("%s → %s", (date, expected) => {
    expect(formatCalendarDate(date)).toBe(expected);
  });
});
