import { step } from "../../step";
import { PosterGridItem } from "../components/PosterGridItem";
import { BasePage } from "./BasePage";

export type LibraryTab = "Watchlist" | "Watched";

// The chips above the grid: the sort, then the filters; Rating only on Watched.
export type LibraryChip = "Sort" | "Genre" | "Decade" | "Rating";

const tabPaths: Record<LibraryTab, string> = { Watchlist: "watchlist", Watched: "watched" };

// Saved for films: the Library's Watchlist and Watched tabs, each a grid of posters.
export class LibraryPage extends BasePage<[tab?: LibraryTab]> {
  path(tab: LibraryTab = "Watchlist") {
    return `/saved/films/${tabPaths[tab]}`;
  }

  readonly heading = this.main.getByRole("heading", { level: 1 });
  // "‹ Saved" above the heading on a phone, the breadcrumb's first link from md.
  readonly backToSavedLink = this.main.getByRole("link", { name: "Saved", exact: true });
  readonly breadcrumb = this.main.getByRole("navigation", { name: "Breadcrumb" });
  readonly tabsNav = this.main.getByRole("navigation", { name: "Status" });
  // The buttons of an empty tab's quiet block.
  readonly findFilmLink = this.main.getByRole("link", { name: "Find a film" });
  readonly goToWatchlistLink = this.main.getByRole("link", { name: "Go to Watchlist" });
  readonly chipsGroup = this.main.getByRole("group", { name: "Sort and filters" });
  readonly chips = this.chipsGroup.getByRole("button");
  // The open chip's menu of single choices.
  readonly menu = this.page.getByRole("menu");
  readonly choices = this.menu.getByRole("menuitemradio");
  readonly clearFiltersButton = this.main.getByRole("button", { name: "Clear filters" });

  // Any text on the page, such as an empty tab's line.
  text(content: string) {
    return this.main.getByText(content);
  }

  // A tab's link, named with its count, such as "Watchlist 2".
  tab(name: LibraryTab) {
    return this.tabsNav.getByRole("link", { name: new RegExp(`^${name}\\b`) });
  }

  // The posters of the tab that is open.
  posters(tab: LibraryTab) {
    return this.main.getByRole("list", { name: tab }).getByRole("listitem");
  }

  // A poster by its film's title, in full.
  poster(tab: LibraryTab, title: string) {
    const titled = this.page.getByText(title, { exact: true });
    return new PosterGridItem(this.posters(tab).filter({ has: titled }));
  }

  // A chip, named with its current choice, such as "Sort: Date added" or "Genre: Any genre".
  chip(name: LibraryChip) {
    return this.chipsGroup.getByRole("button", { name: new RegExp(`^${name}:`) });
  }

  // A choice in the open chip's menu, such as "Title" or "Any genre".
  choice(name: string) {
    return this.menu.getByRole("menuitemradio", { name, exact: true });
  }

  @step
  async choose(chip: LibraryChip, choice: string): Promise<void> {
    await this.chip(chip).click();
    await this.choice(choice).click();
    await this.menu.waitFor({ state: "hidden" });
  }
}
