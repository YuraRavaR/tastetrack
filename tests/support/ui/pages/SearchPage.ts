import { step } from "../../step";
import { FilmListsDialog } from "../components/FilmListsDialog";
import { LogEntryDialog } from "../components/LogEntryDialog";
import { ManualMediaItemDialog } from "../components/ManualMediaItemDialog";
import { PosterGridItem } from "../components/PosterGridItem";
import { ScopedComponent } from "../components/ScopedComponent";
import { SearchResults } from "../components/SearchResults";
import { Toast } from "../components/Toast";
import { BasePage } from "./BasePage";

// "In your Saved": the User's own films that match, as covers, each with one status line.
export class SavedMatches extends ScopedComponent {
  readonly films = this.root.getByRole("listitem");
  readonly ratingIcons = this.root.getByRole("img", { name: "Rating" });

  // A film's cover, title and status line, by its title.
  film(title: string) {
    const titleText = this.root.page().getByText(title, { exact: true });
    return new PosterGridItem(this.films.filter({ has: titleText }));
  }
}

// The Search section: the film search, its results and what can be done with them.
export class SearchPage extends BasePage<[query?: string]> {
  // With a query, Search opens on its results.
  path(query?: string) {
    return query ? `/search?q=${encodeURIComponent(query)}` : "/search";
  }

  readonly searchHeading = this.page.getByRole("heading", { level: 1, name: "Search" });
  readonly searchBox = this.page.getByRole("searchbox", { name: "Search" });
  readonly clearSearchButton = this.page.getByRole("button", { name: "Clear search" });
  // A button that runs the search, which Search must not need.
  readonly searchButton = this.page.getByRole("button", { name: /^search/i });
  readonly filmsChip = this.page.getByRole("button", { name: "Films", pressed: true });
  readonly booksChip = this.page.getByRole("button", { name: "Books" });
  readonly hint = this.page.getByText("Type a title to search your Saved and TMDB.");
  readonly savedMatches = new SavedMatches(this.page.getByRole("list", { name: "In your Saved" }));
  readonly savedHeading = this.page.getByRole("heading", { level: 2, name: /^In your Saved/ });
  // TMDB's results, the User's own Manual Media Items not in Saved first.
  readonly searchResults = new SearchResults(this.page.getByRole("list", { name: "From TMDB" }));
  readonly tmdbHeading = this.page.getByRole("heading", { level: 2, name: /^From TMDB/ });
  readonly noResultsMessage = this.page.getByText(/^No films found for “.*”\.$/);
  readonly addManuallyButton = this.page.getByRole("button", { name: "Add manually" });
  readonly addManuallyDialog = new ManualMediaItemDialog(
    this.page.getByRole("dialog", { name: "Add a film manually" }),
  );
  readonly toast = new Toast(this.page.getByRole("status"));
  readonly errorMessage = this.page.getByRole("alert");

  // Any text on the page, such as a message that must be gone.
  text(content: string) {
    return this.page.getByText(content);
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
