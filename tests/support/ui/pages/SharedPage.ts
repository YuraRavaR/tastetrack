import { BasePage } from "./BasePage";

// What a Share Link opens, for anyone who has it: the List's title, description, owner and films.
export class SharedPage extends BasePage<[token: string]> {
  path(token: string) {
    return `/s/${token}`;
  }

  // What a revoked, replaced or unknown link shows alike.
  readonly notFoundMessage = this.page.getByText("This link doesn't work.");

  heading(title: string) {
    return this.page.getByRole("heading", { name: title });
  }

  // The films, a list named after the shared List.
  list(title: string) {
    return this.page.getByRole("list", { name: title });
  }

  items(title: string) {
    return this.list(title).getByRole("listitem");
  }

  // Any text on the page: what it shows, or must not, such as the owner's Review.
  text(content: string) {
    return this.page.getByText(content);
  }
}
