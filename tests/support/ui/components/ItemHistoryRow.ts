import { ScopedComponent } from "./ScopedComponent";

// One Log Entry among a film's Viewings.
export class ItemHistoryRow extends ScopedComponent {
  readonly rewatchBadge = this.root.getByText("Rewatch", { exact: true });

  // The "⋯" button, named after the entry's date: "Actions for Sep 15, 2001".
  actionsButton(date: string) {
    return this.root.getByRole("button", { name: `Actions for ${date}` });
  }

  ratingStars(label: string) {
    return this.root.getByRole("img", { name: label });
  }

  text(content: string) {
    return this.root.getByText(content);
  }
}
