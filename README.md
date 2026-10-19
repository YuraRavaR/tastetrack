# TasteTrack

A personal tracker for taste in media. See [GLOSSARY.md](GLOSSARY.md) for the domain language and [docs/adr/](docs/adr/) for the decisions.

## Getting started

```sh
nvm use                 # Node version from .nvmrc
corepack enable         # pnpm version from package.json
pnpm install
pnpm exec playwright install chromium
pnpm dev                # builds the app, migrates local D1, serves on http://localhost:8787
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Build the React app and serve it and the API from one local Worker |
| `pnpm typecheck` | Type-check the Worker, the client and the tests |
| `pnpm test:unit` | Vitest: the domain core and the message catalogue |
| `pnpm test:api` | Playwright API tests against local Wrangler, with test hooks on and off |
| `pnpm test:e2e` | Playwright browser tests against local Wrangler |
| `pnpm test` | All of the above test suites |
| `pnpm db:generate --name <name>` | Generate a migration from `src/db/schema.ts` (never edit an applied one) |
| `pnpm db:migrate:local` | Apply migrations to the local D1 |
| `pnpm cf-typegen` | Regenerate `worker-configuration.d.ts` after changing `wrangler.jsonc` |

The API serves its OpenAPI spec at `/api/openapi.json`.

## Test hooks

`TEST_HOOKS=1` turns on test-only surfaces, such as the `X-D1-Query-Count` response header. The top level of `wrangler.jsonc` leaves it unset, so a deploy without `--env` never ships test hooks. Only the `local` and `staging` envs turn it on, and `pnpm dev` runs `--env local`. Override it locally in a git-ignored `.dev.vars` (see `.dev.vars.example`).

The `api-hooks-off` Playwright project runs against the top-level config to prove the hooks stay off there.
