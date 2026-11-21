import { describe, expect, it } from "vitest";
import { albumFacts, albumType, artistYearAndType } from "./album-label";

// Albums as MusicBrainz had them on 2026-11-21 (`docs/mockups/albums/`).
const zemlya = {
  year: 2013,
  artistCredit: "Океан Ельзи",
  primaryType: "Album",
  secondaryTypes: [],
} as const;
const jamala1944Ep = {
  year: 2016,
  artistCredit: "Jamala",
  primaryType: "EP",
  secondaryTypes: [],
} as const;
const liveAtMsg = {
  year: 2009,
  artistCredit: "Eric Clapton & Steve Winwood",
  primaryType: "Album",
  secondaryTypes: ["Live"],
} as const;

describe("an album's type", () => {
  it.each([
    // A plain studio album has none.
    ["Album", [], null],
    [null, [], null],
    ["EP", [], "EP"],
    ["Album", ["Live"], "Live"],
    ["Album", ["Remix"], "Remix"],
    // Every type MusicBrainz gives, in its order.
    ["Album", ["Compilation", "Soundtrack"], "Compilation, Soundtrack"],
    ["EP", ["Mixtape/Street"], "EP, Mixtape/Street"],
  ] as const)("of a %s with %j is %j", (primaryType, secondaryTypes, type) => {
    expect(albumType({ primaryType, secondaryTypes })).toBe(type);
  });
});

describe("what an album's Search row says under its title", () => {
  it.each([
    [zemlya, "Океан Ельзи · 2013"],
    [jamala1944Ep, "Jamala · 2016 · EP"],
    [liveAtMsg, "Eric Clapton & Steve Winwood · 2009 · Live"],
    // A part MusicBrainz doesn't have is left out with its dot.
    [{ ...zemlya, year: null, artistCredit: "The Beatles" }, "The Beatles"],
    [{ ...zemlya, artistCredit: null }, "2013"],
    [{ year: null, artistCredit: null, primaryType: null, secondaryTypes: [] }, null],
  ] as const)("for %j is %j", (album, line) => {
    expect(artistYearAndType(album)).toBe(line);
  });
});

describe("what an album's page says under its title", () => {
  it.each([
    [zemlya, "2013 · Океан Ельзи"],
    [jamala1944Ep, "2016 · Jamala · EP"],
    [liveAtMsg, "2009 · Eric Clapton & Steve Winwood · Live"],
    [{ ...jamala1944Ep, year: null }, "Jamala · EP"],
    [{ year: null, artistCredit: null, primaryType: "Album", secondaryTypes: [] }, null],
  ] as const)("for %j is %j", (album, facts) => {
    expect(albumFacts(album)).toBe(facts);
  });
});
