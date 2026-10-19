import { expect, test } from "@playwright/test";
import { createUser } from "../support/users";

test("a logged-out visitor is sent to the login page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("heading", { name: "Вхід" })).toBeVisible();
});

test("a User logs in, lands where they were going, and logs out", async ({ page }) => {
  const user = await createUser(page.request);
  await page.goto("/some/page");
  await expect(page).toHaveURL("/login");

  await page.getByLabel("Ім'я користувача").fill(user.username);
  await page.getByLabel("Пароль").fill(user.password);
  await page.getByRole("button", { name: "Увійти" }).click();

  // An unknown page sends a logged-in User home.
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("banner")).toContainText(user.username);

  await page.getByRole("button", { name: "Вийти" }).click();

  await expect(page).toHaveURL("/login");
  await page.reload();
  await expect(page).toHaveURL("/login");
});

test("a wrong password shows an error and stays on the login page", async ({ page }) => {
  const user = await createUser(page.request);
  await page.goto("/login");

  await page.getByLabel("Ім'я користувача").fill(user.username);
  await page.getByLabel("Пароль").fill("not the password");
  await page.getByRole("button", { name: "Увійти" }).click();

  await expect(page.getByRole("alert")).toHaveText("Неправильне ім'я користувача або пароль");
  await expect(page).toHaveURL("/login");
});
