import { describe, expect, it } from "vitest";
import {
  currentRating,
  firstLogDate,
  inLogOrder,
  latestLogDate,
  logDateProblem,
  storedRating,
  toStars,
} from "./log";

describe("a Rating", () => {
  it.each([
    [0.5, 1],
    [1, 2],
    [2.5, 5],
    [4.5, 9],
    [5, 10],
  ])("of %s stars is stored as %s", (stars, stored) => {
    expect(storedRating(stars)).toBe(stored);
    expect(toStars(stored)).toBe(stars);
  });

  it.each([0, -0.5, 5.5, 0.25, 1.3, 4.75, Number.NaN, Number.POSITIVE_INFINITY])(
    "of %s stars is refused",
    (stars) => {
      expect(storedRating(stars)).toBeNull();
    },
  );
});

describe("a Log Entry's date", () => {
  // 22:30 on 19 October in UTC: already the 20th in Kyiv (UTC+3), still the 19th in Los Angeles.
  const now = new Date("2026-10-19T22:30:00Z");

  it("may be as early as 1 January 1900, but no earlier", () => {
    expect(logDateProblem("1900-01-01", now, "Europe/Kyiv")).toBeNull();
    expect(logDateProblem("1899-12-31", now, "Europe/Kyiv")).toBe("date_too_early");
  });

  it("may be today in the User's time zone, but not tomorrow", () => {
    expect(latestLogDate(now, "Europe/Kyiv")).toBe("2026-10-20");
    expect(logDateProblem("2026-10-20", now, "Europe/Kyiv")).toBeNull();
    expect(logDateProblem("2026-10-21", now, "Europe/Kyiv")).toBe("date_in_future");
  });

  it("is refused when it is already the next day in UTC but not where the User is", () => {
    const evening = new Date("2026-10-20T03:00:00Z");
    expect(latestLogDate(evening, "America/Los_Angeles")).toBe("2026-10-19");
    expect(logDateProblem("2026-10-20", evening, "America/Los_Angeles")).toBe("date_in_future");
  });

  it.each([undefined, "", "Mars/Olympus_Mons"])(
    "may be up to tomorrow in UTC when the time zone is %j",
    (timeZone) => {
      expect(latestLogDate(now, timeZone)).toBe("2026-10-20");
      expect(logDateProblem("2026-10-20", now, timeZone)).toBeNull();
      expect(logDateProblem("2026-10-21", now, timeZone)).toBe("date_in_future");
    },
  );

  it("counts tomorrow in UTC across a month and a year end", () => {
    expect(latestLogDate(new Date("2026-12-31T12:00:00Z"), undefined)).toBe("2027-01-01");
  });

  it.each(["2026-02-30", "2026-13-01", "2026-1-5", "05.01.2026", "2026-01-05T00:00", ""])(
    "is refused when it isn't a calendar date: %j",
    (date) => {
      expect(logDateProblem(date, now, "Europe/Kyiv")).toBe("invalid_date");
    },
  );

  it("accepts 29 February in a leap year only", () => {
    expect(logDateProblem("2024-02-29", now, "Europe/Kyiv")).toBeNull();
    expect(logDateProblem("2025-02-29", now, "Europe/Kyiv")).toBe("invalid_date");
  });
});

describe("Log Order", () => {
  function entry(name: string, date: string | null, createdAt: string) {
    return { name, date, createdAt: new Date(createdAt) };
  }

  const names = (entries: { name: string }[]) => entries.map((e) => e.name);

  it("puts undated entries first, by creation time, even when created after dated ones", () => {
    const entries = [
      entry("dated", "2001-05-01", "2026-01-01T10:00:00Z"),
      entry("undated, later", null, "2026-03-01T10:00:00Z"),
      entry("undated, earlier", null, "2026-02-01T10:00:00Z"),
    ];

    expect(names(inLogOrder(entries))).toEqual(["undated, earlier", "undated, later", "dated"]);
  });

  it("orders dated entries by date, so a backdated entry goes before older-created ones", () => {
    const entries = [
      entry("2026", "2026-10-01", "2026-10-01T20:00:00Z"),
      entry("1999, logged later", "1999-03-31", "2026-10-02T20:00:00Z"),
    ];

    expect(names(inLogOrder(entries))).toEqual(["1999, logged later", "2026"]);
  });

  it("breaks a same-day tie by creation time, whatever order they come in", () => {
    const entries = [
      entry("second", "2026-10-01", "2026-10-03T08:00:00Z"),
      entry("third", "2026-10-01", "2026-10-03T09:00:00Z"),
      entry("first", "2026-10-01", "2026-10-02T23:00:00Z"),
    ];

    expect(names(inLogOrder(entries))).toEqual(["first", "second", "third"]);
  });

  it("keeps entries created at the same moment in the order given", () => {
    const entries = [
      entry("a", "2026-10-01", "2026-10-03T08:00:00Z"),
      entry("b", "2026-10-01", "2026-10-03T08:00:00Z"),
    ];

    expect(names(inLogOrder(entries))).toEqual(["a", "b"]);
    expect(names(inLogOrder([...entries].reverse()))).toEqual(["b", "a"]);
  });

  it("leaves the given list as it was", () => {
    const entries = [
      entry("b", "2026-10-02", "2026-10-01T00:00:00Z"),
      entry("a", null, "2026-10-01T00:00:00Z"),
    ];

    inLogOrder(entries);

    expect(names(entries)).toEqual(["b", "a"]);
  });
});

describe("the Current Rating", () => {
  function entry(rating: number, date: string | null, createdAt: string) {
    return { rating, date, createdAt: new Date(createdAt) };
  }

  it("is none without Log Entries", () => {
    expect(currentRating([])).toBeNull();
  });

  it("is the Rating of the latest-dated entry, not of the one logged last", () => {
    const entries = [
      entry(4, "2026-10-01", "2026-10-01T20:00:00Z"),
      entry(2, "1999-03-31", "2026-10-02T20:00:00Z"),
    ];

    expect(currentRating(entries)).toBe(4);
  });

  it("comes from a dated entry over any undated one, however recently that was logged", () => {
    const entries = [
      entry(3, "2001-05-01", "2026-01-01T10:00:00Z"),
      entry(5, null, "2026-10-01T10:00:00Z"),
    ];

    expect(currentRating(entries)).toBe(3);
  });

  it("among undated entries only, is the Rating of the one logged last", () => {
    const entries = [
      entry(1.5, null, "2026-10-02T10:00:00Z"),
      entry(4.5, null, "2026-10-01T10:00:00Z"),
    ];

    expect(currentRating(entries)).toBe(1.5);
  });

  it("on a same-day tie, is the Rating of the entry logged last", () => {
    const entries = [
      entry(5, "2026-10-01", "2026-10-03T09:00:00Z"),
      entry(2, "2026-10-01", "2026-10-03T08:00:00Z"),
    ];

    expect(currentRating(entries)).toBe(5);
  });
});

describe("the first date of a set of Log Entries", () => {
  it("is none without Log Entries", () => {
    expect(firstLogDate([])).toBeNull();
  });

  it("is none when no entry is dated", () => {
    expect(firstLogDate([{ date: null }, { date: null }])).toBeNull();
  });

  it("is the earliest date, in whatever order the entries come", () => {
    const entries = [{ date: "2026-10-11" }, { date: "2019-03-02" }, { date: "2023-12-24" }];

    expect(firstLogDate(entries)).toBe("2019-03-02");
  });

  it("skips undated entries, which Log Order puts first", () => {
    expect(firstLogDate([{ date: null }, { date: "2023-12-24" }])).toBe("2023-12-24");
  });
});
