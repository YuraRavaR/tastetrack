import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import { manualFilm } from "../support/scenarios/films";
import { expect, test } from "../support/ui/fixtures";
import type { LibraryPage } from "../support/ui/pages/LibraryPage";

// Four films the User made by hand and planned, the last added first: Cold Signal, Blue Harbour,
// Amber Fields, Night Train. Blue Harbour has no year or genres.
async function fillBacklog(api: ApiClient) {
  const films = [
    { title: "Night Train", year: 1995, genres: ["Crime", "Thriller"] },
    { title: "Amber Fields", year: 2019, genres: ["Drama", "Romance"] },
    { title: "Blue Harbour", year: null, genres: [] },
    { title: "Cold Signal", year: 1979, genres: ["Horror", "Science Fiction"] },
  ] as const;
  for (const [index, data] of films.entries()) {
    const film = await manualFilm(api, { ...data, genres: [...data.genres] });
    const planned = api.backlog.addBacklogItem(
      { mediaItemId: film.id },
      at(minutesAgo(90 - index)),
    );
    await expectBody(planned, 201);
  }
}

// Four films the User made by hand and logged, the last experienced first: Echo Lane, Golden Hour,
// Dust Road, Iron Bridge.
async function fillExperienced(api: ApiClient) {
  const films = [
    { title: "Iron Bridge", year: 1995, genres: ["Crime"], rating: 4, date: "2026-09-01" },
    {
      title: "Dust Road",
      year: 1990,
      genres: ["Western", "Drama"],
      rating: 4.5,
      date: "2026-10-01",
    },
    { title: "Golden Hour", year: 2019, genres: ["Drama"], rating: 5, date: "2026-10-10" },
    { title: "Echo Lane", year: 2003, genres: ["Comedy"], rating: 3.5, date: "2026-10-20" },
  ] as const;
  for (const { rating, date, ...data } of films) {
    const film = await manualFilm(api, { ...data, genres: [...data.genres] });
    const logged = api.log.createLogEntry({ mediaItemId: film.id, rating, date });
    await expectBody(logged, 201);
  }
}

// The chips, by the names a screen reader reads: what each sets and its current choice.
async function expectChips(libraryPage: LibraryPage, names: string[]) {
  await expect(libraryPage.chips).toHaveCount(names.length);
  for (const [index, name] of names.entries()) {
    await expect(libraryPage.chips.nth(index)).toHaveAccessibleName(name);
  }
}

// The posters, by their films' titles, in this order. A poster's text also holds its placeholder's
// caption and its meta line, and no title here is part of another.
const inOrder = (titles: string[]) => titles.map((title) => new RegExp(title));

test("the Watchlist sorts by Date added, Title and Release year, kept across a reload", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  await fillBacklog(api);
  const { libraryPage } = ui;
  await libraryPage.goto();

  await expectChips(libraryPage, ["Sort: Date added", "Genre: Any genre", "Decade: Any decade"]);
  await expect(libraryPage.posters("Watchlist")).toHaveText(
    inOrder(["Cold Signal", "Blue Harbour", "Amber Fields", "Night Train"]),
  );

  await libraryPage.chip("Sort").click();
  await expect(libraryPage.choices).toHaveText(["Date added", "Title", "Release year"]);
  await expect(libraryPage.choice("Date added")).toHaveAttribute("aria-checked", "true");
  await libraryPage.choice("Title").click();

  await expect(page).toHaveURL(`${libraryPage.path()}?sort=title`);
  await expect(libraryPage.chip("Sort")).toHaveAccessibleName("Sort: Title");
  await expect(libraryPage.posters("Watchlist")).toHaveText(
    inOrder(["Amber Fields", "Blue Harbour", "Cold Signal", "Night Train"]),
  );

  await libraryPage.choose("Sort", "Release year");

  // The newest first, and a film with no year last.
  const byYear = inOrder(["Amber Fields", "Night Train", "Cold Signal", "Blue Harbour"]);
  await expect(libraryPage.posters("Watchlist")).toHaveText(byYear);
  await page.reload();
  await expect(page).toHaveURL(`${libraryPage.path()}?sort=year`);
  await expect(libraryPage.chip("Sort")).toHaveAccessibleName("Sort: Release year");
  await expect(libraryPage.posters("Watchlist")).toHaveText(byYear);
});

