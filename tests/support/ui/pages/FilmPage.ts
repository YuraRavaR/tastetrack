import { step } from "../../step";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FilmListsDialog } from "../components/FilmListsDialog";
import { ItemHistoryRow } from "../components/ItemHistoryRow";
import { LogEntryDialog } from "../components/LogEntryDialog";
import { ScopedComponent } from "../components/ScopedComponent";
import { Toast } from "../components/Toast";
import { BasePage } from "./BasePage";

// The menu a Viewing's "⋯" button opens: Edit and Delete.
class EntryActionsMenu extends ScopedComponent {
  readonly items = this.root.getByRole("menuitem");
  readonly separator = this.root.getByRole("separator");

  item(name: string) {
    return this.root.getByRole("menuitem", { name });
  }
}

// A film's page: its banner, the actions on it, the tiles and its Viewings.
export class FilmPage extends BasePage<[mediaItemId: number]> {
  path(mediaItemId: number) {
    return `/items/${mediaItemId}`;
  }

  // Any film's address, for a test that doesn't know which film it opened.
  readonly anyPath = /\/items\/\d+$/;

  readonly heading = this.main.getByRole("heading", { level: 1 });
  readonly backdrop = this.main.locator("picture");
  readonly backdropImage = this.backdrop.locator("img");
  readonly backdropSource = this.backdrop.locator("source");
  readonly noPosterPlaceholder = this.main.getByRole("img", { name: "No poster" });

  readonly watchedButton = this.main.getByRole("button", { name: "Watched", exact: true });
  readonly watchedAgainButton = this.main.getByRole("button", { name: "Watched again" });
  readonly wantToWatchButton = this.main.getByRole("button", {
    name: "Want to watch",
    pressed: false,
  });
  readonly onWatchlistButton = this.main.getByRole("button", {
    name: "On your Watchlist",
    pressed: true,
  });
  readonly addToListButton = this.main.getByRole("button", { name: "Add to list" });
  readonly toast = new Toast(this.page.getByRole("status"));

  // The tiles: how often it was watched, its Current Rating, when first watched.
  readonly stats = this.main.getByRole("definition");
  readonly watchedStat = this.stats.nth(0);
  readonly ratingStat = this.stats.nth(1);
  readonly statNames = this.main.getByRole("term");
  readonly ratingStatName = this.main.getByText("Your rating");

  readonly viewingsHeading = this.main.getByRole("heading", { name: "Viewings", level: 2 });
  readonly viewings = this.main.getByRole("list", { name: "Viewings" }).getByRole("listitem");
  readonly noViewingsMessage = this.main.getByText("No viewings yet");
  readonly noViewingsHint = this.main.getByText(
    "Each time you watch it, the date, Rating and Review show here.",
  );
  readonly entryActionsMenu = new EntryActionsMenu(this.page.getByRole("menu"));
  readonly deleteEntryDialog = new ConfirmDialog(
    this.page.getByRole("alertdialog", { name: "Delete this entry?" }),
  );

  posterImage(url: string) {
    return this.main.locator(`img[src="${url}"]`);
  }

  // The Current Rating's stars, such as "5 stars".
  ratingStars(label: string) {
    return this.ratingStat.getByRole("img", { name: label });
  }

  // An image among the tiles, such as "3.5 stars", or "No date" for a film watched on none.
  statImage(label: string) {
    return this.stats.getByRole("img", { name: label });
  }

  viewing(index: number) {
    return new ItemHistoryRow(this.viewings.nth(index));
  }

  // The "⋯" button of the Viewing with this date, or "No date".
  entryActionsButton(date: string) {
    return this.main.getByRole("button", { name: `Actions for ${date}` });
  }

  // Opens the "⋯" menu of the Viewing with this date and picks Edit or Delete.
  @step
  async chooseEntryAction(date: string, action: string): Promise<void> {
    await this.entryActionsButton(date).click();
    await this.entryActionsMenu.item(action).click();
  }

  // Named after the film, or "Edit your entry for Alien" when it edits a Log Entry.
  logEntryDialog(name: string) {
    return new LogEntryDialog(this.page.getByRole("dialog", { name, exact: true }));
  }

  filmListsDialog(filmLabel: string) {
    return new FilmListsDialog(this.page.getByRole("dialog", { name: `Lists for ${filmLabel}` }));
  }
}
