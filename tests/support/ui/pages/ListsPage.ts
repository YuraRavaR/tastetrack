import { ListFormDialog } from "../components/ListFormDialog";
import { BasePage } from "./BasePage";

// The User's Lists.
export class ListsPage extends BasePage {
  path() {
    return "/lists";
  }

  readonly heading = this.page.getByRole("heading", { name: "Your Lists" });
  readonly emptyMessage = this.page.getByText("You have no Lists yet.");
  readonly newListButton = this.page.getByRole("button", { name: "New List" });
  readonly newListDialog = new ListFormDialog(this.page.getByRole("dialog", { name: "New List" }));
  readonly lists = this.page.getByRole("list", { name: "Your Lists" }).getByRole("listitem");

  listLink(name: string) {
    return this.lists.getByRole("link", { name });
  }
}
