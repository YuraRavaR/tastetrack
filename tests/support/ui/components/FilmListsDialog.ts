import type { Page } from "@playwright/test";
import { step } from "../../step";
import { ScopedComponent } from "./ScopedComponent";

// Which of the User's Lists a film is on, one checkbox each, named "Collections for Alien (1979)".
// A song's makes a List in place: New collection turns it into a form named "New collection", with
// a Name and Create and add, and with none yet the form shows at once.
export class FilmListsDialog extends ScopedComponent {
  // The dialog, by the film's label, in either of its views.
  static named(page: Page, filmLabel: string) {
    const label = filmLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return page.getByRole("dialog", {
      name: new RegExp(`^(Collections for ${label}|New collection)$`),
    });
  }

  readonly doneButton = this.root.getByRole("button", { name: "Done" });
  // Shown to a User with no Lists yet.
  readonly makeListLink = this.root.getByRole("link", { name: "Make a collection" });
  readonly checkboxes = this.root.getByRole("checkbox");
  // Each List's row, in the dialog's order.
  readonly rows = this.root.getByRole("listitem");
  readonly newListButton = this.root.getByRole("button", { name: "New collection" });
  readonly backButton = this.root.getByRole("button", { name: "Back to your Collections" });
  readonly nameInput = this.root.getByRole("textbox", { name: "Name" });
  readonly createAndAddButton = this.root.getByRole("button", { name: "Create and add" });
  readonly errorMessage = this.root.getByRole("alert");

  checkbox(listName: string) {
    return this.root.getByRole("checkbox", { name: listName });
  }

  // Any text in the dialog, such as what it says with no Collection yet.
  text(content: string) {
    return this.root.getByText(content);
  }

  // Names a new List and makes it with the film in it, from the form New collection opens or the
  // one shown at once.
  @step
  async createAndAdd(name: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.createAndAddButton.click();
  }

  @step
  async done(): Promise<void> {
    await this.doneButton.click();
  }
}
