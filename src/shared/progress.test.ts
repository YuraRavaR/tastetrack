import { describe, expect, it } from "vitest";
import { type Progress, progressProblem } from "./progress";

describe("a book's Progress", () => {
  it.each([
    [{ page: 0 }],
    [{ page: 142 }],
    [{ page: 100_000 }],
    [{ page: 142, pageCount: 380 }],
    [{ page: 0, pageCount: 1 }],
    [{ page: 380, pageCount: 380 }],
    [{ page: 100_000, pageCount: 100_000 }],
  ])("of %o is kept", (book) => {
    expect(progressProblem({ mediaType: "book", ...book }, "book")).toBeNull();
  });

  it.each([
    [{ page: -1 }],
    [{ page: 100_001 }],
    [{ page: 1.5 }],
    [{ page: Number.NaN }],
    [{ page: 1, pageCount: 0 }],
    [{ page: 1, pageCount: 100_001 }],
    [{ page: 1, pageCount: 2.5 }],
  ])("of %o is out of range", (book) => {
    expect(progressProblem({ mediaType: "book", ...book }, "book")).toBe("invalid_progress");
  });

  it("may not be past the last page of the edition", () => {
    const past: Progress = { mediaType: "book", page: 381, pageCount: 380 };
    expect(progressProblem(past, "book")).toBe("invalid_progress");
  });

  it("is refused for a series, and a series' Progress for a book", () => {
    expect(progressProblem({ mediaType: "book", page: 142 }, "series")).toBe("progress_mismatch");
    expect(progressProblem({ mediaType: "series", season: 1, episode: 3 }, "book")).toBe(
      "progress_mismatch",
    );
  });

  it("is refused for a film, which has no Progress", () => {
    expect(progressProblem({ mediaType: "book", page: 142 }, "film")).toBe("progress_mismatch");
  });
});

describe("a series' Progress", () => {
  it("counts seasons from 1 and episodes from 0", () => {
    expect(progressProblem({ mediaType: "series", season: 1, episode: 0 }, "series")).toBeNull();
    expect(progressProblem({ mediaType: "series", season: 0, episode: 1 }, "series")).toBe(
      "invalid_progress",
    );
    expect(progressProblem({ mediaType: "series", season: 1, episode: -1 }, "series")).toBe(
      "invalid_progress",
    );
  });
});
