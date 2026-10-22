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
