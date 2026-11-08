import { expect, test } from "../support/ui/fixtures";

test("a User sets their Display Name and changes their password in Settings", async ({
  page,
  ui,
  loggedInUser,
}) => {
  const { libraryPage, settingsPage } = ui;
  const { displayNameSection, passwordSection } = settingsPage;
  await libraryPage.goto();

  await libraryPage.header.accountMenu.choose("Settings");
  await expect(settingsPage.heading).toBeVisible();

  await expect(displayNameSection.input).toHaveValue(loggedInUser.username);
  await displayNameSection.save("Олена К.");
  await expect(displayNameSection.status).toHaveText("Display Name saved.");
  await expect(settingsPage.header.banner).toContainText("Олена К.");

  // Cleared, it is the Username again.
  await displayNameSection.save("");
  await expect(displayNameSection.input).toHaveValue(loggedInUser.username);
  await expect(settingsPage.header.banner).toContainText(loggedInUser.username);
  await displayNameSection.save("Олена К.");
  await expect(settingsPage.header.banner).toContainText("Олена К.");

  await passwordSection.change("not the password", "a brand new passphrase");
  await expect(passwordSection.errorMessage).toHaveText("That isn't your current password.");

  await passwordSection.change(loggedInUser.password, "a brand new passphrase");
  await expect(passwordSection.status).toHaveText(
    "Password changed. You've been logged out everywhere else.",
  );
  await expect(passwordSection.currentPasswordInput).toHaveValue("");

  // This session stays logged in.
  await page.reload();
  await expect(settingsPage.heading).toBeVisible();
});

test("a User deletes their account in Settings with their password", async ({
  page,
  ui,
  loggedInUser,
}) => {
  const { loginPage, settingsPage } = ui;
  const { deleteUserSection } = settingsPage;
  await settingsPage.goto();

  await expect(deleteUserSection.root).toContainText("This can't be undone.");
  await deleteUserSection.deleteUser("not the password");
  await expect(deleteUserSection.errorMessage).toHaveText(
    "That isn't your password. Nothing was deleted.",
  );

  await deleteUserSection.deleteUser(loggedInUser.password);

  await expect(page).toHaveURL(loginPage.path());
  await expect(loginPage.statusMessage).toHaveText(
    "Your account and everything in it have been deleted.",
  );
  await loginPage.logIn(loggedInUser);
  await expect(loginPage.errorMessage).toHaveText("Wrong Username or password");
});
