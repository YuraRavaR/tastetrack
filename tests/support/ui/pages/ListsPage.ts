import { ListFormDialog } from "../components/ListFormDialog";
import { BasePage } from "./BasePage";

// The User's Lists.
export class ListsPage extends BasePage {
  path() {
    return "/collections";
  }

  readonly heading = this.page.getByRole("heading", { name: "Your Collections" });
  readonly emptyMessage = this.page.getByText("You have no Collections yet.");
  readonly newListButton = this.page.getByRole("button", { name: "New collection" });
  readonly newListDialog = new ListFormDialog(
    this.page.getByRole("dialog", { name: "New collection" }),
  );
  readonly lists = this.page.getByRole("list", { name: "Your Collections" }).getByRole("listitem");

  listLink(name: string) {
    return this.lists.getByRole("link", { name });
  }
}
