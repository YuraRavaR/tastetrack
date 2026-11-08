import { describe, expect, it } from "vitest";
import type { LibraryItem } from "../../shared/api";
import {
  changeView,
  decadeChoices,
  genreChoices,
  type LibraryView,
  libraryView,
  showLibrary,
} from "./library-view";

const params = (query = "") => new URLSearchParams(query);

let nextId = 1;

// A film in the Library with what a view reads: its title, year, genres and Current Rating.
function film({
  title = "Untitled",
  year = null,
  genres = [],
  rating,
}: {
  title?: string;
  year?: number | null;
  genres?: string[];
  rating?: number;
}): LibraryItem {
  const metadata = {
    title,
    originalTitle: title,
    ukrainianTitle: null,
    year,
    posterUrl: null,
    backdropUrls: null,
    runtime: null,
    genres,
  };
  return {
    mediaItem: { id: nextId++, mediaType: "film", externalReference: null, metadata },
    backlog: rating === undefined ? { addedAt: "2026-10-01T10:00:00.000Z" } : null,
    log:
      rating === undefined
        ? null
        : {
            currentRating: rating,
            lastLogEntry: { date: "2026-10-01", createdAt: "2026-10-01T10:00:00.000Z" },
          },
  };
}

const titles = (items: LibraryItem[]) => items.map((item) => item.mediaItem.metadata?.title);

const view = (changes: Partial<LibraryView>): LibraryView => {
  return { sort: "added", genre: null, decade: null, minRating: null, ...changes };
};

describe("a tab's view, read from its address", () => {
  it("sorts the Watchlist by Date added and Watched by Last watched, unfiltered, by default", () => {
    expect(libraryView("backlog", params(), null)).toEqual({
      sort: "added",
      genre: null,
      decade: null,
      minRating: null,
    });
    expect(libraryView("experienced", params(), null).sort).toBe("watched");
  });

  it("takes the sort and filters from the address", () => {
    const query = "sort=rating&genre=Science+Fiction&decade=1990&rating=4.5";

    expect(libraryView("experienced", params(query), null)).toEqual({
      sort: "rating",
      genre: "Science Fiction",
      decade: 1990,
      minRating: 4.5,
    });
  });

  it("falls back to the remembered sort when the address has none", () => {
    expect(libraryView("backlog", params(), "title").sort).toBe("title");
    expect(libraryView("backlog", params("sort=year"), "title").sort).toBe("year");
  });

  it("ignores what the tab can't show", () => {
    const query = "sort=rating&decade=1995&rating=3";

    expect(libraryView("backlog", params(query), "watched")).toEqual({
      sort: "added",
      genre: null,
      decade: null,
      minRating: null,
    });
    // Watched filters on Rating, but only from the three floors it offers.
    expect(libraryView("experienced", params("rating=3"), null).minRating).toBeNull();
    expect(libraryView("backlog", params("rating=5"), null).minRating).toBeNull();
  });
});

