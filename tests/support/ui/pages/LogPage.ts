import { BasePage } from "./BasePage";

// The User's Log.
export class LogPage extends BasePage {
  path() {
    return "/log";
  }

  readonly heading = this.page.getByRole("heading", { name: "Your Log", exact: true });
}
