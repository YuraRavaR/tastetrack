import { expect, test } from "@playwright/test";
import { fillBacklog } from "../support/backlog";
import { alien, aliens, amelie } from "../support/films";
import { logInNewUser } from "../support/users";

test("a new User's home leads with the search, an empty Log and an empty Watchlist", async ({
  page,
}) => {
  await logInNewUser(page.request);

  await page.goto("/");

  await expect(page).toHaveTitle("TasteTrack");
  await expect(page.getByRole("heading", { level: 1, name: "Search films" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search films" })).toBeVisible();
  const log = page.getByRole("region", { name: "Latest in your Log" });
  await expect(
    log.getByText("Your Log is empty. Search for a film you've watched and mark it Watched."),
  ).toBeVisible();
  await expect(log.getByRole("link")).toHaveCount(0);
  const watchlist = page.getByRole("region", { name: "Next on your Watchlist" });
  await expect(
    watchlist.getByText("Your Watchlist is empty. Search for a film and mark it Want to watch."),
  ).toBeVisible();
  await expect(watchlist.getByRole("link")).toHaveCount(0);
  await expect(page.getByText("The server is up")).toHaveCount(0);
});

test("home shows the latest five Log Entries, latest first, and links to the whole Log", async ({
  page,
}) => {
  await logInNewUser(page.request);
  const films = {
    alien: await alien(page.request),
    aliens: await aliens(page.request),
    amelie: await amelie(page.request),
  };
  // Created out of date order: the Log's order is by date.
  for (const [film, date, rating, revisit, review] of [
    ["aliens", "2024-05-06", 5, true, "Better than I remembered."],
    ["alien", "2020-01-01", 3, false, undefined],
    ["amelie", "2025-06-07", 2.5, true, undefined],
    ["aliens", "2021-02-03", 3.5, false, undefined],
    ["alien", "2023-04-05", 4.5, true, undefined],
    ["amelie", "2022-03-04", 4, false, undefined],
  ] as const) {
    const response = await page.request.post("/api/log-entries", {
      data: { mediaItemId: films[film].id, date, rating, revisit, review },
    });
    expect(response.status()).toBe(201);
  }

  await page.goto("/");

  const log = page.getByRole("region", { name: "Latest in your Log" });
  const entries = log.getByRole("listitem");
  await expect(entries).toHaveCount(5);
  await expect(entries.nth(0)).toContainText("Amélie");
  await expect(entries.nth(0)).toContainText("Jun 7, 2025");
  await expect(entries.nth(0).getByRole("img", { name: "2.5 stars" })).toBeVisible();
  await expect(entries.nth(0).getByText("Rewatch", { exact: true })).toBeVisible();
  await expect(entries.nth(1)).toContainText("Aliens (1986)");
  await expect(entries.nth(1)).toContainText("May 6, 2024");
  await expect(entries.nth(1)).not.toContainText("Better than I remembered.");
  await expect(entries.nth(2)).toContainText("Alien (1979)");
  await expect(entries.nth(2)).toContainText("Apr 5, 2023");
  await expect(entries.nth(3)).toContainText("Mar 4, 2022");
  await expect(entries.nth(3).getByText("Rewatch", { exact: true })).toHaveCount(0);
  await expect(entries.nth(4)).toContainText("Feb 3, 2021");
  await expect(log).not.toContainText("Jan 1, 2020");
  await expect(log.getByRole("button")).toHaveCount(0);

  await expect(log.getByRole("link", { name: "All 6 in your Log" })).toHaveAttribute(
    "href",
    "/log",
  );
  await entries.nth(1).getByRole("link", { name: "Aliens (1986)" }).click();
  await expect(page).toHaveURL(`/items/${films.aliens.id}`);
});

test("home shows the Watchlist in its saved order with each film's facts and Note", async ({
  page,
}) => {
  await logInNewUser(page.request);
  const films = {
    alien: await alien(page.request),
    aliens: await aliens(page.request),
    amelie: await amelie(page.request),
  };
  // Planned out of the order they end up in: the Watchlist's order is the User's.
  for (const data of [
    { mediaItemId: films.alien.id, note: "Watch with Olena." },
    { mediaItemId: films.amelie.id },
    { mediaItemId: films.aliens.id, position: 0 },
  ]) {
    const response = await page.request.post("/api/backlog/items", { data });
    expect(response.status()).toBe(201);
  }

  await page.goto("/");

  const watchlist = page.getByRole("region", { name: "Next on your Watchlist" });
  const items = watchlist.getByRole("listitem");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText("Aliens (1986)");
  await expect(items.nth(1)).toContainText("Alien (1979)");
  await expect(items.nth(1)).toContainText("117 min · Horror, Science Fiction");
  await expect(items.nth(1).getByText("Watch with Olena.")).toBeVisible();
  await expect(items.nth(2)).toContainText("Amélie");
  await expect(watchlist.getByRole("button")).toHaveCount(0);

  await expect(watchlist.getByRole("link", { name: "All 3 on your Watchlist" })).toHaveAttribute(
    "href",
    "/watchlist",
  );
  await items.nth(1).getByRole("link", { name: "Alien (1979)" }).click();
  await expect(page).toHaveURL(`/items/${films.alien.id}`);
});

test("home shows the first five films of a longer Watchlist and counts them all", async ({
  page,
}) => {
  await fillBacklog(page.request, await logInNewUser(page.request), 5);
  const sixth = await page.request.post("/api/backlog/items", {
    data: { mediaItemId: (await alien(page.request)).id },
  });
  expect(sixth.status()).toBe(201);

  await page.goto("/");

  const watchlist = page.getByRole("region", { name: "Next on your Watchlist" });
  await expect(watchlist.getByRole("listitem")).toHaveCount(5);
  await expect(watchlist).not.toContainText("Alien (1979)");
  await expect(watchlist.getByRole("link", { name: "All 6 on your Watchlist" })).toBeVisible();
});

test("a long Note on home stays on one line, without scrolling a phone sideways", async ({
  page,
}) => {
  await logInNewUser(page.request);
  const planned = await page.request.post("/api/backlog/items", {
    data: { mediaItemId: (await alien(page.request)).id, note: "Watch with Olena. ".repeat(10) },
  });
  expect(planned.status()).toBe(201);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/");

  const note = page
    .getByRole("region", { name: "Next on your Watchlist" })
    .getByText("Watch with Olena.");
  await expect(note).toBeVisible();
  expect((await note.boundingBox())?.height).toBeLessThan(30);
  const scrollsSideways = await page.evaluate(() => {
    const { scrollWidth, clientWidth } = document.documentElement;
    return scrollWidth > clientWidth;
  });
  expect(scrollsSideways).toBe(false);
});

test("searching hides the Log, which shows a film just logged once the search is cleared", async ({
  page,
}) => {
  await logInNewUser(page.request);
  await page.goto("/");
  const log = page.getByRole("region", { name: "Latest in your Log" });
  await expect(log.getByText(/Your Log is empty/)).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search films" });

  await search.fill("alien");
  await expect(log).toBeHidden();
  await page
    .getByRole("list", { name: "Search results" })
    .getByRole("listitem")
    .filter({ has: page.getByText("Alien (1979)", { exact: true }) })
    .getByRole("button", { name: "Mark watched" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Alien", exact: true });
  await dialog.getByRole("radio", { name: "4 stars" }).check();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(log).toBeHidden();
  await search.fill("");

  await expect(log.getByRole("listitem")).toHaveCount(1);
  await expect(log.getByRole("listitem")).toContainText("Alien (1979)");
  await expect(log.getByRole("link", { name: "See your Log" })).toBeVisible();
});

test("a film on the Watchlist marked Watched from search moves to the Log once the search is cleared", async ({
  page,
}) => {
  await logInNewUser(page.request);
  const film = await alien(page.request);
  const planned = await page.request.post("/api/backlog/items", {
    data: { mediaItemId: film.id },
  });
  expect(planned.status()).toBe(201);
  await page.goto("/");
  const log = page.getByRole("region", { name: "Latest in your Log" });
  const watchlist = page.getByRole("region", { name: "Next on your Watchlist" });
  await expect(watchlist.getByRole("listitem")).toContainText("Alien (1979)");
  await expect(watchlist.getByRole("link", { name: "See your Watchlist" })).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search films" });

  await search.fill("alien");
  await expect(watchlist).toBeHidden();
  await page
    .getByRole("list", { name: "Search results" })
    .getByRole("listitem")
    .filter({ has: page.getByText("Alien (1979)", { exact: true }) })
    .getByRole("button", { name: "Mark watched" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Alien", exact: true });
  await dialog.getByRole("radio", { name: "4 stars" }).check();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await search.fill("");

  await expect(log.getByRole("listitem")).toContainText("Alien (1979)");
  await expect(watchlist.getByText(/Your Watchlist is empty/)).toBeVisible();
  await expect(watchlist.getByRole("listitem")).toHaveCount(0);
});

test("a Watchlist that fails to load says so under its heading, and the Log still shows", async ({
  page,
}) => {
  await logInNewUser(page.request);
  const logged = await page.request.post("/api/log-entries", {
    data: { mediaItemId: (await alien(page.request)).id, rating: 4 },
  });
  expect(logged.status()).toBe(201);
  await page.route("**/api/backlog?*", (route) => route.fulfill({ status: 500 }));

  await page.goto("/");

  const watchlist = page.getByRole("region", { name: "Next on your Watchlist" });
  await expect(watchlist.getByRole("heading", { name: "Next on your Watchlist" })).toBeVisible();
  await expect(watchlist.getByRole("alert")).toHaveText(
    "Couldn't load your Watchlist. Please try again.",
  );
  await expect(
    page.getByRole("region", { name: "Latest in your Log" }).getByRole("listitem"),
  ).toContainText("Alien (1979)");
});

test("a Log that fails to load leaves the Watchlist showing", async ({ page }) => {
  await logInNewUser(page.request);
  const planned = await page.request.post("/api/backlog/items", {
    data: { mediaItemId: (await alien(page.request)).id },
  });
  expect(planned.status()).toBe(201);
  await page.route("**/api/log-entries", (route) => route.fulfill({ status: 500 }));

  await page.goto("/");

  await expect(
    page.getByRole("region", { name: "Latest in your Log" }).getByRole("alert"),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Next on your Watchlist" }).getByRole("listitem"),
  ).toContainText("Alien (1979)");
});

test("a Log that fails to load says so under its heading, and the search still works", async ({
  page,
}) => {
  await logInNewUser(page.request);
  await page.route("**/api/log-entries", (route) => route.fulfill({ status: 500 }));

  await page.goto("/");

  const log = page.getByRole("region", { name: "Latest in your Log" });
  await expect(log.getByRole("heading", { name: "Latest in your Log" })).toBeVisible();
  await expect(log.getByRole("alert")).toHaveText("Couldn't load your Log. Please try again.");
  await page.getByRole("searchbox", { name: "Search films" }).fill("alien");
  await expect(
    page.getByRole("list", { name: "Search results" }).getByText("Alien (1979)", { exact: true }),
  ).toBeVisible();
});

test("a deep link loads the app, not a 404", async ({ page }) => {
  const response = await page.goto("/some/client/route");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("link", { name: "TasteTrack" })).toBeVisible();
});
