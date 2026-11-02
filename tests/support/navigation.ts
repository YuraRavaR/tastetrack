import type { Locator, Page } from "@playwright/test";
import { AccountMenu } from "./ui/components/AccountMenu";

// Opens the account menu in the header and returns it.
export async function openAccountMenu(page: Page): Promise<Locator> {
  const accountMenu = new AccountMenu(page);
  await accountMenu.open();
  return accountMenu.menu;
}

// Picks an item of the account menu: Invites, Settings or Log out.
export async function chooseFromAccountMenu(page: Page, name: string): Promise<void> {
  await new AccountMenu(page).choose(name);
}

export async function logOut(page: Page): Promise<void> {
  await new AccountMenu(page).logOut();
}
