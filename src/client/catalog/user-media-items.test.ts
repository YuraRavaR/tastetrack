import { describe, expect, it } from "vitest";
import type { LibraryItem, MediaItem } from "../../shared/api";
import { type Found, foundManual } from "./found";
import {
  matchUserMediaItems,
  userMediaItemStatus,
  userMediaItems,
  withoutUserMediaItems,
} from "./user-media-items";

let nextId = 1;

function film(title: string, more: { originalTitle?: string; ukrainianTitle?: string } = {}) {
  const mediaItem: MediaItem = {
    id: nextId++,
    mediaType: "film",
    externalReference: null,
    metadata: {
      title,
      originalTitle: more.originalTitle ?? title,
      ukrainianTitle: more.ukrainianTitle ?? null,
      year: 2001,
      posterUrls: null,
      backdropUrls: null,
      runtime: null,
      genres: [],
    },
  };
  return mediaItem;
}

function planned(mediaItem: MediaItem): LibraryItem {
  return { mediaItem, backlog: { addedAt: "2026-10-01T10:00:00.000Z" }, log: null };
}

const titles = (films: { mediaItem: MediaItem }[]) => films.map((f) => f.mediaItem.metadata?.title);

describe("matching the User's Media Items", () => {
  it("finds a film in the Library by any part of its title, in any case", () => {
    const parasite = film("Parasite");
    const alien = film("Alien");

    const items = userMediaItems([planned(parasite), planned(alien)], []);

    expect(titles(matchUserMediaItems(items, "RASI"))).toEqual(["Parasite"]);
  });

  it("matches nothing while the query is blank", () => {
    const items = userMediaItems([planned(film("Parasite"))], []);

    expect(matchUserMediaItems(items, "  ")).toEqual([]);
  });

  it("finds a film by its Original Title and its Ukrainian title too", () => {
    const amelie = film("Amélie", {
      originalTitle: "Le Fabuleux Destin d'Amélie Poulain",
      ukrainianTitle: "Амелі",
    });
    const items = userMediaItems([planned(amelie)], []);

    expect(titles(matchUserMediaItems(items, "fabuleux"))).toEqual(["Amélie"]);
    expect(titles(matchUserMediaItems(items, "амел"))).toEqual(["Amélie"]);
  });

  it("finds a film only on a List, and a film both in the Library and on a List once, by title", () => {
    const paris = film("Paris, Texas");
    const parasite = film("Parasite");
    const roadMovies = { id: 1, name: "Road movies" };

    const items = userMediaItems(
      [planned(parasite)],
      [
        { mediaItem: paris, lists: [roadMovies] },
        { mediaItem: parasite, lists: [roadMovies] },
      ],
    );

    expect(matchUserMediaItems(items, "par")).toEqual([
      { mediaItem: parasite, inBacklog: true, currentRating: null, lists: [roadMovies] },
      { mediaItem: paris, inBacklog: false, currentRating: null, lists: [roadMovies] },
    ]);
  });
});

describe("a User's Media Item's status line", () => {
  const roadMovies = { id: 1, name: "Road movies" };
  const horror = { id: 2, name: "Horror nights" };
  const base = { mediaItem: film("Parasite"), inBacklog: false, currentRating: null, lists: [] };

  it.each([
    [
      "a logged film planned again: its Current Rating and the Backlog",
      { inBacklog: true, currentRating: 5, lists: [roadMovies] },
      { kind: "rated", rating: 5, inBacklog: true },
    ],
    [
      "a logged film: its Current Rating",
      { currentRating: 4.5, lists: [roadMovies] },
      { kind: "rated", rating: 4.5, inBacklog: false },
    ],
    ["a planned film: the Backlog", { inBacklog: true, lists: [roadMovies] }, { kind: "backlog" }],
    [
      "a film only on Lists: the oldest of them",
      { lists: [roadMovies, horror] },
      { kind: "list", name: "Road movies" },
    ],
  ])("says, for %s", (_, film, status) => {
    expect(userMediaItemStatus({ ...base, ...film })).toEqual(status);
  });
});

describe("search results beside the User's Media Items", () => {
  function tmdbResult(title: string, mediaItemId: number | null): Found {
    return {
      kind: "catalog",
      externalReference: { source: "tmdb", mediaType: "film", id: title },
      title,
      originalTitle: title,
      year: 2001,
      posterUrl: null,
      titleLanguage: "en",
      mediaItemId,
      inLog: false,
      inBacklog: false,
      currentRating: null,
      logEntryCount: 0,
      lists: [],
    };
  }

  it("leaves out the User's Media Items, and keeps the rest, those not in the catalog included", () => {
    const parasite = film("Parasite");
    const paranoid = film("Paranoid Park");
    const items = userMediaItems([planned(parasite)], []);
    const results = [
      tmdbResult("Parasite", parasite.id),
      tmdbResult("Paranoid Park", paranoid.id),
      tmdbResult("Paris Is Burning", null),
    ];

    expect(
      withoutUserMediaItems(results, items).map((found) => found.kind === "catalog" && found.title),
    ).toEqual(["Paranoid Park", "Paris Is Burning"]);
  });

  // TMDB's results for the last query stay while the next one runs, and may hold a User's Media
  // Item the new query no longer matches.
  it("leaves out a User's Media Item the query doesn't match too", () => {
    const parasite = film("Parasite");
    const items = userMediaItems([planned(parasite)], []);

    expect(matchUserMediaItems(items, "parasitex")).toEqual([]);
    expect(withoutUserMediaItems([tmdbResult("Parasite", parasite.id)], items)).toEqual([]);
  });

  it("leaves out a Manual Media Item in the Library", () => {
    const mine = film("Тіні забутих предків");
    const items = userMediaItems([planned(mine)], []);
    expect(withoutUserMediaItems([foundManual(mine)], items)).toEqual([]);
  });
});
