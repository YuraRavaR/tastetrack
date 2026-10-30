import { describe, expect, it } from "vitest";
import { filmFacts, filmLabel, filmYearAndRuntime } from "./film-label";

describe("a search result's label", () => {
  it("is the title and year when the title is the Original Title", () => {
    expect(filmLabel({ title: "Alien", originalTitle: "Alien", year: 1979 })).toBe("Alien (1979)");
  });

  it("puts the Original Title before the year when the title differs", () => {
    expect(filmLabel({ title: "Чужий", originalTitle: "Alien", year: 1979 })).toBe(
      "Чужий (Alien, 1979)",
    );
  });

  it("leaves out an unknown year", () => {
    expect(filmLabel({ title: "Alien", originalTitle: "Alien", year: null })).toBe("Alien");
    expect(filmLabel({ title: "Чужий", originalTitle: "Alien", year: null })).toBe("Чужий (Alien)");
  });
});

describe("a film's runtime and genres", () => {
  it("are the runtime in minutes, then the genres", () => {
    expect(filmFacts({ runtime: 122, genres: ["Comedy", "Romance"] })).toBe(
      "122 min · Comedy, Romance",
    );
  });

  it("leave out whichever is unknown", () => {
    expect(filmFacts({ runtime: 95, genres: [] })).toBe("95 min");
    expect(filmFacts({ runtime: null, genres: ["Documentary"] })).toBe("Documentary");
  });

  it("are nothing when neither is known", () => {
    expect(filmFacts({ runtime: null, genres: [] })).toBeNull();
  });
});

describe("a film's year and runtime", () => {
  it("are the year, then the runtime in minutes", () => {
    expect(filmYearAndRuntime({ year: 2001, runtime: 122 })).toBe("2001 · 122 min");
  });

  it("leave out whichever is unknown", () => {
    expect(filmYearAndRuntime({ year: 2001, runtime: null })).toBe("2001");
    expect(filmYearAndRuntime({ year: null, runtime: 95 })).toBe("95 min");
  });

  it("are nothing when neither is known", () => {
    expect(filmYearAndRuntime({ year: null, runtime: null })).toBeNull();
  });
});
