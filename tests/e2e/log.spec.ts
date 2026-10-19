import { expect, test } from "@playwright/test";
import { logInNewUser } from "../support/users";

// Locally the Worker calls a TMDB fake; on staging, the real TMDB. Both know Alien.

test("a User marks a search result Watched, rates it and finds it in their Log", async ({
  page,
}) => {
  await logInNewUser(page.request);
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search films" }).fill("alien");
  const alien = page
    .getByRole("list", { name: "Search results" })
    .getByRole("listitem")
    .filter({ has: page.getByText("Alien (1979)", { exact: true }) });

  await alien.getByRole("button", { name: "Watched" }).click();
  const dialog = page.getByRole("dialog", { name: "Log Alien (1979)" });
  await dialog.getByRole("radio", { name: "4.5 stars" }).check();
  await dialog.getByLabel("Review").fill("Still terrifying.");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(dialog).toBeHidden();
  await expect(alien.getByText("In your Log")).toBeVisible();
  await page.getByRole("link", { name: "Log", exact: true }).click();
  const entry = page.getByRole("list", { name: "Log Entries" }).getByRole("listitem");
  await expect(entry).toHaveCount(1);
  await expect(entry.getByText("Alien (1979)", { exact: true })).toBeVisible();
  await expect(entry.getByText("Чужий", { exact: true })).toBeVisible();
  await expect(entry.getByRole("img", { name: "4.5 stars" })).toBeVisible();
  await expect(entry.getByText("Still terrifying.")).toBeVisible();
});

test("a Rating is required, and a date and Rewatch are kept", async ({ page }) => {
  await logInNewUser(page.request);
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search films" }).fill("alien");
  await page
    .getByRole("list", { name: "Search results" })
    .getByRole("listitem")
    .filter({ has: page.getByText("Alien (1979)", { exact: true }) })
    .getByRole("button", { name: "Watched" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Log Alien (1979)" });

  await dialog.getByLabel("Date").fill("2001-09-15");
  await dialog.getByRole("checkbox", { name: "Rewatch" }).check();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: "3 stars" }).check();
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(dialog).toBeHidden();
  await page.getByRole("link", { name: "Log", exact: true }).click();
  const entry = page.getByRole("list", { name: "Log Entries" }).getByRole("listitem");
  await expect(entry.getByRole("img", { name: "3 stars" })).toBeVisible();
  await expect(entry.getByText("15 Sep 2001")).toBeVisible();
  await expect(entry.getByText("Rewatch", { exact: true })).toBeVisible();
});
