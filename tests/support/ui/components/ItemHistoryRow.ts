import { ScopedComponent } from "./ScopedComponent";

// One Log Entry or Thought in a Media Item's History.
export class ItemHistoryRow extends ScopedComponent {
  readonly revisitBadge = this.root.getByText("Rewatch", { exact: true });
  readonly bookRevisitBadge = this.root.getByText("Reread", { exact: true });

  // The "⋯" button, named after the entry's date: "Actions for Sep 15, 2001".
  actionsButton(date: string) {
    return this.root.getByRole("button", { name: `Actions for ${date}` });
  }

  // A Thought's icon, "Thought" or "Quote", or a Log Entry's stars, such as "4 stars".
  image(name: string) {
    return this.root.getByRole("img", { name, exact: true });
  }

  ratingStars(label: string) {
    return this.root.getByRole("img", { name: label });
  }

  text(content: string | RegExp, options?: { exact: boolean }) {
    return this.root.getByText(content, options);
  }
}
