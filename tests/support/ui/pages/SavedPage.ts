import { ScopedComponent } from "../components/ScopedComponent";
import { BasePage } from "./BasePage";

// The Media Types Saved has a tile for.
export type MediaTypeName = "Films" | "Books";

// A Media Type's tile: its name is the link that opens its Backlog's tab, described by the counts
// of its tabs. With nothing saved it also offers "Find a film", or "Find a book".
export class MediaTypeTile extends ScopedComponent {
  readonly link = this.root.getByRole("heading").getByRole("link");
  readonly findFilmLink = this.root.getByRole("link", { name: "Find a film" });
  readonly findBookLink = this.root.getByRole("link", { name: "Find a book" });
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

  // A Media Type's tile, by the name on it.
  tile(name: MediaTypeName) {
    const named = this.page.getByRole("heading", { name, exact: true });
    return new MediaTypeTile(this.tiles.filter({ has: named }));
  }
}
