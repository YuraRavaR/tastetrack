import { ScopedComponent } from "./ScopedComponent";

// One Log Entry among a film's Viewings.
export class ItemHistoryRow extends ScopedComponent {
  readonly rewatchBadge = this.root.getByText("Rewatch", { exact: true });
}