test("Watched sorts by Last watched, Rating, Title and Release year", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  await fillExperienced(api);
  const { libraryPage } = ui;
  await libraryPage.goto("Watched");

  await expectChips(libraryPage, [
    "Sort: Last watched",
    "Genre: Any genre",
    "Decade: Any decade",
    "Rating: Any rating",
  ]);
  await expect(libraryPage.posters("Watched")).toHaveText(
    inOrder(["Echo Lane", "Golden Hour", "Dust Road", "Iron Bridge"]),
  );
  await libraryPage.chip("Sort").click();
  await expect(libraryPage.choices).toHaveText(["Last watched", "Rating", "Title", "Release year"]);
  await page.keyboard.press("Escape");

  await libraryPage.choose("Sort", "Rating");
  await expect(page).toHaveURL(`${libraryPage.path("Watched")}?sort=rating`);
  await expect(libraryPage.posters("Watched")).toHaveText(
    inOrder(["Golden Hour", "Dust Road", "Iron Bridge", "Echo Lane"]),
  );

  await libraryPage.choose("Sort", "Title");
  await expect(libraryPage.posters("Watched")).toHaveText(
    inOrder(["Dust Road", "Echo Lane", "Golden Hour", "Iron Bridge"]),
  );

  await libraryPage.choose("Sort", "Release year");
  await expect(libraryPage.posters("Watched")).toHaveText(
    inOrder(["Golden Hour", "Echo Lane", "Iron Bridge", "Dust Road"]),
  );

  await libraryPage.choose("Sort", "Last watched");
  await expect(page).toHaveURL(`${libraryPage.path("Watched")}?sort=watched`);
  await expect(libraryPage.posters("Watched")).toHaveText(
    inOrder(["Echo Lane", "Golden Hour", "Dust Road", "Iron Bridge"]),
  );
});

test("the Watchlist filters by genre and decade, and a film without them shows only while unset", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  await fillBacklog(api);
  const { libraryPage } = ui;
  await libraryPage.goto();
  const unsetLook = await libraryPage.chip("Genre").evaluate((chip) => {
    return getComputedStyle(chip).backgroundColor;
  });

  await libraryPage.chip("Genre").click();
  // "Any genre" first, then the genres the Watchlist's films have.
  await expect(libraryPage.choices).toHaveText([
    "Any genre",
    "Crime",
    "Drama",
    "Horror",
    "Romance",
    "Science Fiction",
    "Thriller",
  ]);
  await expect(libraryPage.choice("Any genre")).toHaveAttribute("aria-checked", "true");
  await libraryPage.choice("Drama").click();

  await expect(page).toHaveURL(`${libraryPage.path()}?genre=Drama`);
  await expect(libraryPage.chip("Genre")).toHaveAccessibleName("Genre: Drama");
  await expect(libraryPage.chip("Genre")).toHaveText("Drama");
  // A chip with a filter set looks selected.
  await expect(libraryPage.chip("Genre")).not.toHaveCSS("background-color", unsetLook);
  await expect(libraryPage.chip("Decade")).toHaveCSS("background-color", unsetLook);
  await expect(libraryPage.posters("Watchlist")).toHaveText(inOrder(["Amber Fields"]));

  await libraryPage.choose("Genre", "Any genre");
  await libraryPage.chip("Decade").click();
  await expect(libraryPage.choices).toHaveText(["Any decade", "2010s", "1990s", "1970s"]);
  await libraryPage.choice("1990s").click();

  await expect(page).toHaveURL(`${libraryPage.path()}?decade=1990`);
  await expect(libraryPage.chip("Decade")).toHaveAccessibleName("Decade: 1990s");
  await expect(libraryPage.posters("Watchlist")).toHaveText(inOrder(["Night Train"]));

  await libraryPage.choose("Decade", "Any decade");
  await expect(page).toHaveURL(libraryPage.path());
  await expect(libraryPage.posters("Watchlist")).toHaveCount(4);
  await expect(libraryPage.poster("Watchlist", "Blue Harbour").link).toBeVisible();
});

test("Watched filters by genre, decade and Rating at once, kept across a reload and Back", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  await fillExperienced(api);
  const { libraryPage, filmPage } = ui;
  await libraryPage.goto("Watched");

  await libraryPage.chip("Rating").click();
  await expect(libraryPage.choices).toHaveText([
    "Any rating",
    "4★ and up",
    "4.5★ and up",
    "5★ only",
  ]);
  await libraryPage.choice("4★ and up").click();
  await expect(libraryPage.posters("Watched")).toHaveText(
    inOrder(["Golden Hour", "Dust Road", "Iron Bridge"]),
  );
  await libraryPage.choose("Rating", "5★ only");
  await expect(libraryPage.chip("Rating")).toHaveAccessibleName("Rating: 5★ only");
  await expect(libraryPage.posters("Watched")).toHaveText(inOrder(["Golden Hour"]));
  await libraryPage.choose("Rating", "4.5★ and up");
  await expect(libraryPage.posters("Watched")).toHaveText(inOrder(["Golden Hour", "Dust Road"]));

  await libraryPage.choose("Genre", "Drama");
  await libraryPage.choose("Decade", "1990s");

  const filtered = `${libraryPage.path("Watched")}?rating=4.5&genre=Drama&decade=1990`;
  await expect(page).toHaveURL(filtered);
  await expect(libraryPage.posters("Watched")).toHaveText(inOrder(["Dust Road"]));
  await page.reload();
  await expectChips(libraryPage, [
    "Sort: Last watched",
    "Genre: Drama",
    "Decade: 1990s",
    "Rating: 4.5★ and up",
  ]);
  await expect(libraryPage.posters("Watched")).toHaveText(inOrder(["Dust Road"]));

  await libraryPage.poster("Watched", "Dust Road").link.click();
  await expect(filmPage.heading).toContainText("Dust Road");
  await page.goBack();
  await expect(page).toHaveURL(filtered);
  await expect(libraryPage.posters("Watched")).toHaveText(inOrder(["Dust Road"]));
});

