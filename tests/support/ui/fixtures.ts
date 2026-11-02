import { ApiClient } from "../api/ApiClient";
import { test as base, expect } from "../fixtures";
import { Ui } from "./Ui";

interface UiFixtures {
  ui: Ui;
}

// The fixtures of end-to-end tests: those of the API tests, plus `ui`, the test's browser tab.
// `api` shares the page's session here, so `loggedInUser` is logged in in the browser too.
// API tests import ../fixtures instead, so they never start a browser.
export const test = base.extend<UiFixtures>({
  api: async ({ page }, use) => {
    await use(new ApiClient(page.request));
  },
  ui: async ({ page }, use) => {
    await use(new Ui(page));
  },
});

export { expect };
