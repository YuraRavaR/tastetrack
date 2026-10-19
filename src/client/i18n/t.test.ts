import { describe, expect, it } from "vitest";
import { formatDate, t } from "./t";

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
