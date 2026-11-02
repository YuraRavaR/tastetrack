import { step } from "../../step";
import { ScopedComponent } from "./ScopedComponent";

// The message at the foot of the screen after an action, some with a way to undo it.
export class Toast extends ScopedComponent {
  readonly undoButton = this.root.getByRole("button", { name: "Undo" });

  @step
  async undo(): Promise<void> {
    await this.undoButton.click();
  }
}
