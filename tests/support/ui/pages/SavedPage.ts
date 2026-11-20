import { LogEntryDialog } from "../components/LogEntryDialog";
import { ScopedComponent } from "../components/ScopedComponent";
import { Toast } from "../components/Toast";
import { WatchingRow } from "../components/WatchingRow";
import { BasePage } from "./BasePage";

// The Media Types Saved has a tile for.
export type MediaTypeName = "Films" | "Books" | "Series" | "Games";

// A Media Type's tile: its name is the link that opens its Backlog's tab, described by the counts
// of its tabs. With nothing saved it also offers "Find a film", "Find a book" or "Find a series".
export class MediaTypeTile extends ScopedComponent {
  readonly link = this.root.getByRole("heading").getByRole("link");
  readonly findFilmLink = this.root.getByRole("link", { name: "Find a film" });
  readonly findBookLink = this.root.getByRole("link", { name: "Find a book" });
  readonly findSeriesLink = this.root.getByRole("link", { name: "Find a series" });
  readonly findGameLink = this.root.getByRole("link", { name: "Find a game" });
  // The fan of covers is hidden from assistive technology, being the Backlog's covers again, so
  // they are found by tag: one img per Media Item with a cover.
  readonly coverImages = this.root.locator("img");
  // A film with no poster, its placeholder.
  readonly coverPlaceholders = this.root.getByRole("img", {
    name: "No poster",
    includeHidden: true,
  });
  // A book with no cover, its cover set in type.
  readonly typesetCovers = this.root.getByRole("img", { name: "No cover", includeHidden: true });
}

// Saved at "/": one tile per Media Type.
export class SavedPage extends BasePage {
  path() {
    return "/";
  }

  readonly heading = this.main.getByRole("heading", { level: 1 });
  readonly tiles = this.main.getByRole("list", { name: "Saved" }).getByRole("listitem");
  // What the User is reading, one row per book, each a link to its page.
  readonly readingNow = this.main.getByRole("region", { name: "Reading now" });
  readonly readingNowRows = this.readingNow.getByRole("listitem");

  // The series the User is watching, one row each.
  readonly watchingNow = this.main.getByRole("region", { name: "Watching now" });
  readonly watchingNowRows = this.watchingNow.getByRole("listitem");
  // The games the User is playing, one row each, a link to its page.
  readonly playingNow = this.main.getByRole("region", { name: "Playing now" });
  readonly playingNowRows = this.playingNow.getByRole("listitem");
  readonly toast = new Toast(this.page.getByRole("status"));

  // A row of Watching now, by its series' title.
  watchingNowRow(title: string) {
    return new WatchingRow(this.watchingNowRows.filter({ hasText: title }));
  }

  // The dialog Finished opens, named after its series.
  logEntryDialog(name: string) {
    return new LogEntryDialog(this.page.getByRole("dialog", { name, exact: true }));
  }

  // A row of Reading now, by its book's title.
  readingNowRow(title: string) {
    return this.readingNowRows.filter({ hasText: title }).getByRole("link");
  }

  // The bar on a row of Reading now, named with the page and the page count: "Page 142 of 380".
  readingNowPageBar(title: string) {
    return this.readingNowRow(title).getByRole("img", { name: /^Page \d+ of \d+$/ });
  }

  // A Media Type's tile, by the name on it.
  tile(name: MediaTypeName) {
    const named = this.page.getByRole("heading", { name, exact: true });
    return new MediaTypeTile(this.tiles.filter({ has: named }));
  }
}
