import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

// Set BASE_URL to test a deployed environment instead of local Wrangler: staging with the
// `api` and `e2e` projects, production with `smoke`.
const deployedURL = process.env.BASE_URL;

const hooksOnURL = deployedURL ?? "http://localhost:8787";
const hooksOffURL = deployedURL ?? "http://localhost:8788";

// Web servers start in order, so the second reuses the first one's build. It keeps its own
// local D1 state: two `wrangler dev` processes can't share one.
const localWebServers: PlaywrightTestConfig["webServer"] = [
  {
    command:
      "pnpm build && pnpm db:migrate:local && " +
      "wrangler dev --env local --port 8787 --inspector-port 9230 --show-interactive-dev-session=false",
    url: `${hooksOnURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  {
    command:
      "wrangler d1 migrations apply DB --local --persist-to .wrangler/state-hooks-off && " +
      "wrangler dev --port 8788 --inspector-port 9231 --persist-to .wrangler/state-hooks-off " +
      "--show-interactive-dev-session=false",
    url: `${hooksOffURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
];

export default defineConfig({
  forbidOnly: !!process.env.CI,
  // At most one retry. A test that passes only on retry is reported as flaky.
  retries: 1,
  reporter: [
    ["list"],
    ...(process.env.CI ? [["github"] as const] : []),
    ["html", { open: "never" }],
  ],
  use: {
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "api",
      testDir: "tests/api",
      use: { baseURL: hooksOnURL },
    },
    // Test hooks off. Locally this is the top-level Wrangler config, which is what production
    // deploys, so the production smoke test passes on every PR before it runs after a release.
    {
      name: "smoke",
      testDir: "tests/smoke",
      use: { baseURL: hooksOffURL },
    },
    // The Operator CLI against the local D1 of the hooks-on Worker, so local only.
    {
      name: "cli",
      testDir: "tests/cli",
      use: { baseURL: "http://localhost:8787" },
    },
    {
      name: "e2e",
      testDir: "tests/e2e",
      use: { ...devices["Desktop Chrome"], baseURL: hooksOnURL },
    },
  ],
  webServer: deployedURL ? undefined : localWebServers,
});
