import { ScopedComponent } from "./ScopedComponent";

// One series the User is watching, on Saved under "Watching now" and on the Watching tab: a link
// to its page with what comes next and the bar, and beside it the check that marks the next
// episode watched, or Finished once the User is caught up.
export class WatchingRow extends ScopedComponent {
  // Its title, then "Next: S2 · E9", or "Caught up" with the next episode's day when TMDB gives it.
  readonly link = this.root.getByRole("link");
  // Named with its count, such as "15 of 62 episodes watched".
  readonly bar = this.root.getByRole("img", { name: /episodes watched$/ });
  readonly checkButton = this.root.getByRole("button", {
    name: /^Mark S\d+ · E\d+ of .+ watched$/,
  });
  readonly finishedButton = this.root.getByRole("button", { name: /^Finished / });
}
