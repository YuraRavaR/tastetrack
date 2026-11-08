import { ScopedComponent } from "./ScopedComponent";

// A List's name and description: "New collection" makes one, "Edit collection" changes one.
export class ListFormDialog extends ScopedComponent {
  readonly nameInput = this.root.getByLabel("Name");
  readonly descriptionInput = this.root.getByLabel("Description");
  readonly createButton = this.root.getByRole("button", { name: "Create" });
  readonly saveButton = this.root.getByRole("button", { name: "Save" });
  readonly errorMessage = this.root.getByRole("alert");
}
