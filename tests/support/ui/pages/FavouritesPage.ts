import { step } from "../../step";
import { NoteDialog } from "../components/NoteDialog";
import { ScopedComponent } from "../components/ScopedComponent";
import { ShareLinkDialog } from "../components/ShareLinkDialog";
import { BasePage } from "./BasePage";

// What the ⋯ by the heading of Favourite artists offers. "Share" becomes "Share Link" once shared.
export type FavouritesAction = "Share" | "Share Link" | "Edit description";

// What a row's ⋯ offers. "Add a Note" and "Edit Note" are one item, named after whether the
// artist has a Note.
export type FavouriteRowAction = "Add a Note" | "Edit Note" | "Remove from Favourites";

// One artist in Favourite artists: their place, name and facts, the link to their page, the ↑↓
// arrows and the ⋯.
class FavouriteRow extends ScopedComponent {
  readonly link = this.root.getByRole("link");
  readonly moveUpButton = this.root.getByRole("button", { name: /^Move .+ up$/ });
  readonly moveDownButton = this.root.getByRole("button", { name: /^Move .+ down$/ });
  readonly moreButton = this.root.getByRole("button", { name: /^More for / });
}

// The User's Favourite artists: a ranked list of rows under Find artists.
export class FavouritesPage extends BasePage {
  path() {
    return "/collections/favourites/artist";
  }

  readonly heading = this.main.getByRole("heading", { level: 1, name: "Favourite artists" });
  readonly backLink = this.main.getByRole("link", { name: "All Collections" });
  readonly actionsButton = this.main.getByRole("button", { name: "Favourite artists actions" });
  // The open ⋯ menu, by the heading or on a row.
  readonly menu = this.page.getByRole("menu");
  readonly rows = this.main.getByRole("list", { name: "Favourite artists" }).getByRole("listitem");
  readonly findArtistsLink = this.main.getByRole("link", { name: "Find artists" });
  // After an artist is taken out, the line that offers them back.
  readonly undoButton = this.main.getByRole("button", { name: "Undo" });
  readonly descriptionDialog = this.page.getByRole("dialog", { name: "Edit description" });
  readonly descriptionInput = this.descriptionDialog.getByLabel("Description");
  readonly saveDescriptionButton = this.descriptionDialog.getByRole("button", { name: "Save" });

  // An artist's row, by their name.
  row(name: string) {
    const named = this.page.getByRole("link", { name, exact: true });
    return new FavouriteRow(this.rows.filter({ has: named }));
  }

  // Any text on the page, such as the count, the description or a notice.
  text(content: string) {
    return this.main.getByText(content);
  }

  // One item of the open ⋯ menu, by the heading or on a row.
  menuItem(action: FavouritesAction | FavouriteRowAction) {
    return this.menu.getByRole("menuitem", { name: action, exact: true });
  }

  // Titled "Share Favourite artists" until shared, then "Shared by link".
  shareLinkDialog() {
    const dialog = (name: string) => this.page.getByRole("dialog", { name, exact: true });
    return new ShareLinkDialog(dialog("Share Favourite artists").or(dialog("Shared by link")));
  }

  noteDialog(name: string) {
    return new NoteDialog(this.page.getByRole("dialog", { name: `Note for ${name}` }));
  }

  // Opens the ⋯ by the heading and picks one of its actions.
  @step
  async chooseAction(action: FavouritesAction): Promise<void> {
    await this.actionsButton.click();
    await this.menuItem(action).click();
  }

  // Opens a row's ⋯ and picks one of its actions.
  @step
  async chooseRowAction(name: string, action: FavouriteRowAction): Promise<void> {
    await this.row(name).moreButton.click();
    await this.menuItem(action).click();
  }
}
