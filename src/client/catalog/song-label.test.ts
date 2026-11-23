import { describe, expect, it } from "vitest";
import { artistYearAndAlbum, songFacts } from "./song-label";

// Songs as MusicBrainz had them on 2026-11-22 (`docs/mockups/songs/`).
const obiimy = { year: 2013, artistCredit: "Океан Ельзи", album: "Земля" } as const;
const shum = { year: 2021, artistCredit: "Go_A", album: null } as const;
const unknown = { year: null, artistCredit: null, album: null } as const;

describe("a song's Search row", () => {
  it("says its artist, year and album", () => {
    expect(artistYearAndAlbum(obiimy)).toBe("Океан Ельзи · 2013 · from Земля");
  });

  it("leaves out an album it isn't on, with its dot", () => {
    expect(artistYearAndAlbum(shum)).toBe("Go_A · 2021");
  });

  it("leaves out a year a manual song wasn't given", () => {
    expect(artistYearAndAlbum({ ...obiimy, year: null })).toBe("Океан Ельзи · from Земля");
  });

  it("says nothing when none of it is known", () => {
    expect(artistYearAndAlbum(unknown)).toBeNull();
  });
});

describe("a song's page", () => {
  it("leads with the year, then the artist and album", () => {
    expect(songFacts(obiimy)).toBe("2013 · Океан Ельзи · from Земля");
  });

  it("leaves out whichever is unknown", () => {
    expect(songFacts(shum)).toBe("2021 · Go_A");
    expect(songFacts({ ...unknown, artistCredit: "Вовчик" })).toBe("Вовчик");
    expect(songFacts(unknown)).toBeNull();
  });
});
