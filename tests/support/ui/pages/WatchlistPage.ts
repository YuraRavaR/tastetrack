import { ListItemRow } from "../components/ListItemRow";
import { NoteDialog } from "../components/NoteDialog";
import { ShareLinkPanel } from "../components/ShareLinkPanel";
import { BasePage } from "./BasePage";

// The User's Watchlist.
export class WatchlistPage extends BasePage {
  path() {
    return "/watchlist";
  }

  readonly shareLinkPanel = new ShareLinkPanel(this.page);
  readonly emptyMessage = this.page.getByText("Your Watchlist is empty.");
  readonly items = this.page.getByRole("list", { name: "Watchlist" }).getByRole("listitem");
  // The line that says a film was removed, with a way to undo it. Not a toast: it sits in the page.
  readonly statusMessage = this.page.getByRole("status");
  readonly undoButton = this.statusMessage.getByRole("button", { name: "Undo" });

  // Any text on the page, such as its count of films.
  text(content: string) {
    return this.page.getByText(content);
  }

  firstItem() {
    return new ListItemRow(this.items.first());
  }

  lastItem() {
    return new ListItemRow(this.items.last());
  }

  noteDialog(filmLabel: string) {
    return new NoteDialog(this.page.getByRole("dialog", { name: `Note for ${filmLabel}` }));
  }
}