describe("a tab's films, as its view shows them", () => {
  it("keeps the tab's own order for Date added and Last watched", () => {
    const films = [film({ title: "Heat" }), film({ title: "Alien" })];

    expect(titles(showLibrary(films, view({ sort: "added" })))).toEqual(["Heat", "Alien"]);
    expect(titles(showLibrary(films, view({ sort: "watched" })))).toEqual(["Heat", "Alien"]);
  });

  it("sorts by title from A to Z, whatever the case or accents", () => {
    const films = [film({ title: "heat" }), film({ title: "Ève" }), film({ title: "Amélie" })];

    expect(titles(showLibrary(films, view({ sort: "title" })))).toEqual(["Amélie", "Ève", "heat"]);
  });

  it("sorts by release year, the newest first and films with no year last", () => {
    const films = [
      film({ title: "Unknown", year: null }),
      film({ title: "Alien", year: 1979 }),
      film({ title: "Dune", year: 2024 }),
      film({ title: "Aliens", year: 1986 }),
    ];

    expect(titles(showLibrary(films, view({ sort: "year" })))).toEqual([
      "Dune",
      "Aliens",
      "Alien",
      "Unknown",
    ]);
  });

  it("sorts by Current Rating, the highest first, the last watched first among equals", () => {
    const films = [
      film({ title: "Heat", rating: 4 }),
      film({ title: "Her", rating: 3.5 }),
      film({ title: "Parasite", rating: 5 }),
      film({ title: "Prisoners", rating: 4 }),
    ];

    expect(titles(showLibrary(films, view({ sort: "rating" })))).toEqual([
      "Parasite",
      "Heat",
      "Prisoners",
      "Her",
    ]);
  });

  it("keeps only the films of the chosen genre", () => {
    const films = [
      film({ title: "Alien", genres: ["Horror", "Science Fiction"] }),
      film({ title: "Amélie", genres: ["Comedy", "Romance"] }),
      film({ title: "Unknown", genres: [] }),
    ];

    expect(titles(showLibrary(films, view({ genre: "Science Fiction" })))).toEqual(["Alien"]);
    expect(titles(showLibrary(films, view({ genre: null })))).toEqual([
      "Alien",
      "Amélie",
      "Unknown",
    ]);
  });

  it("keeps only the films of the chosen decade", () => {
    const films = [
      film({ title: "Alien", year: 1979 }),
      film({ title: "Heat", year: 1995 }),
      film({ title: "Before Sunrise", year: 1990 }),
      film({ title: "Unknown", year: null }),
    ];

    expect(titles(showLibrary(films, view({ decade: 1990 })))).toEqual(["Heat", "Before Sunrise"]);
    expect(titles(showLibrary(films, view({ decade: null })))).toHaveLength(4);
  });

  it("keeps only the films rated at least the chosen floor", () => {
    const films = [
      film({ title: "Parasite", rating: 5 }),
      film({ title: "Dune", rating: 4.5 }),
      film({ title: "Heat", rating: 4 }),
      film({ title: "Her", rating: 3.5 }),
    ];

    expect(titles(showLibrary(films, view({ minRating: 4 })))).toEqual([
      "Parasite",
      "Dune",
      "Heat",
    ]);
    expect(titles(showLibrary(films, view({ minRating: 4.5 })))).toEqual(["Parasite", "Dune"]);
    expect(titles(showLibrary(films, view({ minRating: 5 })))).toEqual(["Parasite"]);
  });

  it("applies every filter at once, then the sort", () => {
    const films = [
      film({ title: "Heat", year: 1995, genres: ["Crime"], rating: 4 }),
      film({ title: "Se7en", year: 1995, genres: ["Crime"], rating: 4.5 }),
      film({ title: "Casino", year: 1995, genres: ["Crime"], rating: 5 }),
      film({ title: "The Departed", year: 2006, genres: ["Crime"], rating: 5 }),
      film({ title: "Toy Story", year: 1995, genres: ["Animation"], rating: 5 }),
    ];

    expect(
      titles(
        showLibrary(films, view({ sort: "title", genre: "Crime", decade: 1990, minRating: 4.5 })),
      ),
    ).toEqual(["Casino", "Se7en"]);
  });
});

describe("a change to a view's address", () => {
  it("sets or removes only the choices it names, and keeps the rest", () => {
    const before = params("sort=title&genre=Drama&rating=4");

    expect(changeView(before, { decade: 1990, minRating: null }).toString()).toBe(
      "sort=title&genre=Drama&decade=1990",
    );
    expect(changeView(before, { genre: "Science Fiction" }).toString()).toBe(
      "sort=title&genre=Science+Fiction&rating=4",
    );
    expect(changeView(params(), { sort: "rating", minRating: 4.5 }).toString()).toBe(
      "sort=rating&rating=4.5",
    );
    expect(before.toString()).toBe("sort=title&genre=Drama&rating=4");
  });
});

describe("the choices a tab's menus offer", () => {
  const films = [
    film({ title: "Alien", year: 1979, genres: ["Science Fiction", "Horror"] }),
    film({ title: "Heat", year: 1995, genres: ["Crime"] }),
    film({ title: "Se7en", year: 1995, genres: ["Crime", "Mystery"] }),
    film({ title: "Unknown" }),
  ];

  it("are the genres its films have, from A to Z", () => {
    expect(genreChoices(films, null)).toEqual(["Crime", "Horror", "Mystery", "Science Fiction"]);
  });

  it("are the decades its films are from, the newest first", () => {
    expect(decadeChoices(films, null)).toEqual([1990, 1970]);
  });

  it("include the chosen one, even when no film has it", () => {
    expect(genreChoices(films, "Western")).toEqual([
      "Crime",
      "Horror",
      "Mystery",
      "Science Fiction",
      "Western",
    ]);
    expect(decadeChoices(films, 2020)).toEqual([2020, 1990, 1970]);
  });
});
