import { expect, test } from "@playwright/test";
import { logInNewUser } from "../support/users";

// Locally the Worker searches a TMDB fake; on staging, the real TMDB. Both know these films.

test("a User searches films as they type, in English or Ukrainian", { tag: "@smoke" }, async ({
  page,
}) => {
  await logInNewUser(page.request);
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search films" });
  const results = page.getByRole("list", { name: "Search results" });

  await search.fill("alien");

  await expect(results.getByText("Alien (1979)", { exact: true })).toBeVisible();
  await search.fill("чужий");
  await expect(results.getByText("Чужий (Alien, 1979)", { exact: true })).toBeVisible();
  await expect(results.getByText("Alien (1979)", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^search/i })).toHaveCount(0);
});

test("a User clears the search with one click and can type again", async ({ page }) => {
  await logInNewUser(page.request);
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search films" });
  const results = page.getByRole("list", { name: "Search results" });
  const clear = page.getByRole("button", { name: "Clear search" });

  await expect(clear).toHaveCount(0);
  await search.fill("alien");
  await expect(results.getByText("Alien (1979)", { exact: true })).toBeVisible();
  await clear.click();

  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await expect(results).toHaveCount(0);
  await expect(clear).toHaveCount(0);
});

test("typing a title makes one search once the User pauses", async ({ page }) => {
  await logInNewUser(page.request);
  await page.goto("/");
  const searched: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/catalog/search") searched.push(url.searchParams.get("query") ?? "");
  });

  await page.getByRole("searchbox", { name: "Search films" }).pressSequentially("alien", {
    delay: 100,
  });

  await expect(
    page.getByRole("list", { name: "Search results" }).getByText("Alien (1979)", { exact: true }),
  ).toBeVisible();
  expect(searched).toEqual(["alien"]);
});

test("TMDB is credited with its logo and notice", { tag: "@smoke" }, async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("img", { name: "TMDB" })).toBeVisible();
  await expect(
    page.getByText(
      "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.",
    ),
  ).toBeVisible();
});
