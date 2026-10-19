import { defineConfig, devices } from "@playwright/test";

const hooksOnURL = "http://localhost:8787";
const hooksOffURL = "http://localhost:8788";

export default defineConfig({
  forbidOnly: !!process.env.CI,
  // At most one retry. A test that passes only on retry is reported as flaky.
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "api",
      testDir: "tests/api",
      testIgnore: "**/*.hooks-off.spec.ts",
      use: { baseURL: hooksOnURL },
    },
    {
      // The same Worker with test hooks off, as in production.
      name: "api-hooks-off",
      testDir: "tests/api",
      testMatch: "**/*.hooks-off.spec.ts",
      use: { baseURL: hooksOffURL },
    },
    {
      name: "e2e",
      testDir: "tests/e2e",
      use: { ...devices["Desktop Chrome"], baseURL: hooksOnURL },
    },
  ],
  // Web servers start in order, so the second reuses the first one's build. It keeps its own
  // local D1 state: two `wrangler dev` processes can't share one.
  webServer: [
    {
      command:
        "pnpm build && pnpm db:migrate:local && wrangler dev --port 8787 --inspector-port 9230 --show-interactive-dev-session=false",
      url: `${hooksOnURL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command:
        "wrangler d1 migrations apply DB --local --persist-to .wrangler/state-hooks-off && " +
        "wrangler dev --port 8788 --inspector-port 9231 --persist-to .wrangler/state-hooks-off " +
        "--var TEST_HOOKS:0 --show-interactive-dev-session=false",
      url: `${hooksOffURL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
