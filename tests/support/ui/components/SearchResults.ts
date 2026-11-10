import { step } from "../../step";
import { ScopedComponent } from "./ScopedComponent";

// One film among the search results, with its actions and the Lists it is on.
export class SearchResultRow extends ScopedComponent {
  readonly poster = this.root.locator("img");
  readonly noPosterPlaceholder = this.root.getByRole("img", { name: "No poster" });
  // A book's, set in type: its title and first author.
  readonly noCoverPlaceholder = this.root.getByRole("img", { name: "No cover" });
  // Every control but the title: on a book's row, Want to read alone so far.
  readonly actionButtons = this.root.getByRole("button", {
    name: /^(Mark|Watched|Read|Want to|Add to)/,
  });
  readonly markWatchedButton = this.root.getByRole("button", { name: "Mark watched" });
  readonly watchedAgainButton = this.root.getByRole("button", { name: "Watched again" });
  readonly watchedAgainIcon = this.watchedAgainButton.locator("svg");
  readonly wantToWatchButton = this.root.getByRole("button", { name: "Want to watch" });
  // The same bookmark, pressed: the film is on the Watchlist.
  readonly onWatchlistButton = this.root.getByRole("button", {
    name: "Want to watch",
    pressed: true,
  });
  readonly markReadButton = this.root.getByRole("button", { name: "Mark read" });
  readonly readAgainButton = this.root.getByRole("button", { name: "Read again" });
  // A book's bookmark, and the same one pressed: the book is on the Reading list.
  readonly wantToReadButton = this.root.getByRole("button", { name: "Want to read" });
  readonly onReadingListButton = this.root.getByRole("button", {
    name: "Want to read",
    pressed: true,
  });
  readonly addToListButton = this.root.getByRole("button", { name: "Add to collection" });
  // On a List's page: adds the film to that List, which then says so.
  readonly addButton = this.root.getByRole("button", { name: "Add", exact: true });
  readonly inThisListLabel = this.root.getByText("In this Collection");
  readonly listsIcon = this.root.getByRole("img", { name: "Collections" });
  readonly addedByYouLabel = this.root.getByText("Added by you");

  // Clicks the middle of the poster, or of its placeholder. The title's link or button stretches
  // over it, so the click goes to the row there, as a User's does, not to the image.
  @step
  async clickPoster(): Promise<void> {
    const poster = this.poster.or(this.noPosterPlaceholder).or(this.noCoverPlaceholder);
    const [row, cover] = await Promise.all([this.root.boundingBox(), poster.boundingBox()]);
    if (!row || !cover) throw new Error("The result's row or poster isn't on screen");
    const x = cover.x - row.x + cover.width / 2;
    const y = cover.y - row.y + cover.height / 2;
    await this.root.click({ position: { x, y } });
  }

  // The link to the film's page, by its label.
  filmLink(label: string) {
    return this.root.getByRole("link", { name: label });
  }

  // The title of a film not yet in the catalog, a button that adds it there, then opens its page.
  filmButton(label: string) {
    return this.root.getByRole("button", { name: label, exact: true });
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

// The TMDB results of a film search: a list named "From TMDB".
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
