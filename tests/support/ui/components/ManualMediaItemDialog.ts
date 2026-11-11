import { ScopedComponent } from "./ScopedComponent";

// A film or a book the User adds themselves, which only they can see: "Add a film manually" adds
// one, "Edit Весілля Олени та Тараса (2019)" changes one.
export class ManualMediaItemDialog extends ScopedComponent {
  // Exact, as "Original Title" holds the word too.
  readonly titleInput = this.root.getByLabel("Title", { exact: true });
  readonly originalTitleInput = this.root.getByLabel("Original Title");
  readonly yearInput = this.root.getByLabel("Year");
  readonly minutesInput = this.root.getByLabel("Minutes");
  // A book's: names separated by commas.
  readonly authorsInput = this.root.getByLabel("Authors");
  readonly addButton = this.root.getByRole("button", { name: "Add", exact: true });
  readonly addAnywayButton = this.root.getByRole("button", { name: "Add anyway" });
  readonly saveButton = this.root.getByRole("button", { name: "Save" });
  readonly errorMessage = this.root.getByRole("alert");

  genreCheckbox(genre: string) {
    return this.root.getByRole("checkbox", { name: genre });
  }
}
