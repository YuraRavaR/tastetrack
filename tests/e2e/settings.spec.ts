import { expect, test } from "@playwright/test";
import { logInNewUser } from "../support/users";

test("a User sets their Display Name and changes their password in Settings", async ({ page }) => {
  const user = await logInNewUser(page.request);
  await page.goto("/");

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  const displayNameSection = page.getByRole("region", { name: "Display Name" });
  const passwordSection = page.getByRole("region", { name: "Password" });
  const displayName = page.getByRole("textbox", { name: "Display Name" });
  await expect(displayName).toHaveValue(user.username);
  await displayName.fill("Олена К.");
  await page.getByRole("button", { name: "Save Display Name" }).click();
  await expect(displayNameSection.getByRole("status")).toHaveText("Display Name saved.");
  await expect(page.getByRole("banner")).toContainText("Олена К.");

  // Cleared, it is the Username again.
  await displayName.fill("");
  await page.getByRole("button", { name: "Save Display Name" }).click();
  await expect(displayName).toHaveValue(user.username);
  await expect(page.getByRole("banner")).toContainText(user.username);
  await displayName.fill("Олена К.");
  await page.getByRole("button", { name: "Save Display Name" }).click();
  await expect(page.getByRole("banner")).toContainText("Олена К.");

  await page.getByLabel("Current password").fill("not the password");
  await page.getByLabel("New password").fill("a brand new passphrase");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(passwordSection.getByRole("alert")).toHaveText("That isn't your current password.");

  await page.getByLabel("Current password").fill(user.password);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(passwordSection.getByRole("status")).toHaveText(
    "Password changed. You've been logged out everywhere else.",
  );
  await expect(page.getByLabel("Current password")).toHaveValue("");

  // This session stays logged in.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("a User deletes their account in Settings with their password", async ({ page }) => {
  const user = await logInNewUser(page.request);
  await page.goto("/settings");

  const deletion = page.getByRole("region", { name: "Delete account" });
  await expect(deletion).toContainText("This can't be undone.");
  await page.getByLabel("Your password").fill("not the password");
  await page.getByRole("button", { name: "Delete account" }).click();
  await expect(deletion.getByRole("alert")).toHaveText(
    "That isn't your password. Nothing was deleted.",
  );

  await page.getByLabel("Your password").fill(user.password);
  await page.getByRole("button", { name: "Delete account" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("status")).toHaveText(
    "Your account and everything in it have been deleted.",
  );
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Wrong Username or password");
});
