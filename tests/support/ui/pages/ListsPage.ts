import { ListFormDialog } from "../components/ListFormDialog";
import { ScopedComponent } from "../components/ScopedComponent";
import { BasePage } from "./BasePage";

// A List's card: its name is the link that opens it, described by its Media Type, its count and,
// when shared, "Shared" on a phone or "Shared by link" from `md`.
export class ListCard extends ScopedComponent {
  readonly link = this.root.getByRole("heading").getByRole("link");
  // A cover with no poster, its placeholder, found though the collage is hidden from assistive
  // technology, being the List's first posters again.
  readonly coverPlaceholders = this.root.getByRole("img", {
    name: "No poster",
    includeHidden: true,
  });
  // The mark of a shared List, in the words the width shows.
  readonly sharedMark = this.root.getByText(/^Shared( by link)?$/).filter({ visible: true });
}

// Collections: the User's Lists as cards, under the Media Type chips.
export class ListsPage extends BasePage {
  path() {
    return "/collections";
  }

  readonly heading = this.main.getByRole("heading", { level: 1, name: "Collections" });
  readonly mediaTypeChips = this.main.getByRole("group", { name: "Category" });
  readonly filmsChip = this.mediaTypeChips.getByRole("button", { name: "Films" });
  readonly booksChip = this.mediaTypeChips.getByRole("button", { name: "Books" });
  readonly seriesChip = this.mediaTypeChips.getByRole("button", { name: "Series" });
  readonly emptyMessage = this.main.getByText("No collections yet.");
  // The button in the heading. With no Lists the empty state has its own, after it.
  readonly newListButton = this.main.getByRole("button", { name: "New collection" }).first();
  readonly emptyStateNewListButton = this.main
    .getByRole("button", { name: "New collection" })
    .last();
  readonly newListDialog = new ListFormDialog(
    this.page.getByRole("dialog", { name: "New collection" }),
  );
  readonly lists = this.main.getByRole("list", { name: "Collections" }).getByRole("listitem");

  // A List's card, by its name.
  card(name: string) {
    const named = this.page.getByRole("link", { name, exact: true });
    return new ListCard(this.lists.filter({ has: named }));
  }

  listLink(name: string) {
    return this.card(name).link;
  }
}
