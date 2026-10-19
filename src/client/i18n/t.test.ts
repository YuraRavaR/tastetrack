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
  it("are written in English with the month's short name", () => {
    expect(formatDate(new Date("2026-10-26T12:00:00Z"))).toBe("Oct 26, 2026");
  });
});
