import { step } from "../../step";
import { FilmListsDialog } from "../components/FilmListsDialog";
import { LogEntryDialog } from "../components/LogEntryDialog";
import { ManualMediaItemDialog } from "../components/ManualMediaItemDialog";
import { SearchResults } from "../components/SearchResults";
import { Toast } from "../components/Toast";
import { BasePage } from "./BasePage";

// The Search section: the film search, its results and what can be done with them.
export class SearchPage extends BasePage<[query?: string]> {
  // With a query, Search opens on its results.
  path(query?: string) {
    return query ? `/search?q=${encodeURIComponent(query)}` : "/search";
  }

  readonly searchHeading = this.page.getByRole("heading", { level: 1, name: "Search films" });
  readonly searchBox = this.page.getByRole("searchbox", { name: "Search films" });
  readonly clearSearchButton = this.page.getByRole("button", { name: "Clear search" });
  // A button that runs the search, which Search must not need.
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
