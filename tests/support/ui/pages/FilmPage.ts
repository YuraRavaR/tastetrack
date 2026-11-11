import { step } from "../../step";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FilmListsDialog } from "../components/FilmListsDialog";
import { ItemHistoryRow } from "../components/ItemHistoryRow";
import { LogEntryDialog } from "../components/LogEntryDialog";
import { ManualMediaItemDialog } from "../components/ManualMediaItemDialog";
import { ScopedComponent } from "../components/ScopedComponent";
import { Toast } from "../components/Toast";
import { BasePage } from "./BasePage";

type EntryAction = "Edit" | "Delete";

// The card a Media Item's page shows while it is In Progress, which a book calls "Reading": since
// when, the button that changes that, and Finished and Stop reading.
class InProgressCard extends ScopedComponent {
  readonly changeStartDateButton = this.root.getByRole("button", {
    name: "Change the start date",
  });
  readonly finishedButton = this.root.getByRole("button", { name: "Finished" });
  readonly stopReadingButton = this.root.getByRole("button", { name: "Stop reading" });

  text(content: string | RegExp) {
    return this.root.getByText(content);
  }
}

// The dialog that changes when a Media Item In Progress was started, with a Log Entry's date chips.
class StartDateDialog extends ScopedComponent {
  readonly dateInput = this.root.getByLabel("Start date", { exact: true });
  readonly saveButton = this.root.getByRole("button", { name: "Save" });

  // Today, Yesterday, Other date or No date.
  dateChip(name: string) {
    return this.root.getByRole("button", { name });
  }
}

// The menu a Viewing's "⋯" button opens: Edit and Delete.
class EntryActionsMenu extends ScopedComponent {
  readonly items = this.root.getByRole("menuitem");
  readonly separator = this.root.getByRole("separator");

  item(name: EntryAction) {
    return this.root.getByRole("menuitem", { name });
  }
}

// A Media Item's page: its banner, the actions on it, the tiles and its Item History, which a
// film calls Viewings and a book Readings.
export class FilmPage extends BasePage<[mediaItemId: number]> {
  path(mediaItemId: number) {
    return `/items/${mediaItemId}`;
  }

  // Any film's address, for a test that doesn't know which film it opened.
  readonly anyPath = /\/items\/\d+$/;

  readonly heading = this.main.getByRole("heading", { level: 1 });
  // The picture the banner opens with: the backdrop, or the poster blurred when there is none.
  readonly picture = this.main.locator("picture");
  readonly pictureImage = this.picture.locator("img");
  readonly pictureSource = this.picture.locator("source");
  readonly noPosterPlaceholder = this.main.getByRole("img", { name: "No poster" });
  // A book's, set in type: its title and first author.
  readonly noCoverPlaceholder = this.main.getByRole("img", { name: "No cover" });
  readonly buttons = this.main.getByRole("button");
  readonly sectionHeadings = this.main.getByRole("heading", { level: 2 });

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
  // A book's actions.
  readonly readButton = this.main.getByRole("button", { name: "Read", exact: true });
  readonly readAgainButton = this.main.getByRole("button", { name: "Read again" });
  readonly wantToReadButton = this.main.getByRole("button", {
    name: "Want to read",
    pressed: false,
  });
  readonly onReadingListButton = this.main.getByRole("button", {
    name: "On your Reading list",
    pressed: true,
  });
  readonly startReadingButton = this.main.getByRole("button", { name: "Start reading" });
  readonly startRereadingButton = this.main.getByRole("button", { name: "Start rereading" });
  // Any button that starts a Media Item, which a film never has.
  readonly startButtons = this.main.getByRole("button", { name: /^Start/ });
  readonly readingCard = new InProgressCard(
    this.main.getByRole("region", { name: "Reading", exact: true }),
  );
  readonly startDateDialog = new StartDateDialog(
    this.page.getByRole("dialog", { name: "Change the start date" }),
  );
  readonly addToListButton = this.main.getByRole("button", { name: "Add to collection" });
  readonly toast = new Toast(this.page.getByRole("status"));
  // Only for a film the User added themselves.
  readonly editFilmButton = this.main.getByRole("button", { name: "Edit film" });
  readonly deleteFilmButton = this.main.getByRole("button", { name: "Delete film" });
  // Only for a book the User added themselves.
  readonly editBookButton = this.main.getByRole("button", { name: "Edit book" });
  readonly deleteBookButton = this.main.getByRole("button", { name: "Delete book" });
  // Why the page shows no Media Item: there is none, or it couldn't be loaded.
  readonly errorMessage = this.main.getByRole("alert");

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
  readonly readingsHeading = this.main.getByRole("heading", { name: "Readings", level: 2 });
  readonly readings = this.main.getByRole("list", { name: "Readings" }).getByRole("listitem");
  readonly notReadYetMessage = this.main.getByText("Not read yet");
  readonly entryActionsMenu = new EntryActionsMenu(this.page.getByRole("menu"));
  readonly deleteEntryDialog = new ConfirmDialog(
    this.page.getByRole("alertdialog", { name: "Delete this entry?" }),
  );

  // Any text on the page, such as the film's runtime and genres.
  text(content: string) {
    return this.main.getByText(content);
  }

  // The sharp poster, not the blurred copy of it a picture without a backdrop shows.
  posterImage(url: string) {
    return this.main.locator(`img[src="${url}"]:not(picture img)`);
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

  reading(index: number) {
    return new ItemHistoryRow(this.readings.nth(index));
  }

  // The "⋯" button of the Viewing with this date, or "No date".
  entryActionsButton(date: string) {
    return this.main.getByRole("button", { name: `Actions for ${date}` });
  }

  // Opens the "⋯" menu of the Viewing with this date and picks an action.
  @step
  async chooseEntryAction(date: string, action: EntryAction): Promise<void> {
    await this.entryActionsButton(date).click();
    await this.entryActionsMenu.item(action).click();
  }

  // Named after the film, or "Edit your entry for Alien" when it edits a Log Entry.
  logEntryDialog(name: string) {
    return new LogEntryDialog(this.page.getByRole("dialog", { name, exact: true }));
  }

  editFilmDialog(filmLabel: string) {
    return new ManualMediaItemDialog(this.page.getByRole("dialog", { name: `Edit ${filmLabel}` }));
  }

  deleteFilmDialog(filmLabel: string) {
    return new ConfirmDialog(this.page.getByRole("alertdialog", { name: `Delete ${filmLabel}?` }));
  }

  filmListsDialog(filmLabel: string) {
    return new FilmListsDialog(
      this.page.getByRole("dialog", { name: `Collections for ${filmLabel}` }),
    );
  }
}
