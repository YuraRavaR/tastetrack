import { ScopedComponent } from "./ScopedComponent";

// One film in a List or on the Watchlist, with its order and Note.
export class ListItemRow extends ScopedComponent {
  readonly moveEarlierButton = this.root.getByRole("button", { name: "Move earlier" });
  readonly addNoteButton = this.root.getByRole("button", { name: "Add a Note" });
  readonly editNoteButton = this.root.getByRole("button", { name: "Edit Note" });
  readonly removeButton = this.root.getByRole("button", { name: "Remove" });

  // The link to the film's page, by its label.
  filmLink(label: string) {
    return this.root.getByRole("link", { name: label });
  }
}
