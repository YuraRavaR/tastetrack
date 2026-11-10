import {
  Cat,
  Clapperboard,
  Film,
  Ghost,
  Glasses,
  Lightbulb,
  MoonStar,
  Popcorn,
  SearchX,
  Send,
} from "lucide-react";
import { describe, expect, it } from "vitest";
import type { MediaItem } from "../../shared/api";
import { t } from "../i18n/t";
import { coverOf, placeholderFor, typesetCoverOf } from "./cover";
import type { Found } from "./found";

const posterUrl = "https://image.tmdb.org/t/p/w92/alien.jpg";
const posterUrls = { small: posterUrl, large: "https://image.tmdb.org/t/p/w500/alien.jpg" };

const metadata = {
  title: "Alien",
  originalTitle: "Alien",
  ukrainianTitle: null,
  year: 1979,
  posterUrls,
  backdropUrls: null,
  runtime: 117,
  genres: [],
};

const mediaItem: MediaItem = {
  id: 42,
  mediaType: "film",
  externalReference: { source: "tmdb", mediaType: "film", id: "348" },
  metadata,
};

describe("a cover", () => {
  it("shows a Media Item's poster", () => {
    expect(coverOf(mediaItem, "small")).toEqual({
      url: posterUrl,
      mediaItemId: 42,
      mediaType: "film",
    });
  });

  it("has no image while a Media Item has no metadata", () => {
    expect(coverOf({ ...mediaItem, metadata: null }, "small").url).toBeNull();
  });

  it("names the Media Item of a Manual Media Item that search found", () => {
    const found: Found = {
      kind: "manual",
      mediaItem: {
        ...mediaItem,
        externalReference: null,
        metadata: { ...metadata, posterUrls: null },
      },
      inLog: false,
      inBacklog: false,
      currentRating: null,
      logEntryCount: 0,
      lists: [],
    };

    expect(coverOf(found, "small")).toEqual({ url: null, mediaItemId: 42, mediaType: "film" });
  });

  const tmdbResult: Found = {
    kind: "catalog",
    externalReference: { source: "tmdb", mediaType: "film", id: "348" },
    title: "Alien",
    originalTitle: "Alien",
    year: 1979,
    posterUrl,
    titleLanguage: "en",
    authors: [],
    mediaItemId: null,
    inLog: false,
    inBacklog: false,
    currentRating: null,
    logEntryCount: 0,
    lists: [],
  };

  it("names no Media Item for a TMDB result not in the catalog", () => {
    expect(coverOf(tmdbResult, "small")).toEqual({
      url: posterUrl,
      mediaItemId: null,
      mediaType: "film",
    });
  });

  it("names the Media Item of a TMDB result in the catalog", () => {
    const found: Found = { ...tmdbResult, mediaItemId: 42 };

    expect(coverOf(found, "small")).toEqual({ url: posterUrl, mediaItemId: 42, mediaType: "film" });
  });
});

describe("a book's cover", () => {
  const coverUrls = {
    small: "https://covers.openlibrary.org/b/id/12649478-M.jpg",
    large: "https://covers.openlibrary.org/b/id/12649478-L.jpg",
  };
  const voroshilovgrad: MediaItem = {
    id: 7,
    mediaType: "book",
    externalReference: { source: "openlibrary", mediaType: "book", id: "OL19962759W" },
    metadata: {
      title: "Voroshilovgrad",
      originalTitle: "Voroshilovgrad",
      ukrainianTitle: null,
      year: 2012,
      coverUrls,
      authors: ["Сергі́й Ві́кторович Жада́н", "Reilly Costigan-Humes", "Isaac Wheeler"],
    },
  };
  const fromOpenLibrary: Found = {
    kind: "catalog",
    externalReference: { source: "openlibrary", mediaType: "book", id: "OL12697597W" },
    title: "Himn demokratychnoï molodi",
    originalTitle: "Himn demokratychnoï molodi",
    year: 2006,
    posterUrl: null,
    titleLanguage: "uk",
    authors: ["Сергі́й Ві́кторович Жада́н"],
    mediaItemId: null,
    inLog: false,
    inBacklog: false,
    currentRating: null,
    logEntryCount: 0,
    lists: [],
  };

  it("is the book's cover image in the size asked for", () => {
    expect(coverOf(voroshilovgrad, "large")).toEqual({
      url: coverUrls.large,
      mediaItemId: 7,
      mediaType: "book",
    });
  });

  it("set in type, says the title and the first author, without stress marks", () => {
    expect(typesetCoverOf(voroshilovgrad)).toEqual({
      title: "Voroshilovgrad",
      author: "Сергій Вікторович Жадан",
    });
    expect(typesetCoverOf(fromOpenLibrary)).toEqual({
      title: "Himn demokratychnoï molodi",
      author: "Сергій Вікторович Жадан",
    });
  });

  it("set in type, says what is known of a book without metadata or authors", () => {
    expect(typesetCoverOf({ ...voroshilovgrad, metadata: null })).toEqual({
      title: null,
      author: null,
    });
    expect(typesetCoverOf({ ...fromOpenLibrary, authors: [] }).author).toBeNull();
  });
});

describe("the placeholder for a film without a poster", () => {
  it.each([
    [10, Popcorn, "Eaten with the popcorn."],
    [11, Ghost, "This poster is a ghost."],
    [12, Clapperboard, "Still in makeup."],
    [13, Film, "Lost in the projector."],
    [14, SearchX, "404: poster not found."],
    [15, MoonStar, "The poster is napping."],
    [16, Cat, "The cat knocked it down."],
    [17, Send, "Flew off to Cannes."],
    [18, Lightbulb, "Imagine something great."],
    [19, Glasses, "Poster went incognito."],
  ])("Media Item %i → %s, %s", (id, icon, caption) => {
    const placeholder = placeholderFor(id);

    expect(placeholder.icon).toBe(icon);
    expect(t(placeholder.caption)).toBe(caption);
  });

  it("is the same for ids ending in the same digit", () => {
    expect(placeholderFor(7)).toBe(placeholderFor(1237));
  });

  it("is the film icon for a result without a Media Item", () => {
    expect(placeholderFor(null).icon).toBe(Film);
  });
});
