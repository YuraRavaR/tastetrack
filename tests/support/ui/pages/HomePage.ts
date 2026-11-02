import { step } from "../../step";
import { FilmListsDialog } from "../components/FilmListsDialog";
import { LogEntryDialog } from "../components/LogEntryDialog";
import { SearchResults } from "../components/SearchResults";
import { BasePage } from "./BasePage";

export class HomePage extends BasePage<[query?: string]> {
  // With a query, home opens on its search results.
  path(query?: string) {
    return query ? `/?q=${encodeURIComponent(query)}` : "/";
  }

  readonly searchBox = this.page.getByRole("searchbox", { name: "Search films" });
  readonly clearSearchButton = this.page.getByRole("button", { name: "Clear search" });
  // A button that runs the search, which home must not need.
  readonly searchButton = this.page.getByRole("button", { name: /^search/i });
  readonly searchResults = new SearchResults(
    this.page.getByRole("list", { name: "Search results" }),
  );

  readonly logRegion = this.page.getByRole("region", { name: "Latest in your Log" });
  readonly logHeading = this.page.getByRole("heading", { name: "Latest in your Log" });
  readonly watchlistRegion = this.page.getByRole("region", { name: "Next on your Watchlist" });

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
