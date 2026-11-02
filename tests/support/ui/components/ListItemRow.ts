import { ScopedComponent } from "./ScopedComponent";

// One film in a List or on the Watchlist, with its order and Note.
export class ListItemRow extends ScopedComponent {
  readonly moveUpButton = this.root.getByRole("button", { name: "Move up" });
  readonly addNoteButton = this.root.getByRole("button", { name: "Add a Note" });
}
