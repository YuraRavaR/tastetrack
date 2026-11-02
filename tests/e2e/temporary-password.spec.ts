import { expectBody } from "../support/api/responses";
import { expect, test } from "../support/ui/fixtures";

test("a User who logs in with a Temporary Password must set their own first", async ({
  page,
  ui,
  api,
  registeredUser,
}) => {
  const { username } = registeredUser;
  const { temporaryPassword } = await expectBody(api.testHooks.resetPassword(username));
  const { listsPage, loginPage, logPage, newPasswordPage } = ui;
  await listsPage.goto();

  await loginPage.logIn({ username, password: temporaryPassword });

  await expect(page).toHaveURL(newPasswordPage.path);
  await expect(newPasswordPage.heading).toBeVisible();
  await expect(newPasswordPage.listsLink).toHaveCount(0);

  // Every other page, even after a reload, sends the User back here.
  await logPage.goto();
  await expect(page).toHaveURL(newPasswordPage.path);

  await newPasswordPage.setPassword(temporaryPassword);
  await expect(newPasswordPage.errorMessage).toHaveText(
    "That's the Temporary Password. Choose one of your own.",
  );

  await newPasswordPage.setPassword("my very own passphrase");

  await expect(page).toHaveURL(logPage.path);
  await expect(logPage.header.banner).toContainText(username);
  await page.reload();
  await expect(page).toHaveURL(logPage.path);
});
