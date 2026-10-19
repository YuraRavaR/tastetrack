import { expect, test } from "@playwright/test";
import { createUser } from "../support/users";

test("the home page shows a logged-in User the server is up", async ({ page }) => {
  const user = await createUser(page.request);
  await page.request.post("/api/auth/login", { data: user });

  await page.goto("/");

  await expect(page).toHaveTitle("TasteTrack");
  await expect(page.getByRole("link", { name: "TasteTrack" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ваш особистий трекер фільмів" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Сервер працює");
});

test("a deep link loads the app, not a 404", async ({ page }) => {
  const response = await page.goto("/some/client/route");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("link", { name: "TasteTrack" })).toBeVisible();
});
