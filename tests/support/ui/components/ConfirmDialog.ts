import { step } from "../../step";
import { ScopedComponent } from "./ScopedComponent";

// A dialog that asks before something can't be undone, such as "Delete this entry?".
export class ConfirmDialog extends ScopedComponent {
  readonly cancelButton = this.root.getByRole("button", { name: "Cancel" });

  // The button that goes ahead, such as "Delete".
  button(name: string) {
    return this.root.getByRole("button", { name });
  }

  @step
  async confirm(name: string): Promise<void> {
    await this.button(name).click();
  }

  @step
  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}
