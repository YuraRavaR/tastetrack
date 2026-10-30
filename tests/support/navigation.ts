import { expect, type Locator, type Page } from "@playwright/test";

// Opens the account menu in the header and returns it.
export async function openAccountMenu(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Account menu" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}

// Picks an item of the account menu: Invites, Settings or Log out.
export async function chooseFromAccountMenu(page: Page, name: string): Promise<void> {
  const menu = await openAccountMenu(page);
  await menu.getByRole("menuitem", { name }).click();
}

export async function logOut(page: Page): Promise<void> {
  await chooseFromAccountMenu(page, "Log out");
}
