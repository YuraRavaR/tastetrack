import { expect, test } from "@playwright/test";
import { createUser, resetPassword } from "../support/users";

test("a User who logs in with a Temporary Password must set their own first", async ({ page }) => {
  const user = await createUser();
  const temporaryPassword = await resetPassword(page.request, user.username);
  await page.goto("/lists");

  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Password").fill(temporaryPassword);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL("/new-password");
  await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lists" })).toHaveCount(0);

  // Every other page, even after a reload, sends the User back here.
  await page.goto("/log");
  await expect(page).toHaveURL("/new-password");

  await page.getByLabel("New password").fill(temporaryPassword);
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "That's the Temporary Password. Choose one of your own.",
  );

  await page.getByLabel("New password").fill("my very own passphrase");
  await page.getByRole("button", { name: "Set password" }).click();

  await expect(page).toHaveURL("/log");
  await expect(page.getByRole("banner")).toContainText(user.username);
  await page.reload();
  await expect(page).toHaveURL("/log");
});
