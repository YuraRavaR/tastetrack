import { step } from "../../step";
import { ScopedComponent } from "./ScopedComponent";

// The Note of one film in a List or on the Watchlist, named "Note for Aliens (1986)".
export class NoteDialog extends ScopedComponent {
  readonly noteInput = this.root.getByLabel("Note");
  readonly saveButton = this.root.getByRole("button", { name: "Save" });

  @step
  async saveNote(note: string): Promise<void> {
    await this.noteInput.fill(note);
    await this.saveButton.click();
  }
}
