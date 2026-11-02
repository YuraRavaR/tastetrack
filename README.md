# TasteTrack

A personal tracker for taste in media. See [GLOSSARY.md](GLOSSARY.md) for the domain language and [docs/adr/](docs/adr/) for the decisions.

## Getting started

```sh
nvm use                 # Node version from .nvmrc
corepack enable         # pnpm version from package.json
pnpm install
pnpm exec playwright install chromium
git config core.hooksPath .githooks   # branch and commit-message hooks
pnpm dev                # builds the app, migrates local D1, serves on http://localhost:8787
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Build the React app and serve it and the API from one local Worker |
| `pnpm lint` | Biome: lint, formatting and import order (`pnpm lint:fix` applies fixes) |
| `pnpm typecheck` | Type-check the Worker, the client, the tests and `scripts/` |
| `pnpm test:unit` | Vitest: the domain core and the message catalogue |
| `pnpm test:api` | Playwright API tests against local Wrangler, with test hooks on and off, and the Operator CLI tests |
| `pnpm test:e2e` | Playwright browser tests against local Wrangler, and the `@smoke` ones on an iPhone in WebKit |
| `pnpm test:smoke` | The production smoke test: against local Wrangler with hooks off, or `BASE_URL` |
| `pnpm test:deployed` | The `@smoke` API and E2E tests against `BASE_URL`, e.g. staging, with `TEST_HOOKS_SECRET` |
| `pnpm test:report <run-id>` | Download a staging run's encrypted Playwright report, decrypt it and open it |
| `pnpm test` | All of the local test suites |
| `pnpm db:generate --name <name>` | Generate a migration from `src/db/schema.ts` (never edit an applied one) |
| `pnpm db:migrate:local` | Apply migrations to the local D1 |
| `pnpm cf-typegen` | Regenerate `worker-configuration.d.ts` after changing `wrangler.jsonc` |
| `pnpm operator create-user --env <env>` | Operator CLI: create a User in `local`, `staging` or `production` (see below) |
| `pnpm operator reset-password --env <env>` | Operator CLI: give a User who forgot their password a Temporary Password (see below) |

The API serves its OpenAPI spec at `/api/openapi.json`.

## Operator CLI

The Operator acts on a deployment only through `scripts/operator.ts`, which runs `wrangler d1 execute` against the chosen environment's D1. To create the first User of an environment:

```sh
pnpm operator create-user --env local       # the local D1 that `pnpm dev` serves
pnpm operator create-user --env staging     # needs Wrangler logged in to the Cloudflare account
pnpm operator create-user --env production
```

It prompts for the Username and the password (twice, not echoed), hashes the password on your machine and sends only the hash, so no credentials end up in the repo or the shell history.

When a User forgets their password, reset it:

```sh
pnpm operator reset-password --env production
```

It prompts for the Username, ends every session of theirs and prints a random Temporary Password once. Hand it to the User privately. When they log in with it, their session can only set a new password of their own (`POST /api/me/new-password`), which must differ from the Temporary Password; every other API call gets a 403 `password_change_required`, and the app takes them straight to the set-new-password screen. The Operator never chooses or learns the User's real password.

## Sessions

Logging in sets an HttpOnly `session` cookie (`Secure` over HTTPS, `SameSite=Lax`). The database keeps only the SHA-256 of the session token. A session is valid for 30 days from the User's last authenticated request, and logging out deletes it on the server.

## TMDB

Film search calls TMDB (ADR-0004) at `TMDB_BASE_URL`, set per env in `wrangler.jsonc`, with the secret `TMDB_ACCESS_TOKEN`: TMDB's "API Read Access Token" (Settings → API), sent as a bearer token. Staging and production use the real TMDB, so each needs the secret once:

```sh
pnpm exec wrangler secret put TMDB_ACCESS_TOKEN --env staging
pnpm exec wrangler secret put TMDB_ACCESS_TOKEN               # production
```

The `local` env searches a TMDB fake with fixed data (`src/worker/catalog/tmdb-fake.ts`), mounted among the test hooks at `/api/test/tmdb`, with a placeholder token, so local development, the tests and CI need no TMDB account. To search the real TMDB locally, set `TMDB_BASE_URL` and `TMDB_ACCESS_TOKEN` in `.dev.vars` (see `.dev.vars.example`). The API tests pass against both: they look only for well-known films that the fake mirrors.

## Test hooks

`TEST_HOOKS=1` turns on test-only surfaces, which stay out of the OpenAPI spec and are a JSON 404 or ignored with hooks off. Staging is public, so all but the first answer only a request whose `X-Test-Hooks-Secret` header matches the `TEST_HOOKS_SECRET` secret; without it they behave as with hooks off (ADR-0010):

- the `X-D1-Query-Count` response header, which needs no secret;
- the `X-Test-Now` request header, an ISO time the Worker treats as now, so tests can step past session expiry;
- the routes under `/api/test/`, including `POST /api/test/users`, which creates a seed User without an Invite Code, `POST /api/test/users/:username/backlog` and `POST /api/test/lists/:listId/items`, which fill a User's Backlog or a List with placeholder films so tests reach the 1,000-item limit, read-outs of what the API never reports, such as a User's password iterations and who invited them, `DELETE /api/test/tmdb-cache/film/:id`, which takes one film out of the TMDB cache so tests can load a page on a cold cache, and the TMDB fake, which the `local` Worker calls without the secret and which only a Worker with `TMDB_BASE_URL` pointing at it serves.

Test seed Users therefore exist only in local and staging. The factories in `tests/support/scenarios/users.ts` give each Playwright worker one seed User, which issues an Invite Code for every other test User; those register through the public API like real ones, each with a unique Username, so tests share no mutable fixtures.

The top level of `wrangler.jsonc` is production and leaves it unset, so a deploy without `--env` never ships test hooks. Only the `local` and `staging` envs turn it on, and `pnpm dev` runs `--env local`. Override it locally in a git-ignored `.dev.vars` (see `.dev.vars.example`).

Local runs need no setup: the `local` env and the tests share a placeholder secret. To run the deployed tests from your machine:

```sh
BASE_URL=<staging URL> \
TEST_HOOKS_SECRET=$(security find-generic-password -s tastetrack-test-hooks-secret -w) \
pnpm test:deployed
```

The Keychain item is the only readable copy, since GitHub and Cloudflare don't show a secret again. If it's lost, or to rotate the secret, make a new one and set it in all three places:

```sh
secret=$(openssl rand -hex 32)
printf %s "$secret" | pnpm exec wrangler secret put TEST_HOOKS_SECRET --env staging
printf %s "$secret" | gh secret set TEST_HOOKS_SECRET --env staging
security add-generic-password -U -a "$USER" -s tastetrack-test-hooks-secret -w "$secret"
```

Traces from such a run hold the secret, so don't share `test-results/` or `playwright-report/`.

The `cli` Playwright project runs the Operator CLI against local D1 only, so `pnpm test:deployed` leaves it out, and so does the `mobile` project, which runs the `@smoke` E2E tests on an iPhone in WebKit. The `smoke` Playwright project runs against the top-level config locally, and against production after every deploy, to prove the hooks stay off there.

## CI, staging and production

Commit messages and PR titles follow [Conventional Commits](https://www.conventionalcommits.org/), checked by commitlint in the `commit-msg` hook and in CI. They drive the version and the changelog.

- **Every PR** ([ci.yml](.github/workflows/ci.yml), [pr-title.yml](.github/workflows/pr-title.yml)): commitlint over the PR's commits and title, then lint, type checks, unit tests, and the API, smoke and E2E tests against local Wrangler.
- **Every merge to `main`** ([staging.yml](.github/workflows/staging.yml)): applies D1 migrations to the staging database, deploys the Worker with `--env staging` (test hooks on), then runs `pnpm test:deployed` against the deployed URL: only the tests tagged `@smoke`, since staging and production share one D1 write budget (ADR-0006). The full suite runs in CI against local D1.
- **Every merge to `main`** ([release.yml](.github/workflows/release.yml)): release-please updates the release PR. Merging that PR tags a release, which deploys to production after manual approval ([production.yml](.github/workflows/production.yml)), then runs the smoke test against it. See [docs/production.md](docs/production.md), including the D1 export the Operator takes before approving.
- **Weekly** ([dependabot.yml](.github/dependabot.yml)): Dependabot opens PRs for npm and GitHub Actions updates, grouping minor and patch bumps.

Playwright keeps traces of failed attempts, including tests that passed only on retry. Every workflow uploads them with the HTML report as a `playwright-*` artifact. This repo's artifacts are public and staging's traces record the test hooks secret and test Users' logins, so staging's artifact is encrypted (ADR-0010). Read one with `pnpm test:report <run-id>`, the id being in the run's URL. It finds the key in `STAGING_REPORT_KEY` or, on macOS, in the Keychain. To make a new key, for reports from then on:

```sh
key=$(openssl rand -hex 32)
printf %s "$key" | gh secret set STAGING_REPORT_KEY --env staging
security add-generic-password -U -a "$USER" -s tastetrack-staging-report -w "$key"
```

The staging jobs need the `CLOUDFLARE_API_TOKEN` (limited to this account's Workers and D1) and `CLOUDFLARE_ACCOUNT_ID` secrets, on the `staging` environment or the repo, the `TEST_HOOKS_SECRET` and `STAGING_REPORT_KEY` secrets on the `staging` environment, and the staging D1's `database_id` in `wrangler.jsonc`. The staging deploy doesn't wait for CI, so make the CI checks required on `main` to keep a red PR from merging.
