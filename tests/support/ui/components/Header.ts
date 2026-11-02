import { AccountMenu } from "./AccountMenu";
import { BaseComponent } from "./BaseComponent";
import { MainNav } from "./MainNav";

// The header at the top of every page. What it holds depends on who is looking: logged out, it is
// the app name alone.
export class Header extends BaseComponent {
  readonly banner = this.page.getByRole("banner");
  readonly links = this.banner.getByRole("link");
  readonly buttons = this.banner.getByRole("button");
  readonly appNameLink = this.banner.getByRole("link", { name: "TasteTrack" });
  // The sections, when they sit in the header: from md.
  readonly mainNav = new MainNav(this.banner.getByRole("navigation", { name: "Main" }));
  readonly navigations = this.banner.getByRole("navigation");
  readonly accountMenu = new AccountMenu(this.page);

  // The User's Display Name beside the avatar, shown from md.
  displayName(name: string) {
    return this.banner.getByText(name);
  }
}
