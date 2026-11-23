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
  // A song's, a note.
  readonly noCoverPlaceholders = this.root.getByRole("img", {
    name: "No cover",
    includeHidden: true,
  });
  // The mark of a shared List, in the words the width shows.
  readonly sharedMark = this.root.getByText(/^Shared( by link)?$/).filter({ visible: true });
}

// Collections: the User's Lists of one Media Type as cards, under the Media Type chips. `?type=`
// names the Media Type, unless it is films.
type ListsMediaType = "book" | "series" | "game" | "album" | "song";

export class ListsPage extends BasePage<[mediaType?: ListsMediaType]> {
  path(mediaType?: ListsMediaType) {
    return mediaType ? `/collections?type=${mediaType}` : "/collections";
  }

  readonly heading = this.main.getByRole("heading", { level: 1, name: "Collections" });
  readonly mediaTypeChips = this.main.getByRole("group", { name: "Category" });
  readonly filmsChip = this.mediaTypeChips.getByRole("button", { name: "Films" });
  readonly booksChip = this.mediaTypeChips.getByRole("button", { name: "Books" });
  readonly seriesChip = this.mediaTypeChips.getByRole("button", { name: "Series" });
  readonly gamesChip = this.mediaTypeChips.getByRole("button", { name: "Games" });
  readonly albumsChip = this.mediaTypeChips.getByRole("button", { name: "Albums" });
  readonly songsChip = this.mediaTypeChips.getByRole("button", { name: "Songs" });
  // The chip of the Media Type Collections is on.
  readonly pressedChip = this.mediaTypeChips.getByRole("button", { pressed: true });
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

  // Any text on the page, such as what the empty state says.
  text(content: string) {
    return this.main.getByText(content);
  }

  // A List's card, by its name.
  card(name: string) {
    const named = this.page.getByRole("link", { name, exact: true });
    return new ListCard(this.lists.filter({ has: named }));
  }

  listLink(name: string) {
    return this.card(name).link;
  }
}
