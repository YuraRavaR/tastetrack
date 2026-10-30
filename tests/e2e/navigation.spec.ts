import { expect, type Locator, type Page, test } from "@playwright/test";
import packageJson from "../../package.json" with { type: "json" };
import { chooseFromAccountMenu, logOut, openAccountMenu } from "../support/navigation";
import { createUser, logInNewUser, resetPassword } from "../support/users";

const sections = [
  { name: "Home", url: "/" },
  { name: "Log", url: "/log" },
  { name: "Watchlist", url: "/watchlist" },
  { name: "Lists", url: "/lists" },
];

// Follows each section from `nav`, which marks that one alone as the current page.
async function expectSectionsIn(nav: Locator, page: Page) {
  for (const { name, url } of sections) {
    const link = nav.getByRole("link", { name, exact: true });
    await link.click();
    await expect(page).toHaveURL(url);
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(nav.locator("[aria-current]")).toHaveCount(1);
  }
}

async function logInWithTemporaryPassword(page: Page) {
  const user = await createUser();
  const temporaryPassword = await resetPassword(page.request, user.username);
  await page.goto("/login");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Password").fill(temporaryPassword);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/new-password");
}

// The account menu holds the same pages at every width.
async function expectAccountMenuPages(page: Page) {
  await page.goto("/");

  const menu = await openAccountMenu(page);
  await expect(menu.getByRole("menuitem")).toHaveText(["Invites", "Settings", "Log out"]);
  await expect(menu.getByRole("separator")).toHaveCount(1);
  await page.keyboard.press("Escape");

  await chooseFromAccountMenu(page, "Invites");
  await expect(page).toHaveURL("/invites");
  await chooseFromAccountMenu(page, "Settings");
  await expect(page).toHaveURL("/settings");
  await logOut(page);
  await expect(page).toHaveURL("/login");
}

// Logged out, the frame is the app name alone, on a Share Link as on login and register.
async function expectPlainFrame(page: Page) {
  for (const url of ["/login", "/register", "/s/no-such-link"]) {
    await page.goto(url);
    await expect(page.getByRole("banner").getByRole("link")).toHaveText(["TasteTrack"]);
    await expect(page.getByRole("banner").getByRole("button")).toHaveCount(0);
    await expect(page.getByRole("navigation")).toHaveCount(0);
  }
}

// Setting a new password is all such a User can do, so they get only a way out.
async function expectPasswordChangeFrame(page: Page) {
  await logInWithTemporaryPassword(page);

  await expect(page.getByRole("navigation")).toHaveCount(0);
  const menu = await openAccountMenu(page);
  await expect(menu.getByRole("menuitem")).toHaveText(["Log out"]);
  await menu.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL("/login");
}

async function expectFooter(page: Page) {
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("img", { name: "TMDB" })).toBeVisible();
  await expect(footer).toContainText("This product uses TMDB and the TMDB APIs");
  await expect(footer.getByText(`v${packageJson.version}`, { exact: true })).toBeVisible();
}

