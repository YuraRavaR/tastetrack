import { step } from "../../step";
import { FilmListsDialog } from "../components/FilmListsDialog";
import { LogEntryDialog } from "../components/LogEntryDialog";
import { ManualMediaItemDialog } from "../components/ManualMediaItemDialog";
import { PosterGridItem } from "../components/PosterGridItem";
import { ScopedComponent } from "../components/ScopedComponent";
import { SearchResults } from "../components/SearchResults";
import { Toast } from "../components/Toast";
import { BasePage } from "./BasePage";

// "In your Saved": the User's Media Items that match, those in their Library or on their Lists,
// as covers, each with one status line.
export class UserMediaItemMatches extends ScopedComponent {
  readonly films = this.root.getByRole("listitem");
  readonly ratingIcons = this.root.getByRole("img", { name: "Rating" });

  // A film's cover, title and status line, by its title.
  film(title: string) {
    const titleText = this.root.page().getByText(title, { exact: true });
    return new PosterGridItem(this.films.filter({ has: titleText }));
  }
}

// A Media Type chip's name.
export type MediaTypeChip = "Films" | "Books" | "Series" | "Games";

// A Media Type in Search's address, unless it is films.
type SearchMediaType = "book" | "series" | "game";

// The Search section: the search of one Media Type, its results and what can be done with them.
export class SearchPage extends BasePage<[query?: string, mediaType?: SearchMediaType]> {
  // With a query, Search opens on its results; with a Media Type, on that one's, else on films'.
  path(query?: string, mediaType?: SearchMediaType) {
    // Encoded as the app's URL has it, a space as "+", the query before the type.
    const params = new URLSearchParams({
      ...(query && { q: query }),
      ...(mediaType && { type: mediaType }),
    });
    return params.size > 0 ? `/search?${params}` : "/search";
  }

  readonly searchHeading = this.page.getByRole("heading", { level: 1, name: "Search" });
  readonly searchBox = this.page.getByRole("searchbox", { name: "Search" });
  readonly clearSearchButton = this.page.getByRole("button", { name: "Clear search" });
  // A button that runs the search, which Search must not need.
  readonly searchButton = this.page.getByRole("button", { name: /^search/i });
  readonly mediaTypeChips = this.page.getByRole("group", { name: "Category" });
  readonly userMediaItems = new UserMediaItemMatches(
    this.page.getByRole("list", { name: "In your Saved" }),
  );
  readonly userMediaItemsHeading = this.page.getByRole("heading", {
    level: 2,
    name: /^In your Saved/,
  });
  // TMDB's results, the User's own Manual Media Items not in Saved first.
  readonly searchResults = new SearchResults(this.page.getByRole("list", { name: "From TMDB" }));
  readonly tmdbHeading = this.page.getByRole("heading", { level: 2, name: /^From TMDB/ });
  readonly noResultsMessage = this.page.getByText(/^No films found for “.*”\.$/);
  // Open Library's results, on Books.
  readonly openLibraryResults = new SearchResults(
    this.page.getByRole("list", { name: "From Open Library" }),
  );
  readonly openLibraryHeading = this.page.getByRole("heading", {
    level: 2,
    name: /^From Open Library/,
  });
  readonly noBooksMessage = this.page.getByText(/^No books found for “.*”\.$/);
  readonly noSeriesMessage = this.page.getByText(/^No series found for “.*”\.$/);
  // IGDB's results, on Games.
  readonly igdbResults = new SearchResults(this.page.getByRole("list", { name: "From IGDB" }));
  readonly igdbHeading = this.page.getByRole("heading", { level: 2, name: /^From IGDB/ });
  readonly noGamesMessage = this.page.getByText(/^No games found for “.*”\.$/);
  readonly englishTitleHint = this.page.getByText(
    "Try the English title: IGDB knows games by their English names.",
  );
  readonly addManuallyButton = this.page.getByRole("button", { name: "Add manually" });
  readonly addManuallyDialog = new ManualMediaItemDialog(
    this.page.getByRole("dialog", { name: "Add a film manually" }),
  );
  readonly addBookManuallyDialog = new ManualMediaItemDialog(
    this.page.getByRole("dialog", { name: "Add a book manually" }),
  );
  readonly addSeriesManuallyDialog = new ManualMediaItemDialog(
    this.page.getByRole("dialog", { name: "Add a series manually" }),
  );
  readonly addGameManuallyDialog = new ManualMediaItemDialog(
    this.page.getByRole("dialog", { name: "Add a game manually" }),
  );
  readonly toast = new Toast(this.page.getByRole("status"));
  readonly errorMessage = this.page.getByRole("alert");

  // Any text on the page, such as a message that must be gone.
  text(content: string) {
    return this.page.getByText(content);
  }

  // Every Media Type's chip.
  get mediaTypeChipButtons() {
    return this.mediaTypeChips.getByRole("button");
  }

  // A Media Type's chip, pressed or not.
  mediaTypeChip(name: MediaTypeChip) {
    return this.mediaTypeChips.getByRole("button", { name, exact: true });
  }

  // The chip of the Media Type Search is on.
  currentChip(name: MediaTypeChip) {
    return this.mediaTypeChips.getByRole("button", { name, exact: true, pressed: true });
  }

  @step
  async search(query: string): Promise<void> {
    await this.searchBox.fill(query);
  }

  logEntryDialog(filmTitle: string) {
    return new LogEntryDialog(this.page.getByRole("dialog", { name: filmTitle, exact: true }));
  }

  // Named after the film's label: "Collections for Alien (1979)".
  filmListsDialog(filmLabel: string) {
    return new FilmListsDialog(
      this.page.getByRole("dialog", { name: `Collections for ${filmLabel}` }),
    );
  }
}
