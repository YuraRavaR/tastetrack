import { AccountMenu } from "./AccountMenu";
import { BaseComponent } from "./BaseComponent";

// The header at the top of every page. What it holds depends on who is looking: logged out, it is
// the app name alone.
export class Header extends BaseComponent {
  readonly banner = this.page.getByRole("banner");
  readonly accountMenu = new AccountMenu(this.page);
}
