import { BaseComponent } from "./BaseComponent";

// The account menu, opened from the header's account button.
export class AccountMenu extends BaseComponent {
  readonly button = this.page.getByRole("button", { name: "Account menu" });
  readonly menu = this.page.getByRole("menu");

  async open(): Promise<void> {
    await this.button.click();
    await this.menu.waitFor();
  }

  // Picks an item: Invites, Settings or Log out.
  async choose(name: string): Promise<void> {
    await this.open();
    await this.menu.getByRole("menuitem", { name }).click();
  }

  async logOut(): Promise<void> {
    await this.choose("Log out");
  }
}
