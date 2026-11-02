import { step } from "../../step";
import { FilmListsDialog } from "../components/FilmListsDialog";
import { LogEntryDialog } from "../components/LogEntryDialog";
import { ManualMediaItemDialog } from "../components/ManualMediaItemDialog";
import { ScopedComponent } from "../components/ScopedComponent";
import { SearchResults } from "../components/SearchResults";
import { Toast } from "../components/Toast";
import { BasePage } from "./BasePage";

// One film in a home section: its date, Rating, facts or Note.
class HomeSectionItem extends ScopedComponent {
  readonly revisitBadge = this.root.getByText("Rewatch", { exact: true });

  ratingStars(label: string) {
    return this.root.getByRole("img", { name: label });
  }

  filmLink(label: string) {
    return this.root.getByRole("link", { name: label });
  }

  text(content: string) {
    return this.root.getByText(content);
  }
}

// "Latest in your Log" or "Next on your Watchlist": its heading, a link to the whole section, and
// its first five films or why there are none.
class HomeSection extends ScopedComponent {
  readonly heading = this.root.getByRole("heading");
  readonly items = this.root.getByRole("listitem");
  readonly links = this.root.getByRole("link");
  readonly buttons = this.root.getByRole("button");
  readonly errorMessage = this.root.getByRole("alert");

  item(index: number) {
    return new HomeSectionItem(this.items.nth(index));
  }

  link(name: string) {
    return this.root.getByRole("link", { name });
  }

  text(content: string | RegExp) {
    return this.root.getByText(content);
  }
}

export class HomePage extends BasePage<[query?: string]> {
  // With a query, home opens on its search results.
  path(query?: string) {
    return query ? `/?q=${encodeURIComponent(query)}` : "/";
  }

  readonly searchHeading = this.page.getByRole("heading", { level: 1, name: "Search films" });
  readonly searchBox = this.page.getByRole("searchbox", { name: "Search films" });
  readonly clearSearchButton = this.page.getByRole("button", { name: "Clear search" });
  // A button that runs the search, which home must not need.
  readonly searchButton = this.page.getByRole("button", { name: /^search/i });
  readonly searchResults = new SearchResults(
    this.page.getByRole("list", { name: "Search results" }),
  );
  readonly noResultsMessage = this.page.getByText("No films found.");
  readonly addManuallyButton = this.page.getByRole("button", { name: "Add manually" });
  readonly addManuallyDialog = new ManualMediaItemDialog(
    this.page.getByRole("dialog", { name: "Add a film manually" }),
  );
  readonly toast = new Toast(this.page.getByRole("status"));
  readonly errorMessage = this.page.getByRole("alert");

  readonly logSection = new HomeSection(
    this.page.getByRole("region", { name: "Latest in your Log" }),
  );
  readonly logHeading = this.page.getByRole("heading", { name: "Latest in your Log" });
  readonly watchlistSection = new HomeSection(
    this.page.getByRole("region", { name: "Next on your Watchlist" }),
  );

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

  // Named after the film's label: "Lists for Alien (1979)".
  filmListsDialog(filmLabel: string) {
    return new FilmListsDialog(this.page.getByRole("dialog", { name: `Lists for ${filmLabel}` }));
  }
}
