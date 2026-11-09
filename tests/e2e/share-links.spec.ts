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

test("a User makes a List, adds a film and shares it, and someone logged out opens its Share Link", {
  tag: "@smoke",
}, async ({ page, ui, api, loggedInUser: owner, visitorPage, visitorUi }) => {
  // The owner's Rating, which a shared List never shows.
  const logged = api.log.createLogEntry({
    mediaItemId: (await alien(api)).id,
    rating: 4.5,
    review: "My secret.",
  });
  expect((await logged).status()).toBe(201);

  const { listsPage, listPage } = ui;
  await listsPage.goto();
  await listsPage.newListButton.click();
  const { newListDialog } = listsPage;
  await newListDialog.nameInput.fill("Space horror");
  await newListDialog.descriptionInput.fill("Lights off.");
  await newListDialog.createButton.click();
  await expect(listPage.heading("Space horror")).toBeVisible();
  await listPage.addFilm("Space horror", "alien", "Alien (1979)");
  await expect(listPage.items("Space horror")).toHaveCount(1);

  const shareLinkDialog = listPage.shareLinkDialog("Space horror");
  await listPage.act("Share");
  await expect(shareLinkDialog.root).toHaveAccessibleName("Share Space horror");
  await shareLinkDialog.share();
  // The link is on the app's own origin.
  const origin = new URL(page.url()).origin;
  await expect(shareLinkDialog.root).toHaveAccessibleName("Shared by link");
  await expect(shareLinkDialog.linkField).toHaveValue(/\/s\/[A-Za-z0-9_-]{22,}$/);
  const url = await shareLinkDialog.readLink();
  expect(url.startsWith(`${origin}/s/`)).toBe(true);
  await shareLinkDialog.closeButton.click();
  await expect(listPage.text("Shared by link")).toBeVisible();

  // Someone with no session opens the link.
  const { sharedPage } = visitorUi;
  await visitorUi.goto(url);
  await expect(visitorPage).toHaveTitle("Space horror");
  await expect(sharedPage.text("Film collection")).toBeVisible();
  await expect(sharedPage.heading("Space horror")).toBeVisible();
  await expect(sharedPage.text("Lights off.")).toBeVisible();
  await expect(sharedPage.text(`Shared by ${owner.username} · 1 film`)).toBeVisible();
  const items = sharedPage.items("Space horror");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Alien");
  await expect(items.first()).toContainText("1979");
  await expect(sharedPage.list("Space horror").getByRole("link")).toHaveCount(0);
  await expect(sharedPage.text("My secret.")).toHaveCount(0);
  await expect(sharedPage.inviteLine).toBeVisible();
  // Logged out: the app name and a way to log in, and no sections.
  await expect(sharedPage.header.links).toHaveText(["TasteTrack", "Log in"]);
  await expect(sharedPage.header.accountMenu.button).toHaveCount(0);
  await expect(sharedPage.navigations).toHaveCount(0);

  // The owner stops sharing, once asked; the link stops working.
  await listPage.act("Share Link");
  await shareLinkDialog.stopSharing();
  await expect(shareLinkDialog.shareButton).toBeVisible();
  await visitorPage.reload();
  await expect(sharedPage.notSharedHeading).toBeVisible();
  await expect(sharedPage.text("Space horror")).toHaveCount(0);
  // The invite line, and no button to log in: the header has the link.
  await expect(sharedPage.inviteLine).toBeVisible();
  await expect(sharedPage.main.getByRole("link")).toHaveCount(0);
  await expect(sharedPage.header.logInLink).toBeVisible();
});

test("a new Share Link replaces the old one, once asked", async ({
  ui,
  loggedInApi: api,
  visitorUi,
}) => {
  const { list } = await expectBody(
    api.lists.createList({ name: "Space horror", mediaType: "film" }),
    201,
  );
  const added = await api.lists.addListItem(list.id, { mediaItemId: (await alien(api)).id });
  expect(added.status()).toBe(201);
  const { shareLink } = await expectBody(api.lists.createShareLink(list.id), 201);

  const { listPage } = ui;
  const shareLinkDialog = listPage.shareLinkDialog("Space horror");
  await listPage.goto(list.id);
  await listPage.act("Share Link");
  await expect(shareLinkDialog.linkField).toHaveValue(shareLink.url);

  // Cancel keeps the link.
  await shareLinkDialog.newLinkButton.click();
  const question = shareLinkDialog.confirmation("Make a new link?");
  await expect(question.root).toContainText("Anyone you sent it to will need the new one.");
  await expect(shareLinkDialog.linkField).toBeHidden();
  await question.cancel();
  await expect(shareLinkDialog.linkField).toHaveValue(shareLink.url);

  await shareLinkDialog.makeNewLink();
  await expect(shareLinkDialog.linkField).not.toHaveValue(shareLink.url);
  const newUrl = await shareLinkDialog.readLink();

  const { sharedPage } = visitorUi;
  await visitorUi.goto(newUrl);
  await expect(sharedPage.heading("Space horror")).toBeVisible();
  await expect(sharedPage.list("Space horror")).toContainText("Alien");
  await visitorUi.goto(shareLink.url);
  await expect(sharedPage.notSharedHeading).toBeVisible();
});

test("Copy link puts the Share Link on the clipboard", async ({
  page,
  context,
  ui,
  loggedInApi: api,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const { list } = await expectBody(
    api.lists.createList({ name: "Space horror", mediaType: "film" }),
    201,
  );
  const { shareLink } = await expectBody(api.lists.createShareLink(list.id), 201);

  const { listPage } = ui;
  const shareLinkDialog = listPage.shareLinkDialog("Space horror");
  await listPage.goto(list.id);
  await listPage.act("Share Link");
  await expect(shareLinkDialog.copyButton).toHaveText("Copy link");
  await shareLinkDialog.copyButton.click();
  await expect(shareLinkDialog.copyButton).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shareLink.url);
});

test("an unknown Share Link says the Collection isn't shared any more", async ({ visitorUi }) => {
  const { sharedPage } = visitorUi;
  await sharedPage.goto("no-such-link");

  await expect(sharedPage.notSharedHeading).toBeVisible();
  await expect(sharedPage.inviteLine).toBeVisible();
  await expect(sharedPage.main.getByRole("link")).toHaveCount(0);
});

test("someone logs in from a Share Link and comes back to it, where posters open their films", async ({
  page,
  ui,
  registeredUser,
  otherUserClient: owner,
}) => {
  const { list } = await expectBody(
    owner.lists.createList({ name: "Space horror", mediaType: "film" }),
    201,
  );
  const alienItem = await alien(owner);
  const added = await owner.lists.addListItem(list.id, { mediaItemId: alienItem.id });
  expect(added.status()).toBe(201);
  const { shareLink } = await expectBody(owner.lists.createShareLink(list.id), 201);

  const { sharedPage, loginPage, filmPage } = ui;
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

  // Logged in, a poster opens its film's page.
  await sharedPage.film("Space horror", "Alien").links.click();
  await expect(page).toHaveURL(filmPage.path(alienItem.id));
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
