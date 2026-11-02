import { step } from "../../step";
import { ScopedComponent } from "./ScopedComponent";

// The dialog that logs a film as watched, named after the film, or edits one of its Log Entries.
export class LogEntryDialog extends ScopedComponent {
  readonly closeButton = this.root.getByRole("button", { name: "Close" });
  readonly cancelButton = this.root.getByRole("button", { name: "Cancel" });
  readonly deleteButton = this.root.getByRole("button", { name: "Delete" });
  readonly rewatchSwitch = this.root.getByRole("switch", { name: "Rewatch" });
  readonly reviewInput = this.root.getByLabel("Review");
  readonly pressedDateChips = this.root.getByRole("button", { pressed: true });
  readonly dateError = this.root.getByText("That isn't a valid date.");
  readonly errorMessage = this.root.getByRole("alert");
  // The hint with the film's Current Rating and date, once it is in the Log.
  readonly lastTime = this.root.getByText("Last time");
  readonly watchlistNote = this.root.getByText("Saving takes it off your Watchlist");
  readonly checkedRatingRadios = this.root.getByRole("radio", { checked: true });
  readonly dateInput = this.root.getByLabel("Date watched");
  readonly saveButton = this.root.getByRole("button", { name: "Save" });

  // "Watched" above the title, or "Watched again" for a film already in the Log.
  kindLabel(label: string) {
    return this.root.getByText(label, { exact: true });
  }

  // The chosen Rating as a number, "4.5", or "–" before one is chosen.
  shownRating(value: string) {
    return this.root.getByText(value, { exact: true });
  }

  // A Rating by its stars, such as "3 stars" or "1 star".
  ratingRadio(label: string) {
    return this.root.getByRole("radio", { name: label, exact: true });
  }

  // When it was watched: Today, Yesterday, Other date or No date.
  dateChip(name: string) {
    return this.root.getByRole("button", { name });
  }

  @step
  async rate(label: string): Promise<void> {
    await this.ratingRadio(label).check();
  }

  @step
  async save(): Promise<void> {
    await this.saveButton.click();
  }
}
