import { expect, test } from "@playwright/test";

test("the home page greets in Ukrainian and shows the server is up", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("TasteTrack");
  await expect(page.getByRole("heading", { name: "TasteTrack" })).toBeVisible();
  await expect(page.getByText("Ваш особистий трекер фільмів")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Сервер працює");
});

test("a deep link loads the app, not a 404", async ({ page }) => {
  const response = await page.goto("/some/client/route");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "TasteTrack" })).toBeVisible();
});
