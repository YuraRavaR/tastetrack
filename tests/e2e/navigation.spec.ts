import type { Locator, Page } from "@playwright/test";
import packageJson from "../../package.json" with { type: "json" };
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { alien } from "../support/scenarios/films";
import type { TestUser } from "../support/scenarios/users";
import type { Footer } from "../support/ui/components/Footer";
import type { MainNav } from "../support/ui/components/MainNav";
import { expect, test } from "../support/ui/fixtures";
import type { BasePage } from "../support/ui/pages/BasePage";
import type { Ui } from "../support/ui/Ui";

// Each section and where it leads. Saved leads to "/", which opens the films' Watchlist until
// Saved has its tiles.
function sectionsOf(ui: Ui) {
  return [
    { name: "Saved", sectionPage: ui.libraryPage },
    { name: "Collections", sectionPage: ui.listsPage },
    { name: "Search", sectionPage: ui.searchPage },
  ];
}

// Follows each section from `nav`, in order, which marks that one alone as the current page. It
// starts on Settings, outside every section, so the first click leaves the page it is on.
async function expectSectionsIn(nav: MainNav, page: Page, ui: Ui) {
  await ui.settingsPage.goto();
  await expect(nav.links).toHaveText(sectionsOf(ui).map(({ name }) => name));
  await expect(nav.currentLinks).toHaveCount(0);
  for (const { name, sectionPage } of sectionsOf(ui)) {
    const link = nav.link(name);
    await link.click();
    await expect(page).toHaveURL(sectionPage.path());
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(nav.currentLinks).toHaveCount(1);
  }
}

// A page inside a section keeps it marked, and a page outside every section marks none.
async function expectCurrentSectionWithin(nav: MainNav, ui: Ui, api: ApiClient) {
  const { list } = await expectBody(
    api.lists.createList({ name: "Space horror", mediaType: "film" }),
    201,
  );
  await ui.listPage.goto(list.id);
  await expect(nav.link("Collections")).toHaveAttribute("aria-current", "page");
  await expect(nav.currentLinks).toHaveCount(1);

  await ui.libraryPage.goto("Watched");
  await expect(nav.link("Saved")).toHaveAttribute("aria-current", "page");
  await expect(nav.currentLinks).toHaveCount(1);

  await ui.filmPage.goto((await alien(api)).id);
  await expect(nav.links).toHaveCount(sectionsOf(ui).length);
  await expect(nav.currentLinks).toHaveCount(0);
}

async function logInWithTemporaryPassword(page: Page, ui: Ui, api: ApiClient, user: TestUser) {
  const { temporaryPassword } = await expectBody(api.testHooks.resetPassword(user.username));
  await ui.loginPage.goto();
  await ui.loginPage.logIn({ username: user.username, password: temporaryPassword });
  await expect(page).toHaveURL(ui.newPasswordPage.path());
}

// The account menu holds the same pages at every width.
async function expectAccountMenuPages(page: Page, ui: Ui) {
  const { libraryPage, invitesPage, loginPage, settingsPage } = ui;
  await libraryPage.goto();

  const { accountMenu } = libraryPage.header;
  await accountMenu.open();
  await expect(accountMenu.items).toHaveText(["Invites", "Settings", "Log out"]);
  await expect(accountMenu.separator).toHaveCount(1);
  await page.keyboard.press("Escape");

  await accountMenu.choose("Invites");
  await expect(page).toHaveURL(invitesPage.path());
  await invitesPage.header.accountMenu.choose("Settings");
  await expect(page).toHaveURL(settingsPage.path());
  await settingsPage.header.accountMenu.logOut();
  await expect(page).toHaveURL(loginPage.path());
}

// Logged out, the frame is the app name alone on login and register. A Share Link's page adds a
// way to log in.
async function expectPlainFrame({ loginPage, registerPage, sharedPage }: Ui) {
  async function expectPlainFrameOn(
    frame: Pick<BasePage, "header" | "navigations">,
    links = ["TasteTrack"],
  ) {
    await expect(frame.header.links).toHaveText(links);
    await expect(frame.header.buttons).toHaveCount(0);
    await expect(frame.navigations).toHaveCount(0);
  }

  await loginPage.goto();
  await expectPlainFrameOn(loginPage);
  await registerPage.goto();
  await expectPlainFrameOn(registerPage);
  await sharedPage.goto("no-such-link");
  await expectPlainFrameOn(sharedPage, ["TasteTrack", "Log in"]);
}

