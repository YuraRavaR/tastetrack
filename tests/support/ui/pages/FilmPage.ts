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

// The card a Media Item's page shows while it is In Progress, which a book calls "Reading" and a
// series "Watching": since when, the button that changes that, and Finished and Stop reading or
// Stop watching. A series' also holds its Progress: the next episode with the check that marks it
// watched, the bar, and the steppers that set the last episode watched. A book's holds the page,
// the bar with a page count, and the editor that Add page or Change opens in its place.
class InProgressCard extends ScopedComponent {
  readonly changeStartDateButton = this.root.getByRole("button", {
    name: "Change the start date",
  });
  readonly finishedButton = this.root.getByRole("button", { name: "Finished" });
  readonly stopReadingButton = this.root.getByRole("button", { name: "Stop reading" });
  readonly stopWatchingButton = this.root.getByRole("button", { name: "Stop watching" });
  readonly checkButton = this.root.getByRole("button", { name: /^Mark S\d+ · E\d+ watched$/ });
  // Named with its count, such as "15 of 62 episodes watched".
  readonly bar = this.root.getByRole("img", { name: /episodes watched$/ });
  readonly lastWatched = this.root.getByRole("group", { name: "Last watched" });
  readonly season = this.lastWatched.getByRole("status", { name: "Season" });
  readonly episode = this.lastWatched.getByRole("status", { name: "Episode" });
  readonly previousSeasonButton = this.lastWatched.getByRole("button", { name: "Previous season" });
  readonly nextSeasonButton = this.lastWatched.getByRole("button", { name: "Next season" });
  readonly previousEpisodeButton = this.lastWatched.getByRole("button", {
    name: "Previous episode",
  });
  readonly nextEpisodeButton = this.lastWatched.getByRole("button", { name: "Next episode" });
  // A book's Progress.
  readonly addPageButton = this.root.getByRole("button", { name: "Add page" });
  readonly changePageButton = this.root.getByRole("button", { name: "Change the page" });
  // Named with the page and the page count, such as "Page 142 of 380".
  readonly pageBar = this.root.getByRole("img", { name: /^Page \d+ of \d+$/ });
  readonly pageInput = this.root.getByLabel("Page", { exact: true });
  readonly pageCountInput = this.root.getByLabel("Pages in your edition");
  readonly clearButton = this.root.getByRole("button", { name: "Clear" });
  readonly cancelButton = this.root.getByRole("button", { name: "Cancel" });
  readonly saveButton = this.root.getByRole("button", { name: "Save" });
  // Why the page or the page count wasn't saved.
  readonly pageProblem = this.root.getByRole("alert");

  // Fills the page and the page count, "" leaving one empty, and saves them.
  @step
  async savePage(page: string, pageCount: string): Promise<void> {
    await this.pageInput.fill(page);
    await this.pageCountInput.fill(pageCount);
    await this.saveButton.click();
  }

  text(content: string | RegExp) {
    return this.root.getByText(content);
  }
}

// Watch more's choices of where to start a series already rated. "From season 5" names the
// latest season the series lists.
type WatchMoreChoice = `From season ${number}` | "From the start" | "Choose where you are";

// The choice Watch more opens: a radio per place to start, each described by the next episode it
// starts at, and the steppers of the User's own last episode watched.
class WatchMoreDialog extends ScopedComponent {
  readonly choices = this.root.getByRole("radio");
  readonly lastWatched = this.root.getByRole("group", { name: "Last watched" });
  readonly season = this.lastWatched.getByRole("status", { name: "Season" });
  readonly episode = this.lastWatched.getByRole("status", { name: "Episode" });
  readonly nextSeasonButton = this.lastWatched.getByRole("button", { name: "Next season" });
  readonly nextEpisodeButton = this.lastWatched.getByRole("button", { name: "Next episode" });
  readonly closeButton = this.root.getByRole("button", { name: "Close" });
  readonly startWatchingButton = this.root.getByRole("button", { name: "Start watching" });

  choice(name: WatchMoreChoice) {
    return this.root.getByRole("radio", { name, exact: true });
  }
}

type DateChip = "Today" | "Yesterday" | "Other date" | "No date";

// The dialog that changes when a Media Item In Progress was started, with a Log Entry's date chips.
class StartDateDialog extends ScopedComponent {
  readonly dateInput = this.root.getByLabel("Start date", { exact: true });
  readonly saveButton = this.root.getByRole("button", { name: "Save" });

  dateChip(name: DateChip) {
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

// What a Media Item's page says it is about, under its titles: the tagline and the overview, More
// and Less, the language switch, the credits as names under their labels, and the source.
class AboutBlock extends ScopedComponent {
  readonly moreButton = this.root.getByRole("button", { name: "More" });
  readonly lessButton = this.root.getByRole("button", { name: "Less" });
  readonly ukrainianButton = this.root.getByRole("button", { name: "Українською" });
  readonly englishButton = this.root.getByRole("button", { name: "In English" });
  readonly creditLabels = this.root.getByRole("term");
  readonly creditNames = this.root.getByRole("definition");

  text(content: string | RegExp) {
    return this.root.getByText(content);
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
  // A series' actions.
  readonly startWatchingButton = this.main.getByRole("button", { name: "Start watching" });
  // In Start watching's place once the series has a Log Entry.
  readonly watchMoreButton = this.main.getByRole("button", { name: "Watch more" });
  readonly watchMoreDialog = new WatchMoreDialog(
    this.page.getByRole("dialog", { name: "Watch more" }),
  );
  // Any dialog, for a test that checks none opened.
  readonly dialogs = this.page.getByRole("dialog");
  readonly watchingCard = new InProgressCard(
    this.main.getByRole("region", { name: "Watching", exact: true }),
  );
  readonly startDateDialog = new StartDateDialog(
    this.page.getByRole("dialog", { name: "Change the start date" }),
  );
  readonly addToListButton = this.main.getByRole("button", { name: "Add to collection" });
  readonly toast = new Toast(this.page.getByRole("status"));
  // Only for a film the User added themselves.
  readonly editFilmButton = this.main.getByRole("button", { name: "Edit film" });
  readonly deleteFilmButton = this.main.getByRole("button", { name: "Delete film" });
  // Only for a series the User added themselves.
  readonly editSeriesButton = this.main.getByRole("button", { name: "Edit series" });
  // Only for a book the User added themselves.
  readonly editBookButton = this.main.getByRole("button", { name: "Edit book" });
  readonly deleteBookButton = this.main.getByRole("button", { name: "Delete book" });
  // Why the page shows no Media Item: there is none, or it couldn't be loaded.
  readonly errorMessage = this.main.getByRole("alert");

  readonly about = new AboutBlock(this.main.getByRole("region", { name: "About" }));

  // The tiles: how often it was watched, its Current Rating, when first watched.
  readonly tiles = this.main.getByRole("region", { name: "At a glance" });
  readonly stats = this.tiles.getByRole("definition");
  readonly watchedStat = this.stats.nth(0);
  readonly ratingStat = this.stats.nth(1);
  readonly statNames = this.tiles.getByRole("term");
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
