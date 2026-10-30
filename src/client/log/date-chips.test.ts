import { describe, expect, it } from "vitest";
import { latestLogDate } from "../../shared/log";
import { dateChipFor, dateOfChip } from "./date-chips";

describe("the date chip picked for a Log Entry's date", () => {
  const today = "2026-10-20";

  it("is Today for today's date", () => {
    expect(dateChipFor("2026-10-20", today)).toBe("today");
  });

  it("is Yesterday for the day before", () => {
    expect(dateChipFor("2026-10-19", today)).toBe("yesterday");
  });

  it("is No date for an undated entry", () => {
    expect(dateChipFor(null, today)).toBe("none");
  });

  it.each(["2026-10-18", "2026-10-21", "2001-09-15"])("is Other date for %s", (date) => {
    expect(dateChipFor(date, today)).toBe("other");
  });

  it("finds yesterday across a month and a leap day", () => {
    expect(dateChipFor("2026-09-30", "2026-10-01")).toBe("yesterday");
    expect(dateChipFor("2024-02-29", "2024-03-01")).toBe("yesterday");
    expect(dateChipFor("2025-12-31", "2026-01-01")).toBe("yesterday");
  });

  describe("around midnight", () => {
    // 22:30 on 19 October in UTC: already the 20th in Kyiv (UTC+3), still the 19th in Los Angeles.
    const now = new Date("2026-10-19T22:30:00Z");

    it("follows the day where the User is", () => {
      expect(dateChipFor("2026-10-20", latestLogDate(now, "Europe/Kyiv"))).toBe("today");
      expect(dateChipFor("2026-10-19", latestLogDate(now, "Europe/Kyiv"))).toBe("yesterday");
      expect(dateChipFor("2026-10-19", latestLogDate(now, "America/Los_Angeles"))).toBe("today");
      expect(dateChipFor("2026-10-20", latestLogDate(now, "America/Los_Angeles"))).toBe("other");
    });

    it("moves to the new day a minute after midnight", () => {
      const beforeMidnight = new Date("2026-10-19T20:59:00Z");
      const afterMidnight = new Date("2026-10-19T21:01:00Z");
      expect(dateChipFor("2026-10-19", latestLogDate(beforeMidnight, "Europe/Kyiv"))).toBe("today");
      expect(dateChipFor("2026-10-19", latestLogDate(afterMidnight, "Europe/Kyiv"))).toBe(
        "yesterday",
      );
    });
  });
});

describe("the date a chip saves", () => {
  const today = "2026-10-20";

  it("is today's for Today", () => {
    expect(dateOfChip("today", today, "2001-09-15")).toBe("2026-10-20");
  });

  it("is the day before for Yesterday", () => {
    expect(dateOfChip("yesterday", today, "2001-09-15")).toBe("2026-10-19");
  });

  it("is the one in the field for Other date", () => {
    expect(dateOfChip("other", today, "2001-09-15")).toBe("2001-09-15");
  });

  it("is none for No date, whatever the field holds", () => {
    expect(dateOfChip("none", today, "2001-09-15")).toBeNull();
  });
});
