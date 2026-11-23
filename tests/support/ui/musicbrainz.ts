import { randomUUID } from "node:crypto";
import type { BrowserContext, Route } from "@playwright/test";

// The browser searches songs on MusicBrainz itself and shows covers from the Cover Art Archive
// (ADR-0013). Locally a test's browser is sent to the Worker's fakes of both instead, through
// `context.route`, so it sees the same fixed data as the Worker; on staging, the real ones. Each
// test browser is rate-limited on its own by the fake, as each User's IP is by MusicBrainz.
export class MusicBrainzInBrowser {
  private readonly browserId = randomUUID();
  private busyPath = "";

  constructor(private readonly workerURL: string) {}

  // Sends the context's calls to MusicBrainz and the Cover Art Archive to the fakes.
  async route(context: BrowserContext) {
    await context.route("https://musicbrainz.org/ws/2/**", (route) =>
      this.forward(route, (url) => {
        const path = `${this.browserId}/${this.busyPath}ws/2${url.pathname.slice("/ws/2".length)}`;
        return `/api/test/musicbrainz/browser/${path}${url.search}`;
      }),
    );
    await context.route("https://coverartarchive.org/**", (route) =>
      this.forward(route, (url) => `/api/test/coverartarchive${url.pathname}`),
    );
  }

  // From now on, the first `times` of the browser's calls to MusicBrainz answer 503, as
  // MusicBrainz does when it is busy; the calls after them don't.
  busy(times: 1 | 2) {
    this.busyPath = `busy/${times}/${randomUUID()}/`;
  }

  // The fake answers as MusicBrainz does, but for the header that lets a page read it.
  private async forward(route: Route, pathOf: (url: URL) => string) {
    const target = new URL(pathOf(new URL(route.request().url())), this.workerURL);
    try {
      const response = await route.fetch({ url: target.toString() });
      await route.fulfill({
        response,
        headers: { ...response.headers(), "access-control-allow-origin": "*" },
      });
    } catch {
      // The test ended while its call was under way.
    }
  }
}
