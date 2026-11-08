import { step } from "../../step";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ListFormDialog } from "../components/ListFormDialog";
import { NoteDialog } from "../components/NoteDialog";
import { PosterGridItem } from "../components/PosterGridItem";
import { SearchResults } from "../components/SearchResults";
import { ShareLinkPanel } from "../components/ShareLinkPanel";
import { BasePage } from "./BasePage";

// What a poster's ⋯ menu offers: a bottom sheet on a phone, a dropdown from md. "Add a Note" and
// "Edit Note" are one item, named after whether the film has a Note.
export type ListPosterAction =
  | "Add a Note"
  | "Edit Note"
  | "Move to top"
  | "Move earlier"
  | "Move later"
  | "Remove from collection";

// One film in a List's grid: its poster, title and year as one link to the film's page, its ⋯
// button, and its Note under it, which opens the Note dialog.
class ListPoster extends PosterGridItem {
  readonly moreButton = this.root.getByRole("button", { name: /^More for / });
  readonly noteButton = this.root.getByRole("button", { name: /^Note for / });
}

// One of the User's Lists, a grid of posters in the List's order.
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
  // The empty List's one button.
  readonly addFilmsButton = this.main.getByRole("button", { name: "Add films" });
  // The open poster's ⋯ menu.
  readonly posterMenu = this.page.getByRole("menu");
  // After a film is removed, the line that offers it back.
  readonly undoButton = this.main.getByRole("button", { name: "Undo" });

  heading(listName: string) {
    return this.page.getByRole("heading", { name: listName });
  }

  // Any text on the page, such as the List's description, its count of films or a Note.
  text(content: string) {
    return this.main.getByText(content);
  }

  // The List's films, a list named after the List.
  items(listName: string) {
    return this.page.getByRole("list", { name: listName }).getByRole("listitem");
  }

  // A poster by its film's title, in full.
  poster(listName: string, title: string) {
    const titled = this.page.getByText(title, { exact: true });
    return new ListPoster(this.items(listName).filter({ has: titled }));
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

  // Opens a poster's ⋯ menu and picks one of its actions.
  @step
  async choose(listName: string, title: string, action: ListPosterAction): Promise<void> {
    await this.poster(listName, title).moreButton.click();
    await this.posterMenu.getByRole("menuitem", { name: action }).click();
  }
}
