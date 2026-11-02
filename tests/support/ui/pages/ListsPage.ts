import { BasePage } from "./BasePage";

// The User's Lists.
export class ListsPage extends BasePage {
  readonly path = "/lists";
  readonly heading = this.page.getByRole("heading", { name: "Your Lists" });
}
