import { step } from "../../step";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ListFormDialog } from "../components/ListFormDialog";
import { ListItemRow } from "../components/ListItemRow";
import { NoteDialog } from "../components/NoteDialog";
import { SearchResults } from "../components/SearchResults";
import { ShareLinkPanel } from "../components/ShareLinkPanel";
import { BasePage } from "./BasePage";

// One of the User's Lists.
export class ListPage extends BasePage<[listId: number]> {
  path(listId: number) {
    return `/collections/${listId}`;
  }

  readonly shareLinkPanel = new ShareLinkPanel(this.page);
  readonly editListButton = this.page.getByRole("button", { name: "Edit collection" });
  readonly editListDialog = new ListFormDialog(
    this.page.getByRole("dialog", { name: "Edit collection" }),
  );
  readonly deleteListButton = this.page.getByRole("button", { name: "Delete collection" });

  // Adding films: a search whose results each have an Add button.
  readonly searchBox = this.page.getByRole("searchbox", { name: "Search films" });
  readonly searchResults = new SearchResults(
    this.page.getByRole("list", { name: "Search results" }),
  );

  heading(listName: string) {
    return this.page.getByRole("heading", { name: listName });
  }

  // Any text on the page, such as the List's description or its count of films.
  text(content: string) {
    return this.page.getByText(content);
  }

  // The List's films, a list named after the List.
  items(listName: string) {
    return this.page.getByRole("list", { name: listName }).getByRole("listitem");
  }

  firstItem(listName: string) {
    return new ListItemRow(this.items(listName).first());
  }

  lastItem(listName: string) {
    return new ListItemRow(this.items(listName).last());
  }

  noteDialog(filmLabel: string) {
    return new NoteDialog(this.page.getByRole("dialog", { name: `Note for ${filmLabel}` }));
  }

  deleteListDialog(listName: string) {
    return new ConfirmDialog(this.page.getByRole("alertdialog", { name: `Delete ${listName}?` }));
  }

  @step
  async search(query: string): Promise<void> {
    await this.searchBox.fill(query);
  }
}
