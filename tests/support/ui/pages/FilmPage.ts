import { ItemHistoryRow } from "../components/ItemHistoryRow";
import { LogEntryDialog } from "../components/LogEntryDialog";
import { Toast } from "../components/Toast";
import { BasePage } from "./BasePage";

// A film's page: its banner, the actions on it, the tiles and its Viewings.
export class FilmPage extends BasePage<[mediaItemId: number]> {
  path(mediaItemId: number) {
    return `/items/${mediaItemId}`;
  }

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
  readonly ratingStatName = this.main.getByText("Your rating");

  readonly viewingsHeading = this.main.getByRole("heading", { name: "Viewings" });
  readonly viewings = this.main.getByRole("list", { name: "Viewings" }).getByRole("listitem");
  readonly noViewingsMessage = this.main.getByText("No viewings yet");
  readonly noViewingsHint = this.main.getByText(
    "Each time you watch it, the date, Rating and Review show here.",
  );

  posterImage(url: string) {
    return this.main.locator(`img[src="${url}"]`);
  }

  // The Current Rating's stars, such as "5 stars".
  ratingStars(label: string) {
    return this.ratingStat.getByRole("img", { name: label });
  }

  viewing(index: number) {
    return new ItemHistoryRow(this.viewings.nth(index));
  }

  logEntryDialog(filmTitle: string) {
    return new LogEntryDialog(this.page.getByRole("dialog", { name: filmTitle, exact: true }));
  }
}
