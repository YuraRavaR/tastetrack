import { test as base, expect as baseExpect } from "../fixtures";
import type { BasePage } from "./pages/BasePage";
import { Ui } from "./Ui";

interface UiFixtures {
  ui: Ui;
}

// The fixtures of end-to-end tests: those of the API tests, plus `ui`, the test's browser tab.
// API tests import ../fixtures instead, so they never start a browser.
export const test = base.extend<UiFixtures>({
  ui: async ({ page }, use) => {
    await use(new Ui(page));
  },
});

export const expect = baseExpect.extend({
  // The tab shows this page: its URL is the page's path, as `toHaveURL` checks and retries it.
  async toBeOpen(received: BasePage, options?: { timeout?: number }) {
    const assertionName = "toBeOpen";
    let pass: boolean;
    let actual: unknown;
    try {
      const tab = this.isNot ? baseExpect(received.page).not : baseExpect(received.page);
      await tab.toHaveURL(received.path, options);
      pass = true;
    } catch (error) {
      actual = (error as { matcherResult?: { actual?: unknown } }).matcherResult?.actual;
      pass = false;
    }
    if (this.isNot) pass = !pass;

    const page = received.constructor.name;
    const message = () => {
      const hint = this.utils.matcherHint(assertionName, undefined, undefined, {
        isNot: this.isNot,
      });
      const expected = `Expected: ${this.isNot ? "not " : ""}${page} at ${received.path}`;
      return `${hint}\n\n${expected}\nReceived: ${this.utils.printReceived(actual)}`;
    };
    return { message, pass, name: assertionName, expected: received.path, actual };
  },
});
