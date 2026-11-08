import { ScopedComponent } from "../components/ScopedComponent";
import { BasePage } from "./BasePage";

// The Media Types Saved has a tile for: Films, and Books, still to come.
export type MediaTypeName = "Films" | "Books";

// A built Media Type's tile: its name is the link that opens its Watchlist, described by the
// counts of its two tabs. With nothing saved it also offers "Find a film".
export class MediaTypeTile extends ScopedComponent {
  readonly link = this.root.getByRole("heading").getByRole("link");
  readonly findFilmLink = this.root.getByRole("link", { name: "Find a film" });
  // The fan of covers is hidden from assistive technology, being the Watchlist's posters again,
  // so its posters are found by tag: one img per cover with a poster.
  readonly coverImages = this.root.locator("img");
  // A cover with no poster, its placeholder.
  readonly coverPlaceholders = this.root.getByRole("img", {
    name: "No poster",
    includeHidden: true,
  });
}

// Saved at "/": one tile per Media Type.
export class SavedPage extends BasePage {
  path() {
    return "/";
  }

  readonly heading = this.main.getByRole("heading", { level: 1 });
  readonly tiles = this.main.getByRole("list", { name: "Media Types" }).getByRole("listitem");

  // A built Media Type's tile, by the name on it.
  tile(name: MediaTypeName) {
    const named = this.page.getByRole("heading", { name, exact: true });
    return new MediaTypeTile(this.tiles.filter({ has: named }));
  }

  // The disabled tile of a Media Type still to come, described as "Coming soon".
  comingSoonTile(name: MediaTypeName) {
    return this.tiles.getByRole("button", { name, exact: true });
  }
}
