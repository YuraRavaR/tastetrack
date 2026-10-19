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
| `pnpm test:e2e` | Playwright browser tests against local Wrangler |
| `pnpm test:smoke` | The production smoke test: against local Wrangler with hooks off, or `BASE_URL` |
| `pnpm test:deployed` | Playwright API and E2E tests against `BASE_URL`, e.g. staging |
| `pnpm test` | All of the local test suites |
| `pnpm db:generate --name <name>` | Generate a migration from `src/db/schema.ts` (never edit an applied one) |
| `pnpm db:migrate:local` | Apply migrations to the local D1 |
| `pnpm cf-typegen` | Regenerate `worker-configuration.d.ts` after changing `wrangler.jsonc` |
| `pnpm operator create-user --env <env>` | Operator CLI: create a User in `local`, `staging` or `production` (see below) |

The API serves its OpenAPI spec at `/api/openapi.json`.

## Operator CLI

The Operator acts on a deployment only through `scripts/operator.ts`, which runs `wrangler d1 execute` against the chosen environment's D1. To create the first User of an environment:

```sh
pnpm operator create-user --env local       # the local D1 that `pnpm dev` serves
pnpm operator create-user --env staging     # needs Wrangler logged in to the Cloudflare account
pnpm operator create-user --env production
```

It prompts for the Username and the password (twice, not echoed), hashes the password on your machine and sends only the hash, so no credentials end up in the repo or the shell history.

## Sessions

Logging in sets an HttpOnly `session` cookie (`Secure` over HTTPS, `SameSite=Lax`). The database keeps only the SHA-256 of the session token. A session is valid for 30 days from the User's last authenticated request, and logging out deletes it on the server.

## Test hooks

`TEST_HOOKS=1` turns on test-only surfaces, which stay out of the OpenAPI spec and are a JSON 404 or ignored with hooks off:

- the `X-D1-Query-Count` response header;
- the `X-Test-Now` request header, an ISO time the Worker treats as now, so tests can step past session expiry;
- the routes under `/api/test/`, including `POST /api/test/users`, which creates a seed User without an Invite Code, and read-outs of what the API never reports, such as a User's password iterations and who invited them.

Test seed Users therefore exist only in local and staging. The factories in `tests/support/users.ts` give each Playwright worker one seed User, which issues an Invite Code for every other test User; those register through the public API like real ones, each with a unique Username, so tests share no mutable fixtures.

The top level of `wrangler.jsonc` is production and leaves it unset, so a deploy without `--env` never ships test hooks. Only the `local` and `staging` envs turn it on, and `pnpm dev` runs `--env local`. Override it locally in a git-ignored `.dev.vars` (see `.dev.vars.example`).

The `cli` Playwright project runs the Operator CLI against local D1 only, so `pnpm test:deployed` leaves it out. The `smoke` Playwright project runs against the top-level config locally, and against production after every deploy, to prove the hooks stay off there.

### PBKDF2 spike

`GET /api/test/pbkdf2?iterations=N` runs one simulated login with N PBKDF2-SHA256 iterations. Local Wrangler doesn't enforce CPU limits, so the iteration target in ADR-0007 is measured on staging: with Wrangler logged in to the staging account, `node scripts/pbkdf2-spike.ts <staging-url> [iterations ...]` tails the staging Worker and prints the CPU time per iteration count.

## CI, staging and production

Commit messages and PR titles follow [Conventional Commits](https://www.conventionalcommits.org/), checked by commitlint in the `commit-msg` hook and in CI. They drive the version and the changelog.

- **Every PR** ([ci.yml](.github/workflows/ci.yml), [pr-title.yml](.github/workflows/pr-title.yml)): commitlint over the PR's commits and title, then lint, type checks, unit tests, and the API, smoke and E2E tests against local Wrangler.
- **Every merge to `main`** ([staging.yml](.github/workflows/staging.yml)): applies D1 migrations to the staging database, deploys the Worker with `--env staging` (test hooks on), then runs `pnpm test:deployed` against the deployed URL.
- **Every merge to `main`** ([release.yml](.github/workflows/release.yml)): release-please updates the release PR. Merging that PR tags a release, which deploys to production after manual approval ([production.yml](.github/workflows/production.yml)), then runs the smoke test against it. See [docs/production.md](docs/production.md), including the D1 export the Operator takes before approving.
- **Weekly** ([dependabot.yml](.github/dependabot.yml)): Dependabot opens PRs for npm and GitHub Actions updates, grouping minor and patch bumps.

Playwright keeps traces of failed attempts, including tests that passed only on retry. Both workflows upload them with the HTML report as a `playwright-*` artifact.

The staging job needs the `CLOUDFLARE_API_TOKEN` (limited to this account's Workers and D1) and `CLOUDFLARE_ACCOUNT_ID` secrets, on the `staging` environment or the repo, and the staging D1's `database_id` in `wrangler.jsonc`. The staging deploy doesn't wait for CI, so make the CI checks required on `main` to keep a red PR from merging.
