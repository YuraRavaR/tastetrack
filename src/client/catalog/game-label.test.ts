import { describe, expect, it } from "vitest";
import { gameFacts, platformsLine, yearAndPlatforms } from "./game-label";

// The Witcher 3's platforms in IGDB's order, as IGDB answered on 2026-11-19.
const witcher3Platforms = ["Series X|S", "PS4", "Switch 2", "PC", "PS5", "XONE", "Switch"];

describe("a game's platforms in one line", () => {
  it("lists PC first, then PlayStation, Xbox and Nintendo, and counts the rest past three", () => {
    expect(platformsLine(witcher3Platforms)).toBe("PC, PS4, PS5 +4");
  });

  it.each([
    [[], null],
    [["famicom"], "famicom"],
    [["Switch", "PS5", "Series X|S"], "PS5, Series X|S, Switch"],
    // Platforms past the four families follow them, by name.
    [["Mac", "Linux", "Switch", "iOS"], "Switch, iOS, Linux +1"],
    [["ZXS", "Amstrad CPC", "PS1"], "PS1, Amstrad CPC, ZXS"],
  ])("names %j as %j", (platforms, line) => {
    expect(platformsLine(platforms)).toBe(line);
  });
});

describe("what a game's Search row says under its title", () => {
  it.each([
    [{ year: 2015, platforms: witcher3Platforms }, "2015 · PC, PS4, PS5 +4"],
    [{ year: 1997, platforms: ["PS1"] }, "1997 · PS1"],
    // IGDB gives no release date for some games, and no platforms for others.
    [{ year: null, platforms: ["ZXS"] }, "ZXS"],
    [{ year: 2026, platforms: [] }, "2026"],
    [{ year: null, platforms: [] }, null],
  ])("for %j, says %j", (game, line) => {
    expect(yearAndPlatforms(game)).toBe(line);
  });
});

describe("what a game's page says under its title", () => {
  it.each([
    [
      { year: 2015, developer: "CD Projekt RED", platforms: witcher3Platforms },
      "2015 · CD Projekt RED · PC, PS4, PS5 +4",
    ],
    [
      { year: 2026, developer: "Witenovastudio", platforms: ["PS4"] },
      "2026 · Witenovastudio · PS4",
    ],
    // A part IGDB doesn't have is left out with its dot.
    [{ year: 1997, developer: null, platforms: ["PS1"] }, "1997 · PS1"],
    [{ year: null, developer: "GSC Game World", platforms: [] }, "GSC Game World"],
    // A game added by hand has its year alone.
    [{ year: null, developer: null, platforms: [] }, null],
  ])("for %j, says %j", (game, facts) => {
    expect(gameFacts(game)).toBe(facts);
  });
});
