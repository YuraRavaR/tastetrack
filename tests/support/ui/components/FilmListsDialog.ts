import { step } from "../../step";
import { ScopedComponent } from "./ScopedComponent";

// Which of the User's Lists a film is on, one checkbox each, named "Lists for Alien (1979)".
export class FilmListsDialog extends ScopedComponent {
  readonly doneButton = this.root.getByRole("button", { name: "Done" });

  checkbox(listName: string) {
    return this.root.getByRole("checkbox", { name: listName });
  }

  @step
  async done(): Promise<void> {
    await this.doneButton.click();
  }
}
