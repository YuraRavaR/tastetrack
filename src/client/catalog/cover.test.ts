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
import {
  coverOf,
  coverShape,
  makerOf,
  missingCover,
  placeholderFor,
  typesetCoverOf,
} from "./cover";
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
      inFavourites: false,
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
    inFavourites: false,
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
    inFavourites: false,
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
      maker: "Сергій Вікторович Жадан",
    });
    expect(typesetCoverOf(fromOpenLibrary)).toEqual({
      title: "Himn demokratychnoï molodi",
      maker: "Сергій Вікторович Жадан",
    });
  });

  it("set in type, says what is known of a book without metadata or authors", () => {
    expect(typesetCoverOf({ ...voroshilovgrad, metadata: null })).toEqual({
      title: null,
      maker: null,
    });
    expect(typesetCoverOf({ ...fromOpenLibrary, authors: [] }).maker).toBeNull();
  });
});

describe("an album's cover", () => {
  const zemlyaId = "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8";
  const coverUrls = {
    small: `https://coverartarchive.org/release-group/${zemlyaId}/front-250`,
    large: `https://coverartarchive.org/release-group/${zemlyaId}/front-500`,
  };
  const zemlya: MediaItem = {
    id: 46,
    mediaType: "album",
    externalReference: { source: "musicbrainz", mediaType: "album", id: zemlyaId },
    metadata: {
      title: "Земля",
      originalTitle: "Земля",
      ukrainianTitle: null,
      year: 2013,
      coverUrls,
      artistCredit: "Океан Ельзи",
      artists: ["Океан Ельзи"],
      creditedArtists: [],
      primaryType: "Album",
      secondaryTypes: [],
      url: `https://musicbrainz.org/release-group/${zemlyaId}`,
    },
  };
  const remixId = "42ef6001-3113-440c-ae7c-3667c7351e35";
  const fromMusicBrainz: Found = {
    kind: "catalog",
    externalReference: { source: "musicbrainz", mediaType: "album", id: remixId },
    title: "Abbey Road Remix",
    originalTitle: "Abbey Road Remix",
    year: 2012,
    posterUrl: `https://coverartarchive.org/release-group/${remixId}/front-250`,
    titleLanguage: "en",
    authors: [],
    artistCredit: "The Beatles",
    primaryType: "Album",
    secondaryTypes: ["Remix"],
    mediaItemId: null,
    inLog: false,
    inBacklog: false,
    inFavourites: false,
    currentRating: null,
    logEntryCount: 0,
    lists: [],
  };

  it("is square, where every other Media Type's is a poster's 2:3", () => {
    expect(coverShape("album")).toBe("1:1");
    expect(coverShape("game")).toBe("2:3");
  });

  it("set in type, says the title and the artist credit", () => {
    expect(typesetCoverOf(zemlya)).toEqual({ title: "Земля", maker: "Океан Ельзи" });
    expect(typesetCoverOf(fromMusicBrainz)).toEqual({
      title: "Abbey Road Remix",
      maker: "The Beatles",
    });
    expect(makerOf(zemlya)).toBe("Океан Ельзи");
  });
});

describe("a song's cover", () => {
  const obiimy: MediaItem = {
    id: 47,
    mediaType: "song",
    externalReference: {
      source: "musicbrainz",
      mediaType: "song",
      id: "d8d55f18-0c4b-4036-a16d-e273ac8953fc",
    },
    metadata: {
      title: "Обійми",
      originalTitle: "Обійми",
      ukrainianTitle: null,
      year: 2013,
      coverUrls: null,
      artistCredit: "Океан Ельзи",
      artists: ["Океан Ельзи"],
      creditedArtists: [],
      album: "Земля",
      disambiguation: null,
      url: null,
    },
  };

  it("is square, and without an image is a quiet note, where a book's or an album's is set in type", () => {
    expect(coverShape("song")).toBe("1:1");
    expect(missingCover("song")).toBe("note");
    expect(missingCover("album")).toBe("typeset");
    expect(missingCover("book")).toBe("typeset");
    expect(missingCover("film")).toBe("placeholder");
  });

  it("names the artist as the song's maker", () => {
    expect(makerOf(obiimy)).toBe("Океан Ельзи");
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
