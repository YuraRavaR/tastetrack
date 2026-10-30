import { expect, type Page, test } from "@playwright/test";
import { alien, aliens, film, newFilm } from "../support/films";
import { callsRealTmdb } from "../support/tmdb";
import { logInNewUser } from "../support/users";

// Leaves every TMDB image loading for good, so the tests see the page before any image arrives
// and depend on neither TMDB nor the network.
async function holdImages(page: Page): Promise<void> {
  await page.route("https://image.tmdb.org/**", () => {});
}

async function openFilm(page: Page, mediaItemId: number): Promise<void> {
  await page.goto(`/items/${mediaItemId}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test("a film's page opens with its backdrop, sized for the screen", async ({ page }) => {
  await holdImages(page);
  await logInNewUser(page.request);
  const { id, metadata } = await alien(page.request);

  await page.setViewportSize({ width: 402, height: 874 });
  await openFilm(page, id);

  const backdrop = page.getByRole("main").locator("picture");
  await expect(backdrop.locator("img")).toHaveAttribute("src", metadata.backdropUrls.small);
  await expect(backdrop.locator("source")).toHaveAttribute("srcset", metadata.backdropUrls.large);
  // The space is taken before the image loads, so the page doesn't jump.
  expect((await backdrop.boundingBox())?.height).toBe(184);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(async () => (await backdrop.boundingBox())?.height).toBe(260);
});

test("a film without a backdrop shows its poster in the banner, larger than a thumbnail", async ({
  page,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film without a backdrop");
  await holdImages(page);
  await logInNewUser(page.request);
  const { id, metadata } = await aliens(page.request);

  await openFilm(page, id);

  const main = page.getByRole("main");
  await expect(main.locator("picture")).toHaveCount(0);
  const poster = main.locator(`img[src="${metadata.posterUrl}"]`);
  await expect(poster).toHaveCSS("width", "112px");
  await expect(poster).toHaveCSS("height", "168px");
});

test("a film with neither shows the placeholder with its caption", async ({ page }) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film no one has added");
  await holdImages(page);
  await logInNewUser(page.request);
  const { id, query } = newFilm();
  const added = await film(page.request, query, id);

  await openFilm(page, added.id);

  await expect(page.getByRole("main").getByRole("img", { name: "No poster" })).toHaveText(/\S/);
});

test("before a first viewing, a film's page offers the actions and explains its empty Viewings", async ({
  page,
}) => {
  await holdImages(page);
  await logInNewUser(page.request);
  const { id } = await alien(page.request);

  await openFilm(page, id);

  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: "Watched", exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Want to watch" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Add to list" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Viewings" })).toBeVisible();
  await expect(main.getByText("No viewings yet")).toBeVisible();
  await expect(
    main.getByText("Each time you watch it, the date, Rating and Review show here."),
  ).toBeVisible();
  await expect(main.getByText("Your rating")).toBeHidden();
});

test("the Watchlist toggles from a film's page, and stays as it was left", async ({ page }) => {
  await holdImages(page);
  await logInNewUser(page.request);
  const { id } = await alien(page.request);
  await openFilm(page, id);
  const main = page.getByRole("main");
  const toast = page.getByRole("status");

  await main.getByRole("button", { name: "Want to watch" }).click();

  const pressed = main.getByRole("button", { name: "On your Watchlist", pressed: true });
  await expect(pressed).toBeVisible();
  await expect(toast).toHaveText(/Put Alien \(1979\) on your Watchlist\./);

  await page.reload();
  await expect(pressed).toBeVisible();

  await pressed.click();

  await expect(main.getByRole("button", { name: "Want to watch", pressed: false })).toBeVisible();
  await expect(toast).toHaveText(/Took Alien \(1979\) off your Watchlist\./);
  await page.goto("/watchlist");
  await expect(page.getByText("Your Watchlist is empty.")).toBeVisible();
});

test("logging a Revisit from a film's page updates its tiles and Viewings at once", async ({
  page,
}) => {
  await holdImages(page);
  await page.clock.setFixedTime(new Date("2026-03-15T12:00:00"));
  await logInNewUser(page.request);
  const { id } = await alien(page.request);
  const first = await page.request.post("/api/log-entries", {
    data: { mediaItemId: id, rating: 5, date: "2026-03-01", timeZone: "UTC" },
  });
  expect(first.status(), await first.text()).toBe(201);
  await openFilm(page, id);
  const main = page.getByRole("main");
  const [watched, rating] = [
    main.getByRole("definition").nth(0),
    main.getByRole("definition").nth(1),
  ];
  await expect(watched).toHaveText("Once");
  await expect(rating.getByRole("img", { name: "5 stars" })).toBeVisible();

  await main.getByRole("button", { name: "Watched again" }).click();
  const dialog = page.getByRole("dialog", { name: "Alien", exact: true });
  await expect(dialog.getByRole("switch", { name: "Rewatch" })).toBeChecked();
  await dialog.getByRole("radio", { name: "3 stars" }).check();
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(dialog).toBeHidden();
  await expect(watched).toHaveText("2 times");
  await expect(rating.getByRole("img", { name: "3 stars" })).toBeVisible();
  const viewings = main.getByRole("list", { name: "Viewings" }).getByRole("listitem");
  await expect(viewings).toHaveCount(2);
  await expect(viewings.first().getByText("Rewatch", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Added Alien (1979) to your Log.");
});

test("a first viewing from a film's page takes it off the Watchlist, with an undo", async ({
  page,
}) => {
  await holdImages(page);
  await page.clock.setFixedTime(new Date("2026-03-15T12:00:00"));
  await logInNewUser(page.request);
  const { id } = await alien(page.request);
  const planned = await page.request.post("/api/backlog/items", { data: { mediaItemId: id } });
  expect(planned.status(), await planned.text()).toBe(201);
  await openFilm(page, id);
  const main = page.getByRole("main");

  await main.getByRole("button", { name: "Watched", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Alien", exact: true });
  await expect(dialog.getByRole("switch", { name: "Rewatch" })).not.toBeChecked();
  await expect(dialog.getByText("Saving takes it off your Watchlist")).toBeVisible();
  await dialog.getByRole("radio", { name: "3 stars" }).check();
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(main.getByRole("button", { name: "Watched again" })).toBeVisible();
  await expect(main.getByRole("list", { name: "Viewings" }).getByRole("listitem")).toHaveCount(1);
  await expect(main.getByRole("button", { name: "Want to watch", pressed: false })).toBeVisible();

  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();

  await expect(
    main.getByRole("button", { name: "On your Watchlist", pressed: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(/Put Alien \(1979\) back on your Watchlist\./);
});
