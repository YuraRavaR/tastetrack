import { expect, test } from "@playwright/test";
import { alien, aliens } from "../support/films";
import { logInNewUser } from "../support/users";

// Locally the Worker calls a TMDB fake; on staging, the real TMDB. Both know Alien and Aliens.

test("a User shares a List, and someone logged out opens its Share Link", {
  tag: "@smoke",
}, async ({ page, browser }) => {
  const owner = await logInNewUser(page.request);
  const created = await page.request.post("/api/lists", {
    data: { name: "Space horror", description: "Lights off.", mediaType: "film" },
  });
  const { list } = await created.json();
  for (const [film, note] of [
    [await alien(page.request), "Start here."],
    [await aliens(page.request), null],
  ]) {
    await page.request.post(`/api/lists/${list.id}/items`, {
      data: { mediaItemId: film.id, note },
    });
  }
  // The owner's Rating, which a shared List never shows.
  await page.request.post("/api/log-entries", {
    data: { mediaItemId: (await alien(page.request)).id, rating: 4.5, review: "My secret." },
  });

  await page.goto(`/lists/${list.id}`);
  await page.getByRole("button", { name: "Share" }).click();
  const linkField = page.getByRole("textbox", { name: "Share Link" });
  await expect(linkField).toHaveValue(/\/s\/[A-Za-z0-9_-]{22,}$/);
  const url = await linkField.inputValue();

  // Someone with no session opens the link.
  const visitor = await browser.newContext();
  const visit = await visitor.newPage();
  await visit.goto(url);
  await expect(visit).toHaveTitle("Space horror");
  await expect(visit.getByRole("heading", { name: "Space horror" })).toBeVisible();
  await expect(visit.getByText("Lights off.")).toBeVisible();
  await expect(visit.getByText(`Shared by ${owner.username} · 2 films`)).toBeVisible();
  const items = visit.getByRole("list", { name: "Space horror" }).getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText("Alien (1979)");
  await expect(items.first()).toContainText("Start here.");
  await expect(items.last()).toContainText("Aliens (1986)");
  await expect(visit.getByText("My secret.")).toHaveCount(0);
  await expect(visit.getByRole("button", { name: "Account menu" })).toHaveCount(0);

  // The owner stops sharing; the link stops working.
  await page.getByRole("button", { name: "Stop sharing" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Stop sharing?" });
  await confirm.getByRole("button", { name: "Stop sharing" }).click();
  await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
  await visit.reload();
  await expect(visit.getByText("This link doesn't work.")).toBeVisible();
  await expect(visit.getByText("Space horror")).toHaveCount(0);
  await visitor.close();
});

test("a User shares their Watchlist, and a new link replaces the old one", async ({
  page,
  browser,
}) => {
  const owner = await logInNewUser(page.request);
  await page.request.post("/api/backlog/items", {
    data: { mediaItemId: (await alien(page.request)).id },
  });

  await page.goto("/watchlist");
  await page.getByRole("button", { name: "Share" }).click();
  const linkField = page.getByRole("textbox", { name: "Share Link" });
  await expect(linkField).toHaveValue(/\/s\//);
  const oldUrl = await linkField.inputValue();
  await page.getByRole("button", { name: "New link" }).click();
  await page
    .getByRole("alertdialog", { name: "Make a new link?" })
    .getByRole("button", { name: "Make a new link" })
    .click();
  await expect(linkField).not.toHaveValue(oldUrl);
  const newUrl = await linkField.inputValue();

  const visitor = await browser.newContext();
  const visit = await visitor.newPage();
  await visit.goto(newUrl);
  const title = `${owner.username}'s Watchlist`;
  await expect(visit.getByRole("heading", { name: title })).toBeVisible();
  await expect(visit.getByRole("list", { name: title })).toContainText("Alien (1979)");
  await visit.goto(oldUrl);
  await expect(visit.getByText("This link doesn't work.")).toBeVisible();
  await visitor.close();
});
