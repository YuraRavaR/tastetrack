import { describe, expect, it } from "vitest";
import {
  kalushOrchestraClaims,
  kalushOrchestraFile,
  nirvanaUkClaims,
  okeanElzyClaims,
  okeanElzyFile,
  pinkFloydFile,
  radioheadFile,
} from "../../../shared/test-data/wikimedia";
import { photoCreditOf, photoFileOf, wikidataIdOf } from "./wikimedia";

// Choosing and crediting an artist's photo (ADR-0013, Artists) on Wikidata's and Commons' own
// answers.

describe("an artist's photo", () => {
  it("is their Wikidata entity's P18 image", () => {
    expect(photoFileOf(okeanElzyClaims)).toBe("OkeanElzi25.jpg");
  });

  it("is the first image of preferred rank, before any of normal rank", () => {
    expect(photoFileOf(kalushOrchestraClaims)).toBe(
      "- EU2024BE Informal meeting of EU Affairs Ministers BOZAR JNZT 0103 (53687141247).jpg",
    );
  });

  it("is never a deprecated image", () => {
    const [normal, preferred] = kalushOrchestraClaims.claims.P18;
    const claims = { claims: { P18: [{ ...preferred, rank: "deprecated" }, normal] } };

    expect(photoFileOf(claims)).toBe("Kalush Orchestra, May 2022.png");
    expect(photoFileOf({ claims: { P18: [{ ...normal, rank: "deprecated" }] } })).toBeNull();
  });

  it("is none for an entity with no P18, and undefined for an answer of unknown shape", () => {
    expect(photoFileOf(nirvanaUkClaims)).toBeNull();
    expect(photoFileOf({ error: { code: "no-such-entity" } })).toBeUndefined();
  });
});

describe("a photo's credit", () => {
  it("is the author's text without its markup, the licence and the file's page", () => {
    expect(photoCreditOf(okeanElzyFile)).toEqual({
      author: "Alexander Khanin",
      licence: "CC BY-SA 4.0",
      url: "https://commons.wikimedia.org/wiki/File:OkeanElzi25.jpg",
    });
    expect(photoCreditOf(radioheadFile)?.author).toBe("Raph_PH");
    expect(photoCreditOf(kalushOrchestraFile)?.author).toBe(
      "Belgian Presidency of the Council of the EU 2024 from Belgium",
    );
  });

  it("takes a plain-text author as it is, and a public-domain licence by its name", () => {
    expect(photoCreditOf(pinkFloydFile)).toEqual({
      author: "Capitol Records",
      licence: "Public domain",
      url: "https://commons.wikimedia.org/wiki/File:Pink_Floyd,_1971_(HQ).jpg",
    });
  });

  it("decodes the author's entities, collapses their whitespace, and has none when it is empty", () => {
    const withAuthor = (value: string) => {
      const [page] = Object.values(okeanElzyFile.query.pages);
      const [info] = page?.imageinfo ?? [];
      const extmetadata = { ...info?.extmetadata, Artist: { value, source: "commons-desc-page" } };
      return { query: { pages: { 1: { ...page, imageinfo: [{ ...info, extmetadata }] } } } };
    };

    expect(
      photoCreditOf(withAuthor("Koh Hasebe;\n  Distributed by <i>Elektra</i> &amp; Co"))?.author,
    ).toBe("Koh Hasebe; Distributed by Elektra & Co");
    expect(photoCreditOf(withAuthor("<span> </span>"))?.author).toBeNull();
  });

  it("is none for a missing file, and undefined for an answer without a licence or of unknown shape", () => {
    const missing = { query: { pages: { "-1": { ns: 6, title: "File:Gone.jpg", missing: "" } } } };
    const [page] = Object.values(pinkFloydFile.query.pages);
    const [info] = page?.imageinfo ?? [];
    const noLicence = {
      query: {
        pages: {
          1: { ...page, imageinfo: [{ ...info, extmetadata: { Artist: { value: "X" } } }] },
        },
      },
    };

    expect(photoCreditOf(missing)).toBeNull();
    expect(photoCreditOf(noLicence)).toBeUndefined();
    expect(photoCreditOf("You are making too many requests to the API.")).toBeUndefined();
  });
});

describe("an artist's Wikidata ID", () => {
  it("comes from their lookup's wikidata URL relation", () => {
    expect(
      wikidataIdOf([
        { type: "discogs", url: { resource: "https://www.discogs.com/artist/45467" } },
        { type: "wikidata", url: { resource: "https://www.wikidata.org/wiki/Q2306" } },
      ]),
    ).toBe("Q2306");
    expect(
      wikidataIdOf([{ type: "wikidata", url: { resource: "https://example.com/Q1" } }]),
    ).toBeNull();
    expect(wikidataIdOf(null)).toBeNull();
  });
});
