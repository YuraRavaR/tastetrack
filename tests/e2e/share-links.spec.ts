import type { Locator, Page } from "@playwright/test";
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
  await expect(sharedPage.text("Film collection")).toBeVisible();
  await expect(sharedPage.heading("Space horror")).toBeVisible();
  await expect(sharedPage.text("Lights off.")).toBeVisible();
  await expect(sharedPage.text(`Shared by ${owner.username} · 2 films`)).toBeVisible();
  const items = sharedPage.items("Space horror");
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText("Alien");
  await expect(items.first()).toContainText("1979");
  await expect(items.first()).toContainText("Start here.");
  await expect(items.last()).toContainText("Aliens");
  await expect(items.last()).toContainText("1986");
  await expect(sharedPage.list("Space horror").getByRole("link")).toHaveCount(0);
  await expect(sharedPage.text("My secret.")).toHaveCount(0);
  await expect(sharedPage.inviteLine).toBeVisible();
  // Logged out: the app name and a way to log in, and no sections.
  await expect(sharedPage.header.links).toHaveText(["TasteTrack", "Log in"]);
  await expect(sharedPage.header.accountMenu.button).toHaveCount(0);
  await expect(sharedPage.navigations).toHaveCount(0);

  // The owner stops sharing; the link stops working.
  await shareLinkPanel.stopSharing();
  await expect(shareLinkPanel.shareButton).toBeVisible();
  await visitorPage.reload();
  await expect(sharedPage.notSharedHeading).toBeVisible();
  await expect(sharedPage.text("Space horror")).toHaveCount(0);
  // The invite line, and no button to log in: the header has the link.
  await expect(sharedPage.inviteLine).toBeVisible();
  await expect(sharedPage.main.getByRole("link")).toHaveCount(0);
  await expect(sharedPage.header.logInLink).toBeVisible();
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
  await expect(sharedPage.list("Space horror")).toContainText("Alien");
  await visitorUi.goto(oldUrl);
  await expect(sharedPage.notSharedHeading).toBeVisible();
});

test("someone logs in from a Share Link and comes back to it, in the app's frame", async ({
  page,
  ui,
  registeredUser,
  otherUserClient: owner,
}) => {
  const { list } = await expectBody(
    owner.lists.createList({ name: "Space horror", mediaType: "film" }),
    201,
  );
  const added = await owner.lists.addListItem(list.id, { mediaItemId: (await alien(owner)).id });
  expect(added.status()).toBe(201);
  const { shareLink } = await expectBody(owner.lists.createShareLink(list.id), 201);

  const { sharedPage, loginPage } = ui;
  await sharedPage.goto(shareLink.token);
  await sharedPage.header.logInLink.click();
  await expect(page).toHaveURL(loginPage.path());
  await loginPage.logIn(registeredUser);

  await expect(page).toHaveURL(sharedPage.path(shareLink.token));
  await expect(sharedPage.film("Space horror", "Alien").root).toBeVisible();
  await expect(sharedPage.mainNav.links).toHaveText(["Saved", "Collections", "Search"]);
  await expect(sharedPage.header.accountMenu.button).toBeVisible();
  await expect(sharedPage.header.logInLink).toHaveCount(0);
  await expect(sharedPage.inviteLine).toHaveCount(0);
});

// A long Note, past three lines on a phone.
const longNote =
  "Start here, with the lights off and the phone in another room. The first hour is slow on " +
  "purpose: the crew wake, eat, joke and answer a signal nobody understands. By the time the " +
  "egg chamber opens you know every face, which is what makes the rest of it hurt.";

test.describe("on a phone", () => {
  test.use({ viewport: { width: 402, height: 874 } });

  test("a long Note is cut at three lines, and More and Less open and cut it", async ({
    loggedInApi: api,
    visitorUi,
  }) => {
    const { list } = await expectBody(
      api.lists.createList({ name: "Space horror", mediaType: "film" }),
      201,
    );
    for (const [film, note] of [
      [await alien(api), longNote],
      [await aliens(api), "Then this."],
    ] as const) {
      const added = await api.lists.addListItem(list.id, { mediaItemId: film.id, note });
      expect(added.status()).toBe(201);
    }
    const { shareLink } = await expectBody(api.lists.createShareLink(list.id), 201);

    const { sharedPage } = visitorUi;
    await sharedPage.goto(shareLink.token);
    const alienFilm = sharedPage.film("Space horror", "Alien");
    const aliensFilm = sharedPage.film("Space horror", "Aliens");

    // A short Note is all there, and no button.
    await expect(aliensFilm.note("Then this.")).toBeVisible();
    await expect(aliensFilm.buttons).toHaveCount(0);

    await expect(alienFilm.moreButton).toContainText("More");
    const cutHeight = await heightOf(alienFilm.moreButton);
    await alienFilm.moreButton.click();
    await expect(alienFilm.lessButton).toContainText("Less");
    expect(await heightOf(alienFilm.lessButton)).toBeGreaterThan(cutHeight);

    await alienFilm.lessButton.click();
    await expect(alienFilm.moreButton).toBeVisible();
    expect(await heightOf(alienFilm.moreButton)).toBe(cutHeight);
    // The posters lead nowhere.
    await expect(alienFilm.links).toHaveCount(0);
  });
});

function heightOf(element: Locator) {
  return element.evaluate((node: HTMLElement) => node.offsetHeight);
}
