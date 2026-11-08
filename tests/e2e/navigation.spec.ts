import type { Locator, Page } from "@playwright/test";
import packageJson from "../../package.json" with { type: "json" };
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import type { TestUser } from "../support/scenarios/users";
import type { Footer } from "../support/ui/components/Footer";
import type { MainNav } from "../support/ui/components/MainNav";
import { expect, test } from "../support/ui/fixtures";
import type { BasePage } from "../support/ui/pages/BasePage";
import type { Ui } from "../support/ui/Ui";

function sectionsOf(ui: Ui) {
  return [
    { name: "Home", sectionPage: ui.homePage },
    { name: "Log", sectionPage: ui.logPage },
    { name: "Watchlist", sectionPage: ui.watchlistPage },
    { name: "Collections", sectionPage: ui.listsPage },
  ];
}

// Follows each section from `nav`, which marks that one alone as the current page.
async function expectSectionsIn(nav: MainNav, page: Page, ui: Ui) {
  for (const { name, sectionPage } of sectionsOf(ui)) {
    const link = nav.link(name);
    await link.click();
    await expect(page).toHaveURL(sectionPage.path());
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(nav.currentLinks).toHaveCount(1);
  }
}

async function logInWithTemporaryPassword(page: Page, ui: Ui, api: ApiClient, user: TestUser) {
  const { temporaryPassword } = await expectBody(api.testHooks.resetPassword(user.username));
  await ui.loginPage.goto();
  await ui.loginPage.logIn({ username: user.username, password: temporaryPassword });
  await expect(page).toHaveURL(ui.newPasswordPage.path());
}

// The account menu holds the same pages at every width.
async function expectAccountMenuPages(page: Page, ui: Ui) {
  const { homePage, invitesPage, loginPage, settingsPage } = ui;
  await homePage.goto();

  const { accountMenu } = homePage.header;
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

// Logged out, the frame is the app name alone, on a Share Link as on login and register.
async function expectPlainFrame({ loginPage, registerPage, sharedPage }: Ui) {
  async function expectPlainFrameOn(frame: Pick<BasePage, "header" | "navigations">) {
    await expect(frame.header.links).toHaveText(["TasteTrack"]);
    await expect(frame.header.buttons).toHaveCount(0);
    await expect(frame.navigations).toHaveCount(0);
  }

  await loginPage.goto();
  await expectPlainFrameOn(loginPage);
  await registerPage.goto();
  await expectPlainFrameOn(registerPage);
  await sharedPage.goto("no-such-link");
  await expectPlainFrameOn(sharedPage);
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

test.describe("on a phone", () => {
  test.use({ viewport: { width: 402, height: 874 } });

  test("the sections sit in a bottom tab bar that marks the current one", async ({
    page,
    loggedInUi: ui,
  }) => {
    await ui.homePage.goto();

    await expect(ui.homePage.header.navigations).toHaveCount(0);
    await expectSectionsIn(ui.homePage.mainNav, page, ui);
  });

  test("the tab bar stays on screen on a page taller than the screen", async ({
    page,
    loggedInUi: ui,
  }) => {
    await page.setViewportSize({ width: 402, height: 300 });
    await ui.homePage.goto();

    const tabs = ui.homePage.mainNav.root;
    await expect(tabs).toBeInViewport({ ratio: 1 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(tabs).toBeInViewport({ ratio: 1 });
  });

  test("a List's page keeps its section marked", async ({ ui, loggedInApi: api }) => {
    const created = api.lists.createList({ name: "Space horror", mediaType: "film" });
    const { list } = await expectBody(created, 201);

    await ui.listPage.goto(list.id);

    await expect(ui.listPage.mainNav.link("Collections")).toHaveAttribute("aria-current", "page");
  });

  test("the account button is the avatar alone and opens the account menu", async ({
    page,
    ui,
    loggedInUser,
  }) => {
    await ui.homePage.goto();
    await expect(ui.homePage.header.displayName(loggedInUser.username)).toBeHidden();

    await expectAccountMenuPages(page, ui);
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
    await ui.homePage.goto();
    const { header, mainNav } = ui.homePage;

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
    await ui.homePage.goto();

    await expectFooter(ui.homePage.footer);
  });
});

test.describe("from md", () => {
  test("the sections sit in the header and the current one is marked", async ({
    page,
    loggedInUi: ui,
  }) => {
    await ui.homePage.goto();

    await expect(ui.homePage.mainNav.root).toHaveCount(1);
    await expectSectionsIn(ui.homePage.header.mainNav, page, ui);
  });

  test("the account button shows the Display Name and opens the account menu", async ({
    page,
    ui,
    loggedInUser,
  }) => {
    await ui.homePage.goto();
    await expect(ui.homePage.header.displayName(loggedInUser.username)).toBeVisible();

    await expectAccountMenuPages(page, ui);
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

  test("the header and footer stop at 72rem, as home does, and other pages keep a narrower column", async ({
    page,
    loggedInUi: ui,
  }) => {
    const { homePage, logPage } = ui;
    await page.setViewportSize({ width: 1440, height: 900 });
    await homePage.goto();

    const log = homePage.logSection.root;
    const watchlist = homePage.watchlistSection.root;
    await expect(log).toBeVisible();
    await expect(watchlist).toBeVisible();
    expect((await homePage.main.boundingBox())?.width).toBe(1152);
    const logBox = await log.boundingBox();
    const watchlistBox = await watchlist.boundingBox();
    expect(watchlistBox?.y).toBe(logBox?.y);
    expect(watchlistBox?.x).toBeGreaterThan(logBox?.x ?? Infinity);
    expect((await homePage.header.appNameLink.boundingBox())?.x).toBe(logBox?.x);
    expect((await homePage.footer.tmdbLogo.boundingBox())?.x).toBe(logBox?.x);

    await homePage.mainNav.link("Log").click();
    await expect(logPage.heading).toBeVisible();
    expect((await logPage.main.boundingBox())?.width).toBe(768);
  });
});
