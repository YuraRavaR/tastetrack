import type { Page } from "@playwright/test";
import { ApiClient } from "../api/ApiClient";
import { test as base, expect } from "../fixtures";
import { callsRealMusicBrainz } from "../scenarios/albums";
import { MusicBrainzInBrowser } from "./musicbrainz";
import { Ui } from "./Ui";

interface UiFixtures {
  musicBrainz: MusicBrainzInBrowser;
  ui: Ui;
  loggedInUi: Ui;
  visitorPage: Page;
  visitorUi: Ui;
}

// The fixtures of end-to-end tests: those of the API tests, plus `ui`, the test's browser tab.
// `api` shares the page's session here, so `loggedInUser` is logged in in the browser too.
// `loggedInUi` is that `ui`, for a test that needs the session but not the User. `visitorPage` is
// someone with no session, in a browser of their own, such as the holder of a Share Link, and
// `visitorUi` its pages. `musicBrainz` sends every test browser's calls to MusicBrainz and the Cover
// Art Archive to the Worker's fakes, where the Worker calls them too, and lets a test make
// MusicBrainz busy.
// API tests import ../fixtures instead, so they never start a browser.
export const test = base.extend<UiFixtures>({
  musicBrainz: [
    async ({ context, baseURL }, use) => {
      const musicBrainz = new MusicBrainzInBrowser(baseURL ?? "");
      if (!callsRealMusicBrainz()) await musicBrainz.route(context);
      await use(musicBrainz);
    },
    { auto: true },
  ],
  api: async ({ page }, use) => {
    await use(new ApiClient(page.request));
  },
  ui: async ({ page }, use) => {
    await use(new Ui(page));
  },
  loggedInUi: async ({ ui, loggedInUser: _loggedInUser }, use) => {
    await use(ui);
  },
  visitorPage: async ({ browser }, use) => {
    const visitor = await browser.newContext();
    await use(await visitor.newPage());
    await visitor.close();
  },
  visitorUi: async ({ visitorPage }, use) => {
    await use(new Ui(visitorPage));
  },
});

export { expect };
