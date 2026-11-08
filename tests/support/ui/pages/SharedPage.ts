import { ScopedComponent } from "../components/ScopedComponent";
import { BasePage } from "./BasePage";

// One film on a Share Link's page: its poster, title, year and Note.
class SharedFilm extends ScopedComponent {
  // A Note longer than three lines is cut there, and is a button: More opens it, Less cuts it.
  readonly moreButton = this.root.getByRole("button", { expanded: false });
  readonly lessButton = this.root.getByRole("button", { expanded: true });
  readonly buttons = this.root.getByRole("button");
  readonly links = this.root.getByRole("link");

  note(content: string) {
    return this.root.getByText(content);
  }
}

// What a Share Link opens, for anyone who has it: the List's name, description, owner and films
// with their Notes, as a grid of posters.
export class SharedPage extends BasePage<[token: string]> {
  path(token: string) {
    return `/s/${token}`;
  }

  // What a revoked, replaced or unknown link shows alike.
  readonly notSharedHeading = this.page.getByRole("heading", {
    name: "This Collection isn't shared any more",
  });
  // For a visitor without an account, under the films or the not-shared message.
  readonly inviteLine = this.page.getByText(
    "Want your own? Ask someone on TasteTrack for an invite.",
  );

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

  film(listTitle: string, filmTitle: string) {
    const titled = this.page.getByText(filmTitle, { exact: true });
    return new SharedFilm(this.items(listTitle).filter({ has: titled }));
  }

  // Any text on the page: what it shows, or must not, such as the owner's Review.
  text(content: string) {
    return this.page.getByText(content);
  }
}
