import { step } from "../../step";
import { BaseComponent } from "./BaseComponent";

export type AccountMenuItem = "Invites" | "Settings" | "Log out";

// The account menu, opened from the header's account button.
export class AccountMenu extends BaseComponent {
  readonly button = this.page.getByRole("button", { name: "Account menu" });
  readonly menu = this.page.getByRole("menu");
  readonly items = this.menu.getByRole("menuitem");
  readonly separator = this.menu.getByRole("separator");

  item(name: AccountMenuItem) {
    return this.menu.getByRole("menuitem", { name });
  }

  @step
  async open(): Promise<void> {
    await this.button.click();
    await this.menu.waitFor();
  }

  @step
  async choose(name: AccountMenuItem): Promise<void> {
    await this.open();
    await this.item(name).click();
  }

  @step
  async logOut(): Promise<void> {
    await this.choose("Log out");
  }
}
