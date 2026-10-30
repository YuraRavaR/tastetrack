import { expect, type Page, test } from "@playwright/test";
import { fillBacklog } from "../support/backlog";
import { logInNewUser } from "../support/users";

// Locally the Worker calls a TMDB fake; on staging, the real TMDB. Both know Alien and Aliens, but
// TMDB matches whole words, so Aliens is searched for as "aliens": "alien" doesn't find it there.

function searchResult(page: Page, label: string) {
  return page
    .getByRole("list", { name: "Search results" })
    .getByRole("listitem")
    .filter({ has: page.getByText(label, { exact: true }) });
}

async function search(page: Page, query: string) {
  await page.getByRole("searchbox", { name: "Search films" }).fill(query);
}

test("a User plans films from search, then orders and notes their Watchlist", {
  tag: "@smoke",
}, async ({ page }) => {
  await logInNewUser(page.request);
  await page.goto("/");
  await search(page, "alien");
  const alien = searchResult(page, "Alien (1979)");
  await alien.getByRole("button", { name: "Want to watch" }).click();
  await expect(alien.getByText("On your Watchlist")).toBeVisible();
  await expect(alien.getByRole("button", { name: "Want to watch" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await search(page, "aliens");
  const aliens = searchResult(page, "Aliens (1986)");
  await aliens.getByRole("button", { name: "Want to watch" }).click();
  await expect(aliens.getByText("On your Watchlist")).toBeVisible();

  await page.getByRole("link", { name: "Watchlist" }).click();
  const items = page.getByRole("list", { name: "Watchlist" }).getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(page.getByText("2 films")).toBeVisible();
  await expect(items.first()).toContainText("Alien (1979)");

  // Moving Aliens up puts it first.
  await items.last().getByRole("button", { name: "Move up" }).click();
  await expect(items.first()).toContainText("Aliens (1986)");
  await expect(items.first().getByRole("button", { name: "Move up" })).toBeDisabled();

  // A Note, added and then changed.
  await items.last().getByRole("button", { name: "Add a Note" }).click();
  const noteDialog = page.getByRole("dialog", { name: "Note for Alien (1979)" });
  await noteDialog.getByLabel("Note").fill("Olena's favourite.");
  await noteDialog.getByRole("button", { name: "Save" }).click();
  await expect(noteDialog).toBeHidden();
  await expect(items.last()).toContainText("Olena's favourite.");
  await items.last().getByRole("button", { name: "Edit Note" }).click();
  await expect(noteDialog.getByLabel("Note")).toHaveValue("Olena's favourite.");
  await noteDialog.getByLabel("Note").fill("Watch with Olena.");
  await noteDialog.getByRole("button", { name: "Save" }).click();
  await expect(items.last()).toContainText("Watch with Olena.");

  // The order and the Note are kept.
  await page.reload();
  await expect(items.first()).toContainText("Aliens (1986)");
  await expect(items.last()).toContainText("Watch with Olena.");
});

test("the bookmark in search puts a film on the Watchlist and takes it off again", async ({
  page,
}) => {
  await logInNewUser(page.request);
  await page.goto("/");
  await search(page, "alien");
  const alien = searchResult(page, "Alien (1979)");
  const bookmark = alien.getByRole("button", { name: "Want to watch" });
  await expect(bookmark).toHaveAttribute("aria-pressed", "false");

  await bookmark.click();

  await expect(page.getByText("Put Alien (1979) on your Watchlist.")).toBeVisible();
  await expect(bookmark).toHaveAttribute("aria-pressed", "true");
  await expect(alien.getByText("On your Watchlist")).toBeVisible();

  await bookmark.click();

  await expect(page.getByText("Took Alien (1979) off your Watchlist.")).toBeVisible();
  await expect(bookmark).toHaveAttribute("aria-pressed", "false");
  await expect(alien.getByText("On your Watchlist")).toHaveCount(0);
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("Took Alien (1979) off your Watchlist.")).toHaveCount(0);

  // It is off for good, not only on this screen.
  await page.reload();
  await search(page, "alien");
  await expect(bookmark).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("link", { name: "Watchlist" }).click();
  await expect(page.getByText("Your Watchlist is empty.")).toBeVisible();
});

test("logging a planned film takes it off the Watchlist, and Undo puts it back", async ({
  page,
}) => {
  await logInNewUser(page.request);
  await page.goto("/");
  await search(page, "alien");
  const alien = searchResult(page, "Alien (1979)");
  await alien.getByRole("button", { name: "Want to watch" }).click();
  await expect(alien.getByText("On your Watchlist")).toBeVisible();
  await search(page, "aliens");
  const aliens = searchResult(page, "Aliens (1986)");
  await aliens.getByRole("button", { name: "Want to watch" }).click();
  await expect(aliens.getByText("On your Watchlist")).toBeVisible();
  await search(page, "alien");

  await alien.getByRole("button", { name: "Watched" }).click();
  const dialog = page.getByRole("dialog", { name: "Alien", exact: true });
  await expect(dialog.getByText("Saving takes it off your Watchlist")).toBeVisible();
  await dialog.getByRole("radio", { name: "4 stars" }).check();
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Took Alien (1979) off your Watchlist.")).toBeVisible();
  await expect(alien.getByText("On your Watchlist")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Put Alien (1979) back on your Watchlist.")).toBeVisible();
  // One mark: the pressed bookmark already shows the Watchlist.
  await expect(alien.getByText("In your Log")).toBeVisible();
  await expect(alien.getByText("On your Watchlist")).toHaveCount(0);
  await expect(alien.getByRole("button", { name: "Want to watch" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("link", { name: "Watchlist" }).click();
  const items = page.getByRole("list", { name: "Watchlist" }).getByRole("listitem");
  await expect(items.first()).toContainText("Alien (1979)");
  await expect(items.last()).toContainText("Aliens (1986)");
});

test("removing a film from the Watchlist can be undone", async ({ page }) => {
  await logInNewUser(page.request);
  await page.goto("/");
  await search(page, "alien");
  await searchResult(page, "Alien (1979)").getByRole("button", { name: "Want to watch" }).click();
  await expect(searchResult(page, "Alien (1979)").getByText("On your Watchlist")).toBeVisible();
  await page.getByRole("link", { name: "Watchlist" }).click();
  const items = page.getByRole("list", { name: "Watchlist" }).getByRole("listitem");

  await items.getByRole("button", { name: "Remove" }).click();

  await expect(items).toHaveCount(0);
  await expect(page.getByText("Removed Alien (1979) from your Watchlist.")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(items).toHaveCount(1);
  await expect(items).toContainText("Alien (1979)");
});

test("a full Watchlist says to remove or log some films", async ({ page }) => {
  await fillBacklog(page.request, await logInNewUser(page.request), 1000);
  await page.goto("/");
  await search(page, "alien");

  await searchResult(page, "Alien (1979)").getByRole("button", { name: "Want to watch" }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "Your Watchlist is full: it holds up to 1,000 films. Remove or log some to make room.",
  );
});

test("the Watchlist and a film's page show its runtime and genres", async ({ page }) => {
  await logInNewUser(page.request);
  await page.goto("/");
  await search(page, "alien");
  await searchResult(page, "Alien (1979)").getByRole("button", { name: "Want to watch" }).click();
  await expect(searchResult(page, "Alien (1979)").getByText("On your Watchlist")).toBeVisible();

  await page.getByRole("link", { name: "Watchlist" }).click();
  const items = page.getByRole("list", { name: "Watchlist" }).getByRole("listitem");
  await expect(items).toContainText("117 min · Horror, Science Fiction");
  await items.getByRole("link", { name: "Alien (1979)" }).click();
  await expect(page.getByRole("heading", { name: "Alien (1979)" })).toBeVisible();
  await expect(page.getByText("117 min · Horror, Science Fiction")).toBeVisible();
});