// offsetHeight, as the menu's opening animation scales what a bounding box would measure.
function heightOf(control: Locator) {
  return control.evaluate((element: HTMLElement) => element.offsetHeight);
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 402, height: 874 } });

  test("the sections sit in a bottom tab bar that marks the current one", async ({ page }) => {
    await logInNewUser(page.request);
    await page.goto("/");

    await expect(page.getByRole("banner").getByRole("navigation")).toHaveCount(0);
    await expectSectionsIn(page.getByRole("navigation", { name: "Main" }), page);
  });

  test("the tab bar stays on screen on a page taller than the screen", async ({ page }) => {
    await logInNewUser(page.request);
    await page.setViewportSize({ width: 402, height: 300 });
    await page.goto("/");

    const tabs = page.getByRole("navigation", { name: "Main" });
    await expect(tabs).toBeInViewport({ ratio: 1 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(tabs).toBeInViewport({ ratio: 1 });
  });

  test("a List's page keeps its section marked", async ({ page }) => {
    await logInNewUser(page.request);
    const created = await page.request.post("/api/lists", {
      data: { name: "Space horror", mediaType: "film" },
    });
    const { list } = await created.json();

    await page.goto(`/lists/${list.id}`);

    await expect(
      page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Lists" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("the account button is the avatar alone and opens the account menu", async ({ page }) => {
    const user = await logInNewUser(page.request);
    await page.goto("/");
    await expect(page.getByRole("banner").getByText(user.username)).toBeHidden();

    await expectAccountMenuPages(page);
  });

  test("a logged-out page has the plain frame", async ({ page }) => {
    await expectPlainFrame(page);
  });

  test("a User who must set a new password gets only Log out", async ({ page }) => {
    await expectPasswordChangeFrame(page);
  });

  test("at 360px the header takes one line and every navigation control is 44px tall", async ({
    page,
  }) => {
    await logInNewUser(page.request);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/");

    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "TasteTrack" })).toBeVisible();
    expect(await heightOf(header)).toBeLessThanOrEqual(57);
    const sideways = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(sideways).toBe(0);

    const tabs = page.getByRole("navigation", { name: "Main" }).getByRole("link");
    const controls = [
      header.getByRole("link", { name: "TasteTrack" }),
      header.getByRole("button", { name: "Account menu" }),
      ...(await tabs.all()),
    ];
    expect(controls).toHaveLength(6);
    for (const control of controls) expect(await heightOf(control)).toBeGreaterThanOrEqual(44);

    const menu = await openAccountMenu(page);
    const items = await menu.getByRole("menuitem").all();
    expect(items).toHaveLength(3);
    for (const item of items) expect(await heightOf(item)).toBeGreaterThanOrEqual(44);
  });

  test("the footer credits TMDB and shows the app version", async ({ page }) => {
    await logInNewUser(page.request);
    await page.goto("/");

    await expectFooter(page);
  });
});

test.describe("from md", () => {
  test("the sections sit in the header and the current one is marked", async ({ page }) => {
    await logInNewUser(page.request);
    await page.goto("/");

    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(1);
    await expectSectionsIn(
      page.getByRole("banner").getByRole("navigation", { name: "Main" }),
      page,
    );
  });

  test("the account button shows the Display Name and opens the account menu", async ({ page }) => {
    const user = await logInNewUser(page.request);
    await page.goto("/");
    await expect(page.getByRole("banner").getByText(user.username)).toBeVisible();

    await expectAccountMenuPages(page);
  });

  test("a logged-out page has the plain frame", async ({ page }) => {
    await expectPlainFrame(page);
  });

  test("a User who must set a new password gets only Log out", async ({ page }) => {
    await expectPasswordChangeFrame(page);
  });

  test("the footer credits TMDB and shows the app version, logged out too", async ({ page }) => {
    await page.goto("/login");

    await expectFooter(page);
  });

  test("the header and footer stop at 72rem, as home does, and other pages keep a narrower column", async ({
    page,
  }) => {
    await logInNewUser(page.request);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const main = page.getByRole("main");
    const log = page.getByRole("region", { name: "Latest in your Log" });
    const watchlist = page.getByRole("region", { name: "Next on your Watchlist" });
    await expect(log).toBeVisible();
    await expect(watchlist).toBeVisible();
    expect((await main.boundingBox())?.width).toBe(1152);
    const logBox = await log.boundingBox();
    const watchlistBox = await watchlist.boundingBox();
    expect(watchlistBox?.y).toBe(logBox?.y);
    expect(watchlistBox?.x).toBeGreaterThan(logBox?.x ?? Infinity);
    const appName = page.getByRole("banner").getByRole("link", { name: "TasteTrack" });
    expect((await appName.boundingBox())?.x).toBe(logBox?.x);
    const tmdb = page.getByRole("contentinfo").getByRole("img", { name: "TMDB" });
    expect((await tmdb.boundingBox())?.x).toBe(logBox?.x);

    await page.getByRole("link", { name: "Log", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your Log", exact: true })).toBeVisible();
    expect((await main.boundingBox())?.width).toBe(768);
  });
});
