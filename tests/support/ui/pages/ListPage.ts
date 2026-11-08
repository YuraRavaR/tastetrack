import { step } from "../../step";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ListFormDialog } from "../components/ListFormDialog";
import { NoteDialog } from "../components/NoteDialog";
import { PosterGridItem } from "../components/PosterGridItem";
import { ScopedComponent } from "../components/ScopedComponent";
import { SearchResults } from "../components/SearchResults";
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

// What the ⋯ by the List's heading offers. "Share" becomes "Share Link" once the List is shared.
export type ListAction = "Edit collection" | "Share" | "Share Link" | "Delete collection";

// What the Share Link dialog asks before it replaces the link or stops sharing.
export type ShareLinkQuestion = "Make a new link?" | "Stop sharing?";

// Sharing a List, opened from its ⋯ menu: a button that makes a Share Link, then the link to copy,
// with ways to replace it or stop sharing, each asked about inside the dialog.
class ShareLinkDialog extends ScopedComponent {
  readonly shareButton = this.root.getByRole("button", { name: "Share", exact: true });
  readonly linkField = this.root.getByRole("textbox", { name: "Share Link" });
  readonly copyButton = this.root.getByRole("button", { name: /^(Copy link|Copied)$/ });
  readonly newLinkButton = this.root.getByRole("button", { name: "New link" });
  readonly stopSharingButton = this.root.getByRole("button", { name: "Stop sharing" });
  readonly closeButton = this.root.getByRole("button", { name: "Close" });

  // The question, asked in place of the link.
  confirmation(question: ShareLinkQuestion) {
    return new ConfirmDialog(this.root.getByRole("alertdialog", { name: question }));
  }

  @step
  async share(): Promise<void> {
    await this.shareButton.click();
  }

  @step
  async readLink(): Promise<string> {
    return this.linkField.inputValue();
  }

  // Replaces the link, once confirmed: the old one stops working.
  @step
  async makeNewLink(): Promise<void> {
    await this.newLinkButton.click();
    await this.confirmation("Make a new link?").confirm("Make a new link");
  }

  @step
  async stopSharing(): Promise<void> {
    await this.stopSharingButton.click();
    await this.confirmation("Stop sharing?").confirm("Stop sharing");
  }
}

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

  // The ⋯ by the heading and its menu: a bottom sheet on a phone, a dropdown from md.
  readonly actionsButton = this.main.getByRole("button", { name: "Collection actions" });
  readonly actionsMenu = this.page.getByRole("menu");
  readonly editListDialog = new ListFormDialog(
    this.page.getByRole("dialog", { name: "Edit collection" }),
  );

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

  // One of the ⋯ menu's items, once it is open.
  actionItem(action: ListAction) {
    return this.actionsMenu.getByRole("menuitem", { name: action, exact: true });
  }

  // Titled "Share <name>" until the List is shared, then "Shared by link".
  shareLinkDialog(listName: string) {
    const dialog = (name: string) => this.page.getByRole("dialog", { name, exact: true });
    return new ShareLinkDialog(dialog(`Share ${listName}`).or(dialog("Shared by link")));
  }

  deleteListDialog(listName: string) {
    return new ConfirmDialog(this.page.getByRole("alertdialog", { name: `Delete ${listName}?` }));
  }

  // Opens the ⋯ by the heading and picks one of its actions.
  @step
  async act(action: ListAction): Promise<void> {
    await this.actionsButton.click();
    await this.actionItem(action).click();
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