// Setting a new password is all such a User can do, so they get only a way out.
async function expectPasswordChangeFrame(page: Page, ui: Ui, api: ApiClient, user: TestUser) {
  await logInWithTemporaryPassword(page, ui, api, user);
  const { newPasswordPage } = ui;

  await expect(newPasswordPage.navigations).toHaveCount(0);
  const { accountMenu } = newPasswordPage.header;
  await accountMenu.open();
  await expect(accountMenu.items).toHaveText(["Log out"]);
  await accountMenu.item("Log out").click();
  await expect(page).toHaveURL(ui.loginPage.path());
}

async function expectFooter(footer: Footer) {
  await expect(footer.tmdbLogo).toBeVisible();
  await expect(footer.root).toContainText("This product uses TMDB and the TMDB APIs");
  await expect(footer.appVersion(packageJson.version)).toBeVisible();
}

// offsetHeight, as the menu's opening animation scales what a bounding box would measure.
function heightOf(control: Locator) {
  return control.evaluate((element: HTMLElement) => element.offsetHeight);
}

// Where an element sits once its opening animation has finished.
async function settledBoxOf(element: Locator) {
  await element.evaluate((node) =>
    Promise.all(node.getAnimations().map(({ finished }) => finished)),
  );
  const box = await element.boundingBox();
  if (!box) throw new Error("The element isn't rendered");
  return box;
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 402, height: 874 } });

  test("the sections sit in a bottom tab bar that marks the current one", async ({
    page,
    loggedInUi: ui,
  }) => {
    await expectSectionsIn(ui.libraryPage.mainNav, page, ui);

    await expect(ui.libraryPage.header.navigations).toHaveCount(0);
  });

  test("the tab bar stays on screen on a page taller than the screen", async ({
    page,
    loggedInUi: ui,
  }) => {
    await page.setViewportSize({ width: 402, height: 300 });
    await ui.searchPage.goto();

    const tabs = ui.searchPage.mainNav.root;
    await expect(tabs).toBeInViewport({ ratio: 1 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(tabs).toBeInViewport({ ratio: 1 });
  });

  test("a page inside a section keeps it marked, and a film's page marks none", async ({
    ui,
    loggedInApi: api,
  }) => {
    await expectCurrentSectionWithin(ui.listPage.mainNav, ui, api);
  });

  test("the account button is the avatar alone and opens the account menu", async ({
    page,
    ui,
    loggedInUser,
  }) => {
    await ui.libraryPage.goto();
    await expect(ui.libraryPage.header.displayName(loggedInUser.username)).toBeHidden();

    await expectAccountMenuPages(page, ui);
  });

  test("the account menu is a sheet on the bottom edge, which a tap above it closes", async ({
    page,
    loggedInUi: ui,
  }) => {
    await ui.libraryPage.goto();
    const { accountMenu } = ui.libraryPage.header;
    await accountMenu.open();

    const screen = page.viewportSize();
    if (!screen) throw new Error("The page has no viewport");
    const sheet = await settledBoxOf(accountMenu.menu);
    expect(sheet.x).toBe(0);
    expect(sheet.width).toBe(screen.width);
    expect(sheet.y + sheet.height).toBeCloseTo(screen.height, 0);

    // Above the sheet is the scrim, over the header too: a tap on the app name only closes it.
    await page.mouse.click(screen.width / 2, 28);
    await expect(accountMenu.menu).toBeHidden();
    await expect(page).toHaveURL(ui.libraryPage.path());
  });

  test("a logged-out page has the plain frame", async ({ ui }) => {
    await expectPlainFrame(ui);
  });

  test("a User who must set a new password gets only Log out", async ({
    page,
    ui,
    api,
    registeredUser,
  }) => {
    await expectPasswordChangeFrame(page, ui, api, registeredUser);
  });

  test("at 360px the header takes one line and every navigation control is 44px tall", async ({
    page,
    loggedInUi: ui,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await ui.libraryPage.goto();
    const { header, mainNav } = ui.libraryPage;

    // The app name shows before the session has loaded and the tabs only after. Waiting for the
    // tabs means everything below measures the whole frame.
    const tabs = mainNav.links;
    await expect(tabs).toHaveCount(sectionsOf(ui).length);

    expect(await heightOf(header.banner)).toBeLessThanOrEqual(57);
    const sideways = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(sideways).toBe(0);

    const controls = [header.appNameLink, header.accountMenu.button, ...(await tabs.all())];
    for (const control of controls) expect(await heightOf(control)).toBeGreaterThanOrEqual(44);

    await header.accountMenu.open();
    const items = header.accountMenu.items;
    await expect(items).toHaveCount(3);
    for (const item of await items.all()) expect(await heightOf(item)).toBeGreaterThanOrEqual(44);
  });

  test("the footer credits TMDB and shows the app version", async ({ loggedInUi: ui }) => {
    await ui.libraryPage.goto();

    await expectFooter(ui.libraryPage.footer);
  });
});

test.describe("from md", () => {
  test("the sections sit in the header and the current one is marked", async ({
    page,
    loggedInUi: ui,
  }) => {
    await expectSectionsIn(ui.libraryPage.header.mainNav, page, ui);

    await expect(ui.libraryPage.mainNav.root).toHaveCount(1);
  });

  test("a page inside a section keeps it marked, and a film's page marks none", async ({
    ui,
    loggedInApi: api,
  }) => {
    await expectCurrentSectionWithin(ui.listPage.header.mainNav, ui, api);
  });

  test("the account button shows the Display Name and opens the account menu", async ({
    page,
    ui,
    loggedInUser,
  }) => {
    await ui.libraryPage.goto();
    await expect(ui.libraryPage.header.displayName(loggedInUser.username)).toBeVisible();

    await expectAccountMenuPages(page, ui);
  });

  test("the account menu drops down under the account button, flush with its right edge", async ({
    loggedInUi: ui,
  }) => {
    await ui.libraryPage.goto();
    const { accountMenu } = ui.libraryPage.header;
    // Measured while closed: the open menu hides the rest of the page from assistive technology.
    const button = await settledBoxOf(accountMenu.button);
    await accountMenu.open();

    const dropdown = await settledBoxOf(accountMenu.menu);
    expect(dropdown.y).toBeGreaterThanOrEqual(button.y + button.height);
    expect(dropdown.y).toBeLessThan(button.y + button.height + 16);
    expect(dropdown.x + dropdown.width).toBeCloseTo(button.x + button.width, 0);
    expect(dropdown.width).toBeGreaterThanOrEqual(200);
  });

  test("a logged-out page has the plain frame", async ({ ui }) => {
    await expectPlainFrame(ui);
  });

  test("a User who must set a new password gets only Log out", async ({
    page,
    ui,
    api,
    registeredUser,
  }) => {
    await expectPasswordChangeFrame(page, ui, api, registeredUser);
  });

  test("the footer credits TMDB and shows the app version, logged out too", async ({ ui }) => {
    await ui.loginPage.goto();

    await expectFooter(ui.loginPage.footer);
  });

  test("the header and footer stop at 72rem, as Saved does, and other pages keep a narrower column", async ({
    page,
    loggedInUi: ui,
  }) => {
    const { libraryPage, searchPage } = ui;
    await page.setViewportSize({ width: 1440, height: 900 });
    await libraryPage.goto();

    const heading = libraryPage.heading;
    await expect(heading).toBeVisible();
    expect((await libraryPage.main.boundingBox())?.width).toBe(1152);
    const headingX = (await heading.boundingBox())?.x;
    expect((await libraryPage.header.appNameLink.boundingBox())?.x).toBe(headingX);
    expect((await libraryPage.footer.tmdbLogo.boundingBox())?.x).toBe(headingX);

    await libraryPage.mainNav.link("Search").click();
    await expect(searchPage.searchHeading).toBeVisible();
    expect((await searchPage.main.boundingBox())?.width).toBe(768);
  });
});

test.describe("old addresses", () => {
  test("/ opens the films' Watchlist, titled TasteTrack", async ({ page, loggedInUi: ui }) => {
    await ui.goto("/");

    await expect(page).toHaveURL(ui.libraryPage.path("Watchlist"));
    await expect(page).toHaveTitle("TasteTrack");
  });

  test("the Watchlist and the Log open Saved's Watchlist and Watched", async ({
    page,
    loggedInUi: ui,
  }) => {
    await ui.goto("/watchlist");
    await expect(page).toHaveURL(ui.libraryPage.path("Watchlist"));

    await ui.goto("/log");
    await expect(page).toHaveURL(ui.libraryPage.path("Watched"));
  });

  test("the Lists and a List open Collections and that Collection", async ({
    page,
    ui,
    loggedInApi: api,
  }) => {
    const { list } = await expectBody(
      api.lists.createList({ name: "Space horror", mediaType: "film" }),
      201,
    );

    await ui.goto("/lists");
    await expect(page).toHaveURL(ui.listsPage.path());

    await ui.goto(`/lists/${list.id}`);
    await expect(page).toHaveURL(ui.listPage.path(list.id));
    await expect(ui.listPage.heading("Space horror")).toBeVisible();
  });

  test("a search on home opens in Search, with its query", async ({ page, loggedInUi: ui }) => {
    await ui.goto("/?q=alien");

    await expect(page).toHaveURL(ui.searchPage.path("alien"));
    await expect(ui.searchPage.searchBox).toHaveValue("alien");
  });

  test("an address the app doesn't know opens the films' Watchlist", async ({
    page,
    loggedInUi: ui,
  }) => {
    const response = await ui.goto("/some/client/route");

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(ui.libraryPage.path("Watchlist"));
  });
});
