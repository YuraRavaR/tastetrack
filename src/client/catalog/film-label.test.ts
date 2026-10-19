import { describe, expect, it } from "vitest";
import { filmLabel } from "./film-label";

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
