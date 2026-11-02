import { expect, test } from "../support/ui/fixtures";

test("a logged-out visitor is sent to the login page", async ({ ui }) => {
  await ui.homePage.goto();

  await expect(ui.loginPage).toBeOpen();
  await expect(ui.loginPage.heading).toBeVisible();
});

test("a User logs in, lands where they were going, and logs out", { tag: "@smoke" }, async ({
  page,
  ui,
  registeredUser,
}) => {
  await ui.listsPage.goto();
  await expect(ui.loginPage).toBeOpen();

  await ui.loginPage.logIn(registeredUser);

  await expect(ui.listsPage).toBeOpen();
  await expect(ui.listsPage.heading).toBeVisible();
  await expect(ui.listsPage.header.banner).toContainText(registeredUser.username);

  await ui.listsPage.header.accountMenu.logOut();

  await expect(ui.loginPage).toBeOpen();
  await page.reload();
  await expect(ui.loginPage).toBeOpen();
});

test("a User going to an unknown page lands on home after logging in", async ({
  ui,
  registeredUser,
}) => {
  await ui.goto("/some/page");
  await expect(ui.loginPage).toBeOpen();

  await ui.loginPage.logIn(registeredUser);

  await expect(ui.homePage).toBeOpen();
  await expect(ui.homePage.header.banner).toContainText(registeredUser.username);
});

test("a wrong password shows an error and stays on the login page", async ({
  ui,
  registeredUser,
}) => {
  await ui.loginPage.goto();

  await ui.loginPage.logIn({ username: registeredUser.username, password: "not the password" });

  await expect(ui.loginPage.errorMessage).toHaveText("Wrong Username or password");
  await expect(ui.loginPage).toBeOpen();
});

test("after 5 wrong passwords the login page says how long to wait", async ({
  page,
  ui,
  registeredUser,
}) => {
  const { loginPage } = ui;
  await loginPage.goto();
  await loginPage.usernameInput.fill(registeredUser.username);
  for (let i = 0; i < 5; i++) {
    await loginPage.passwordInput.fill("not the password");
    const failed = page.waitForResponse("/api/auth/login");
    await loginPage.logInButton.click();
    expect((await failed).status()).toBe(401);
  }

  await loginPage.passwordInput.fill(registeredUser.password);
  await loginPage.logInButton.click();

  await expect(loginPage.errorMessage).toHaveText(
    "Too many failed attempts. Try again in 15 minutes.",
  );
  await expect(loginPage).toBeOpen();
});
