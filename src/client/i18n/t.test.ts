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
  it("are written day, short month name, year", () => {
    expect(formatDate(new Date("2026-10-26T12:00:00Z"))).toBe("26 Oct 2026");
  });

  // British English would write "Sept".
  it.each([
    ["2026-01-05T12:00:00Z", "5 Jan 2026"],
    ["2026-06-30T12:00:00Z", "30 Jun 2026"],
    ["2026-09-26T12:00:00Z", "26 Sep 2026"],
  ])("%s → %s, always with a three-letter month", (iso, expected) => {
    expect(formatDate(new Date(iso))).toBe(expected);
  });
});

describe("calendar days", () => {
  // The same day in every time zone, though midnight UTC is the day before west of Greenwich.
  it.each([
    ["2026-10-26", "26 Oct 2026"],
    ["1900-01-01", "1 Jan 1900"],
    ["2001-09-15", "15 Sep 2001"],
  ])("%s → %s", (date, expected) => {
    expect(formatCalendarDate(date)).toBe(expected);
  });
});
