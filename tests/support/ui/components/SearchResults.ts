import { ScopedComponent } from "./ScopedComponent";

// One film among the search results, with its actions and the Lists it is on.
export class SearchResultRow extends ScopedComponent {
  readonly poster = this.root.locator("img");
  readonly noPosterPlaceholder = this.root.getByRole("img", { name: "No poster" });
  readonly markWatchedButton = this.root.getByRole("button", { name: "Mark watched" });
  readonly watchedAgainButton = this.root.getByRole("button", { name: "Watched again" });
  readonly watchedAgainIcon = this.watchedAgainButton.locator("svg");
  readonly wantToWatchButton = this.root.getByRole("button", { name: "Want to watch" });
  // The same bookmark, pressed: the film is on the Watchlist.
  readonly onWatchlistButton = this.root.getByRole("button", {
    name: "Want to watch",
    pressed: true,
  });
  readonly addToListButton = this.root.getByRole("button", { name: "Add to list" });
  // On a List's page: adds the film to that List, which then says so.
  readonly addButton = this.root.getByRole("button", { name: "Add", exact: true });
  readonly inThisListLabel = this.root.getByText("In this List");
  readonly listsIcon = this.root.getByRole("img", { name: "Lists" });
  readonly addedByYouLabel = this.root.getByText("Added by you");

  // The link to the film's page, by its label.
  filmLink(label: string) {
    return this.root.getByRole("link", { name: label });
  }

  // The link to the film's Viewings, named by its Current Rating and count: "4 · 1 viewing".
  itemHistoryLink(label: string) {
    return this.root.getByRole("link", { name: label });
  }

  // A chip linking to one of the Lists the film is on.
  listChip(listName: string) {
    return this.root.getByRole("link", { name: listName, exact: true });
  }

  // How many more Lists the film is on than the chips show: "+1".
  moreLists(count: number) {
    return this.root.getByText(`+${count}`, { exact: true });
  }
}

// The results of a film search: a list named "Search results".
export class SearchResults extends ScopedComponent {
  readonly rows = this.root.getByRole("listitem");
  readonly noPosterPlaceholders = this.root.getByRole("img", { name: "No poster" });

  // A film by its label, such as "Alien (1979)".
  filmLabel(label: string) {
    return this.root.getByText(label, { exact: true });
  }

  link(label: string | RegExp) {
    return this.root.getByRole("link", { name: label, exact: true });
  }

  result(label: string) {
    // `has` looks inside each row, so its locator starts from the page, not from this list.
    const title = this.root.page().getByText(label, { exact: true });
    return new SearchResultRow(this.rows.filter({ has: title }));
  }

  // A result with this text anywhere in it, for a film whose full label differs by source.
  resultWithText(text: string) {
    return new SearchResultRow(this.rows.filter({ hasText: text }));
  }
}
