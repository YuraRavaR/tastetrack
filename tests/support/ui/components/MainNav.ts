import { ScopedComponent } from "./ScopedComponent";

// The links to the sections: Home, Log, Watchlist and Lists. The current one is marked.
export class MainNav extends ScopedComponent {
  readonly links = this.root.getByRole("link");
  readonly currentLinks = this.root.locator("[aria-current]");

  link(name: string) {
    return this.root.getByRole("link", { name, exact: true });
  }
}
