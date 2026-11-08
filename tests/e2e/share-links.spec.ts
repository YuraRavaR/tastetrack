import type { Page } from "@playwright/test";
import { expectBody } from "../support/api/responses";
import { alien, aliens } from "../support/scenarios/films";
import { test as base, expect } from "../support/ui/fixtures";
import { Ui } from "../support/ui/Ui";

// Locally the Worker calls a TMDB fake; on staging, the real TMDB. Both know Alien and Aliens.

const test = base.extend<{ visitorPage: Page; visitorUi: Ui }>({
  // Someone with no session: a browser of their own.
  visitorPage: async ({ browser }, use) => {
    const visitor = await browser.newContext();
    await use(await visitor.newPage());
    await visitor.close();
  },
  visitorUi: async ({ visitorPage }, use) => {
    await use(new Ui(visitorPage));
  },
});

test("a User shares a List, and someone logged out opens its Share Link", {
  tag: "@smoke",
}, async ({ ui, api, loggedInUser: owner, visitorPage, visitorUi }) => {
  const created = api.lists.createList({
    name: "Space horror",
    description: "Lights off.",
    mediaType: "film",
  });
  const { list } = await expectBody(created, 201);
  const alienItem = await alien(api);
  for (const [film, note] of [
    [alienItem, "Start here."],
    [await aliens(api), null],
  ]) {
    const added = await api.lists.addListItem(list.id, { mediaItemId: film.id, note });
    expect(added.status()).toBe(201);
  }
  // The owner's Rating, which a shared List never shows.
  const logged = api.log.createLogEntry({
    mediaItemId: alienItem.id,
    rating: 4.5,
    review: "My secret.",
  });
  expect((await logged).status()).toBe(201);

  const { shareLinkPanel } = ui.listPage;
  await ui.listPage.goto(list.id);
  await shareLinkPanel.share();
  await expect(shareLinkPanel.linkField).toHaveValue(/\/s\/[A-Za-z0-9_-]{22,}$/);
  const url = await shareLinkPanel.readLink();

  // Someone with no session opens the link.
  const { sharedPage } = visitorUi;
  await visitorUi.goto(url);
  await expect(visitorPage).toHaveTitle("Space horror");
  await expect(sharedPage.heading("Space horror")).toBeVisible();
  await expect(sharedPage.text("Lights off.")).toBeVisible();
  await expect(sharedPage.text(`Shared by ${owner.username} · 2 films`)).toBeVisible();
  const items = sharedPage.items("Space horror");
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText("Alien (1979)");
  await expect(items.first()).toContainText("Start here.");
  await expect(items.last()).toContainText("Aliens (1986)");
  await expect(sharedPage.text("My secret.")).toHaveCount(0);
  await expect(sharedPage.header.accountMenu.button).toHaveCount(0);

  // The owner stops sharing; the link stops working.
  await shareLinkPanel.stopSharing();
  await expect(shareLinkPanel.shareButton).toBeVisible();
  await visitorPage.reload();
  await expect(sharedPage.notFoundMessage).toBeVisible();
  await expect(sharedPage.text("Space horror")).toHaveCount(0);
});

test("a new Share Link replaces the old one", async ({ ui, loggedInApi: api, visitorUi }) => {
  const { list } = await expectBody(
    api.lists.createList({ name: "Space horror", mediaType: "film" }),
    201,
  );
  const added = await api.lists.addListItem(list.id, { mediaItemId: (await alien(api)).id });
  expect(added.status()).toBe(201);

  const { listPage } = ui;
  const { shareLinkPanel } = listPage;
  await listPage.goto(list.id);
  await shareLinkPanel.share();
  await expect(shareLinkPanel.linkField).toHaveValue(/\/s\//);
  const oldUrl = await shareLinkPanel.readLink();
  await shareLinkPanel.makeNewLink();
  await expect(shareLinkPanel.linkField).not.toHaveValue(oldUrl);
  const newUrl = await shareLinkPanel.readLink();

  const { sharedPage } = visitorUi;
  await visitorUi.goto(newUrl);
  await expect(sharedPage.heading("Space horror")).toBeVisible();
  await expect(sharedPage.list("Space horror")).toContainText("Alien (1979)");
  await visitorUi.goto(oldUrl);
  await expect(sharedPage.notFoundMessage).toBeVisible();
});
