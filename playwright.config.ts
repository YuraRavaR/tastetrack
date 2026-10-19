import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

// Set BASE_URL to test a deployed environment, such as staging, instead of local Wrangler.
const deployedURL = process.env.BASE_URL;

const hooksOnURL = deployedURL ?? "http://localhost:8787";
const hooksOffURL = "http://localhost:8788";

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
  reporter: process.env.CI
    ? [["list"], ["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
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
    // The top-level Wrangler config, which is what a deploy without `--env` ships. It only
    // runs locally: every deployed environment we test has hooks on.
    ...(deployedURL
      ? []
      : [
          {
            name: "api-hooks-off",
            testDir: "tests/api",
            testMatch: "**/*.hooks-off.spec.ts",
            use: { baseURL: hooksOffURL },
          },
        ]),
    {
      name: "e2e",
      testDir: "tests/e2e",
      use: { ...devices["Desktop Chrome"], baseURL: hooksOnURL },
    },
  ],
  webServer: deployedURL ? undefined : localWebServers,
});
