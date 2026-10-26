import { expect, test } from "@playwright/test";
import { alien, aliens, amelie } from "../support/films";
import { logInNewUser } from "../support/users";

test("a new User's home leads with the search and an empty Log", async ({ page }) => {
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
    .getByRole("button", { name: "Watched" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Log Alien (1979)" });
  await dialog.getByRole("radio", { name: "4 stars" }).check();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(log).toBeHidden();
  await search.fill("");

  await expect(log.getByRole("listitem")).toHaveCount(1);
  await expect(log.getByRole("listitem")).toContainText("Alien (1979)");
  await expect(log.getByRole("link", { name: "See your Log" })).toBeVisible();
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
