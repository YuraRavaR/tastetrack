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
  const { listsPage, loginPage, libraryPage, newPasswordPage } = ui;
  await listsPage.goto();

  await loginPage.logIn({ username, password: temporaryPassword });

  await expect(page).toHaveURL(newPasswordPage.path());
  await expect(newPasswordPage.heading).toBeVisible();
  await expect(page).toHaveTitle("Set a new password · TasteTrack");
  await expect(newPasswordPage.listsLink).toHaveCount(0);

  // Every other page, even after a reload, sends the User back here.
  await libraryPage.goto();
  await expect(page).toHaveURL(newPasswordPage.path());

  await newPasswordPage.setPassword(temporaryPassword);
  await expect(newPasswordPage.errorMessage).toHaveText(
    "That's the Temporary Password. Choose one of your own.",
  );
  await expect(newPasswordPage.newPasswordInput).toHaveAttribute("aria-invalid", "true");
  // Typing in the field at fault clears the error.
  await newPasswordPage.newPasswordInput.fill("my own");
  await expect(newPasswordPage.errorMessage).toHaveCount(0);
  await expect(newPasswordPage.newPasswordInput).toHaveAttribute("aria-invalid", "false");

  await newPasswordPage.setPassword("my very own passphrase");

  await expect(page).toHaveURL(libraryPage.path());
  await expect(libraryPage.header.banner).toContainText(username);
  await page.reload();
  await expect(page).toHaveURL(libraryPage.path());
});