test("filters that match nothing say so, and Clear filters keeps the sort", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  await fillBacklog(api);
  const { libraryPage } = ui;
  await libraryPage.goto();
  await libraryPage.choose("Sort", "Title");
  await libraryPage.choose("Genre", "Horror");

  await libraryPage.choose("Decade", "2010s");

  await expect(libraryPage.posters("Watchlist")).toHaveCount(0);
  await expect(libraryPage.text("No films match these filters.")).toBeVisible();
  await libraryPage.clearFiltersButton.click();

  await expect(page).toHaveURL(`${libraryPage.path()}?sort=title`);
  await expect(libraryPage.text("No films match these filters.")).toBeHidden();
  await expect(libraryPage.posters("Watchlist")).toHaveText(
    inOrder(["Amber Fields", "Blue Harbour", "Cold Signal", "Night Train"]),
  );
});

test("the browser remembers each tab's sort, and the filters go along to the other tab", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  await fillBacklog(api);
  await fillExperienced(api);
  const { libraryPage } = ui;
  await libraryPage.goto();
  await libraryPage.choose("Sort", "Title");
  await libraryPage.choose("Genre", "Drama");

  await libraryPage.tab("Watched").click();

  // Watched keeps its own default sort, and the genre the Watchlist was filtered on.
  await expect(page).toHaveURL(`${libraryPage.path("Watched")}?genre=Drama`);
  await expect(libraryPage.chip("Sort")).toHaveAccessibleName("Sort: Last watched");
  await expect(libraryPage.posters("Watched")).toHaveText(inOrder(["Golden Hour", "Dust Road"]));
  await libraryPage.choose("Sort", "Rating");
  await libraryPage.choose("Rating", "5★ only");
  await expect(libraryPage.posters("Watched")).toHaveText(inOrder(["Golden Hour"]));

  // The Watchlist has no Rating filter, but keeps it for the way back to Watched.
  await libraryPage.tab("Watchlist").click();
  await expect(page).toHaveURL(`${libraryPage.path()}?genre=Drama&rating=5`);
  await expect(libraryPage.chips).toHaveCount(3);
  await expect(libraryPage.posters("Watchlist")).toHaveText(inOrder(["Amber Fields"]));
  await libraryPage.tab("Watched").click();
  await expect(libraryPage.chip("Rating")).toHaveAccessibleName("Rating: 5★ only");
  await expect(libraryPage.posters("Watched")).toHaveText(inOrder(["Golden Hour"]));

  await libraryPage.goto();
  await expect(libraryPage.chip("Sort")).toHaveAccessibleName("Sort: Title");
  await expect(libraryPage.posters("Watchlist")).toHaveText(
    inOrder(["Amber Fields", "Blue Harbour", "Cold Signal", "Night Train"]),
  );
  await libraryPage.goto("Watched");
  await expect(libraryPage.chip("Sort")).toHaveAccessibleName("Sort: Rating");
});

test("on a phone the chips sit on one line that scrolls sideways", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  await fillExperienced(api);
  const { libraryPage } = ui;
  await page.setViewportSize({ width: 402, height: 874 });
  await libraryPage.goto("Watched");

  await expect(libraryPage.chips).toHaveCount(4);
  const tops = await libraryPage.chips.evaluateAll((chips) => {
    return chips.map((chip) => Math.round(chip.getBoundingClientRect().top));
  });
  expect(new Set(tops).size).toBe(1);
  const row = await libraryPage.chipsGroup.evaluate((group) => {
    return { scrollWidth: group.scrollWidth, clientWidth: group.clientWidth };
  });
  expect(row.scrollWidth).toBeGreaterThan(row.clientWidth);
  // The row scrolls, not the page.
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBe(402);

  await libraryPage.chip("Rating").scrollIntoViewIfNeeded();
  await libraryPage.choose("Rating", "5★ only");
  await expect(libraryPage.posters("Watched")).toHaveText(inOrder(["Golden Hour"]));
});
