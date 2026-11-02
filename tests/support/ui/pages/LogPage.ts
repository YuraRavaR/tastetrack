import { ScopedComponent } from "../components/ScopedComponent";
import { BasePage } from "./BasePage";

// One Log Entry in the Log: the film, its date, Rating and Review.
class LogEntryItem extends ScopedComponent {
  ratingStars(label: string) {
    return this.root.getByRole("img", { name: label });
  }

  text(content: string, options?: { exact?: boolean }) {
    return this.root.getByText(content, options);
  }
}

// The User's Log.
export class LogPage extends BasePage {
  path() {
    return "/log";
  }

  readonly heading = this.page.getByRole("heading", { name: "Your Log", exact: true });
  readonly entries = this.page.getByRole("list", { name: "Log Entries" }).getByRole("listitem");
  readonly rewatchBadges = this.entries.getByText("Rewatch", { exact: true });

  entry(index: number) {
    return new LogEntryItem(this.entries.nth(index));
  }

  // The link to a film's page from its entries, such as /^Alien \(1979\)/.
  filmLink(name: string | RegExp) {
    return this.entries.getByRole("link", { name });
  }
}
