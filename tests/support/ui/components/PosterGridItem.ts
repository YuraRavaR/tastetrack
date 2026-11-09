import { ScopedComponent } from "./ScopedComponent";

// One film in a grid of posters: its poster, title and a meta line, such as the year or the
// Current Rating, all one link to the film's page.
export class PosterGridItem extends ScopedComponent {
  readonly link = this.root.getByRole("link");
  // The poster's image has no name, so it is found by tag.
  readonly posterImage = this.root.locator("img");
  readonly watchedBeforeMark = this.root.getByRole("img", { name: "Watched before" });

  // The Current Rating under a Watched poster, read out as e.g. "4.5 stars".
  rating(stars: string) {
    return this.root.getByRole("img", { name: stars, exact: true });
  }
}
