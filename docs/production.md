# Production releases

Production is the top level of `wrangler.jsonc`: the `tastetrack` Worker and the `tastetrack-production` D1, with no test hooks. Only the release pipeline deploys it.

## How a release happens

1. Every merge to `main` runs [release.yml](../.github/workflows/release.yml). release-please keeps one release PR open, with the next version and the `CHANGELOG.md` entries worked out from the Conventional Commits since the last release: `fix` bumps the patch, `feat` the minor, a breaking change the major (the minor while the version is 0.x).
2. Merging the release PR tags the release (`vX.Y.Z`) and creates a GitHub release. release.yml then calls [production.yml](../.github/workflows/production.yml) with the tag.
3. The deploy job waits for a reviewer's approval on the `production` environment. **Take the D1 export below before approving.**
4. After approval it applies D1 migrations to the production database, then deploys the Worker.
5. A smoke test runs against the deployed URL: health is ok, the seed User route is a 404, and no response carries the `X-D1-Query-Count` header. A failing smoke test fails the workflow.

The same smoke test (`pnpm test:smoke`) runs on every PR against a local Worker with the top-level config, so it is known to pass before a release.

## Before every production migration: the D1 export

Every production deploy applies whatever migrations are pending, so the Operator takes an export before approving any production deploy. Run it from a clone with Wrangler logged in to the Cloudflare account:

```sh
mkdir -p ~/tastetrack-backups
pnpm exec wrangler d1 time-travel info tastetrack-production
pnpm exec wrangler d1 export tastetrack-production --remote \
  --output ~/tastetrack-backups/tastetrack-production-$(date -u +%Y%m%dT%H%M%SZ).sql
```

- Keep the export **outside the repo and out of CI**: it holds Users' data. Don't write it inside the clone, commit it, or upload it as a workflow artifact.
- Note the bookmark that `time-travel info` prints: it is the exact point to restore to if the migration goes wrong.
- The database doesn't serve requests while the export runs, so expect a short pause at the current data size.

Encrypted automated backups in CI are planned for later (ADR-0009).

## Recovery

**D1 Time Travel is the main line of recovery.** It is always on and restores the production database to any minute within the retention window (7 days on the Workers Free plan):

```sh
pnpm exec wrangler d1 time-travel restore tastetrack-production --bookmark <bookmark>
pnpm exec wrangler d1 time-travel restore tastetrack-production --timestamp 2026-10-19T12:00:00Z
```

A restore overwrites the database in place and prints a bookmark that undoes the restore.

The manual export is the fallback for when Time Travel can't help, for example when the problem is noticed after the retention window. Import it into a fresh database with `wrangler d1 execute <database> --remote --file <export>.sql`.

**Rolling back code**: run the Production workflow by hand (Actions → Production → Run workflow, from `main`) with the previous release tag. It needs approval like any deploy. Migrations are forward-only and expand/contract (ADR-0009), so the previous release still works against the migrated database; don't restore the database just to roll back code.

## One-time setup

- **Production D1**: `pnpm exec wrangler d1 create tastetrack-production`, then put its `database_id` at the top level of `wrangler.jsonc`. The deploy job refuses to run while the placeholder id is there.
- **`production` GitHub environment** (Settings → Environments): required reviewers, so every deploy waits for approval, and deployment branches limited to `main`.
- **Cloudflare secrets**: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, on the repo (shared with staging) or on the `production` environment. Production-only secrets go on the environment.
- **`RELEASE_PLEASE_TOKEN`** repo secret: a fine-grained personal access token for this repo with read and write access to contents and pull requests. Required checks never run on a PR opened with the default `GITHUB_TOKEN`, so without this token the release PR can't be merged until someone closes and reopens it. Without the token, also allow GitHub Actions to create pull requests (Settings → Actions → General).
