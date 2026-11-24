import { describe, expect, it } from "vitest";
import { artistFacts, artistInitials, creditParts, photoCredit } from "./artist-label";

// Artists as MusicBrainz had them on 2026-11-23 (`docs/mockups/artists/`).
describe("an artist's initials", () => {
  it("are the first letters of their first two words, upper case", () => {
    expect(artistInitials("Ігор Діденчук")).toBe("ІД");
    expect(artistInitials("Alfred Chisala Kalusha Jr")).toBe("AC");
    expect(artistInitials("alice cooper")).toBe("AC");
  });

  it("are one letter for a name of one word", () => {
    expect(artistInitials("KALUSH")).toBe("K");
  });

  it("skip what isn't a letter or a digit", () => {
    expect(artistInitials("  The «Беатлз»  ")).toBe("TБ");
    expect(artistInitials("[unknown]")).toBe("U");
  });
});

describe("an artist's facts", () => {
  const okeanElzy = { artistType: "Group", country: "UA", year: 1994, endYear: null };

  it("say their type, their country by name and their years", () => {
    expect(artistFacts(okeanElzy)).toBe("Group · Ukraine · 1994–");
    expect(artistFacts({ artistType: "Group", country: "GB", year: 1965, endYear: 2014 })).toBe(
      "Group · United Kingdom · 1965–2014",
    );
  });

  it("leave out what MusicBrainz doesn't know, with its dot", () => {
    expect(artistFacts({ ...okeanElzy, country: null })).toBe("Group · 1994–");
    expect(artistFacts({ artistType: "Person", country: null, year: null, endYear: null })).toBe(
      "Person",
    );
    expect(artistFacts({ artistType: null, country: null, year: null, endYear: null })).toBeNull();
  });

  it("name MusicBrainz's own codes as MusicBrainz does", () => {
    expect(artistFacts({ ...okeanElzy, country: "XW" })).toBe("Group · Worldwide · 1994–");
    expect(artistFacts({ ...okeanElzy, country: "XE" })).toBe("Group · Europe · 1994–");
    // Not Russia, as Intl names SU.
    expect(artistFacts({ ...okeanElzy, country: "SU" })).toBe("Group · Soviet Union · 1994–");
  });
});

describe("a photo's credit", () => {
  const credit = {
    author: "Alexander Khanin",
    licence: "CC BY-SA 4.0",
    url: "https://commons.wikimedia.org/wiki/File:OkeanElzi25.jpg",
  };

  it("names its author, its licence and Wikimedia Commons", () => {
    expect(photoCredit(credit)).toBe("Photo: Alexander Khanin · CC BY-SA 4.0 · Wikimedia Commons");
  });

  it("names its licence alone when Commons names no author", () => {
    expect(photoCredit({ ...credit, author: null, licence: "Public domain" })).toBe(
      "Photo: Public domain · Wikimedia Commons",
    );
  });
});

describe("an artist credit's parts", () => {
  const bedouin = { name: "Bedouin", mbid: "c9b34ac9-83ab-44f4-8358-348d8ea8d6c2" };
  const dakhaBrakha = { name: "DakhaBrakha", mbid: "208334a1-abf0-4791-9705-b45838244b29" };

  it("are each credited artist by their MBID, and the joining phrases between as text", () => {
    expect(creditParts("Bedouin, DakhaBrakha", [bedouin, dakhaBrakha])).toEqual([
      { text: "Bedouin", mbid: bedouin.mbid },
      { text: ", ", mbid: null },
      { text: "DakhaBrakha", mbid: dakhaBrakha.mbid },
    ]);
  });

  it("are the credit as text alone when no artist has an MBID, as a manual album's", () => {
    expect(creditParts("Сусіди, Друзі сусідів", [])).toEqual([
      { text: "Сусіди, Друзі сусідів", mbid: null },
    ]);
  });

  it("leave a special-purpose artist as text, as they have no page", () => {
    const various = { name: "Various Artists", mbid: "89ad4ac3-39f7-470e-963a-56509c546377" };
    expect(creditParts("Various Artists", [various])).toEqual([
      { text: "Various Artists", mbid: null },
    ]);
  });

  it("keep text a name the credit doesn't spell as its artist list does", () => {
    expect(creditParts("Bedouin & Dakha Brakha", [bedouin, dakhaBrakha])).toEqual([
      { text: "Bedouin", mbid: bedouin.mbid },
      { text: " & Dakha Brakha", mbid: null },
    ]);
  });

  it("are none for no credit", () => {
    expect(creditParts(null, [])).toEqual([]);
  });
});
