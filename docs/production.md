# Production releases

Production is the top level of `wrangler.jsonc`: the `tastetrack` Worker and the `tastetrack-production` D1, with no test hooks. Only the release pipeline deploys it.

## How a release happens

1. Every merge to `main` runs [release.yml](../.github/workflows/release.yml). release-please keeps one release PR open, with the next version and the `CHANGELOG.md` entries worked out from the Conventional Commits since the last release: `fix` bumps the patch, `feat` the minor, a breaking change the major (the minor while the version is 0.x).
2. Merging the release PR tags the release (`vX.Y.Z`) and creates a GitHub release. release.yml then calls [production.yml](../.github/workflows/production.yml) with the tag.
3. The deploy job waits for a reviewer's approval on the `production` environment.
4. After approval it backs up the production database (below), applies D1 migrations to it, then deploys the Worker.
5. A smoke test runs against the deployed URL: health is ok, the seed User route is a 404, and no response carries the `X-D1-Query-Count` header. A failing smoke test fails the workflow.

The same smoke test (`pnpm test:smoke`) runs on every PR against a local Worker with the top-level config, so it is known to pass before a release.

## Before every migration: the D1 backup

Every deploy, staging and production, backs up its database right before applying migrations, and stops before them if the backup fails:

- The log shows the D1 Time Travel bookmark from just before the migrations, the exact point to restore to if they go wrong.
- `pnpm backup take` exports the database and encrypts the export with [age](https://age-encryption.org) to the Operator's public key, the repo variable `D1_BACKUP_RECIPIENT`. The export in the clear exists only in a temporary directory on the runner, deleted once it is encrypted.
- The encrypted file is uploaded as the run's `d1-backup-staging` or `d1-backup-production` artifact and kept 90 days. This repo's artifacts are public, which is why nothing else goes up: only the Operator's private key opens it.
- The database doesn't serve requests while it is exported, schema then rows, so expect two short pauses at the current data size.

To look at a backup, or to get data back from one, restore it into a local D1:

```sh
pnpm backup open <run-id>    # the id is in the run's URL
```

It downloads the run's backup, decrypts it with the private key in `~/tastetrack-backup.key` (or the file `D1_BACKUP_IDENTITY` names), imports it into a new local D1 in `~/tastetrack-backups/<run-id>` and prints the rows of each table. Query it with `pnpm exec wrangler d1 execute DB --local --persist-to ~/tastetrack-backups/<run-id> --command "..."`. A backup downloaded by hand restores with `pnpm backup restore <file.sql.age> --to <directory>`, and decrypts with the age CLI too: `age -d -i ~/tastetrack-backup.key <file.sql.age>`.

Restored databases hold Users' data: keep them outside the repo, as `open` does.

## Every week: the scheduled backup

Releases can be weeks apart, longer than Time Travel's 7 days, so [backup.yml](../.github/workflows/backup.yml) also backs up the production database every Sunday at 01:17 UTC (03:17 in Kyiv in winter, 04:17 in summer). It runs the deploy's backup step, so its `d1-backup-production` artifact is the same encrypted file, kept 90 days, and opens the same way: `pnpm backup open <run-id>`. It only reads the database: no migrations, no deploy.

- Nobody approves it: it runs in the `production-backup` environment, which has no required reviewers (below).
- It doesn't share the deploys' concurrency group, where a newly queued run cancels the pending one: a backup could then cancel a release deploy. So a deploy approved in the few seconds of a night-time export could migrate between its schema and its rows, and that backup wouldn't restore. The next week's would.
- For one more backup at any time: Actions → Production backup → Run workflow, from `main`.
- A failed run fails the workflow, and GitHub emails whoever last changed the workflow's schedule (Settings → Notifications → Actions, if it doesn't). GitHub turns scheduled workflows off after 60 days without activity in the repo, and emails a warning first; turn it back on under Actions → Production backup.

## Recovery

**D1 Time Travel is the main line of recovery.** It is always on and restores the production database to any minute within the retention window (7 days on the Workers Free plan):

```sh
pnpm exec wrangler d1 time-travel restore tastetrack-production --bookmark <bookmark>
pnpm exec wrangler d1 time-travel restore tastetrack-production --timestamp 2026-10-19T12:00:00Z
```

A restore overwrites the database in place and prints a bookmark that undoes the restore.

A backup, a deploy's or the weekly one, is the fallback for when Time Travel can't help, for example when the problem is noticed after the retention window. Restore it locally with `pnpm backup open <run-id>` to take what you need from it. To restore a whole database from it, decrypt it to a file outside the repo and import it into a fresh database with `wrangler d1 execute <database> --remote --file <export>.sql`.

**Rolling back code**: run the Production workflow by hand (Actions → Production → Run workflow, from `main`) with the previous release tag. It needs approval like any deploy. Migrations are forward-only and expand/contract (ADR-0009), so the previous release still works against the migrated database; don't restore the database just to roll back code.

## One-time setup

- **Production D1**: `pnpm exec wrangler d1 create tastetrack-production`, then put its `database_id` at the top level of `wrangler.jsonc`. The deploy job refuses to run while the placeholder id is there.
- **`production` GitHub environment** (Settings → Environments): required reviewers, so every deploy waits for approval, and deployment branches limited to `main`.
- **`production-backup` GitHub environment**, for the weekly backup: no required reviewers, deployment branches limited to `main`, so a run can't wait for approval but runs only `main`'s code. Create it before the first scheduled run: a workflow that names an environment that doesn't exist creates it with no branch limit. Its Cloudflare secrets come from the repo, like staging's; the branch limit guards them only once they live on the environments instead.
- **Cloudflare secrets**: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, on the repo (shared with staging and the weekly backup) or on the `production` environment. Production-only secrets go on the environment; then put them on `production-backup` too.
- **Backup key pair**: generate it once with `age-keygen -o ~/tastetrack-backup.key` (`brew install age`), keep a second copy of that file in a password manager, and set the public key it prints as a repo variable: `gh variable set D1_BACKUP_RECIPIENT --body "$(age-keygen -y ~/tastetrack-backup.key)"`. Without the variable every deploy stops before migrating. The private key is the only way into any backup, so a lost key means unreadable backups: to replace it, make a new pair and set the variable again; backups from then on use the new key.
- **Worker secrets**, set with `wrangler secret put` as the README says: `TMDB_ACCESS_TOKEN` for film search and `OPEN_LIBRARY_CONTACT` for book search. Without the contact, book search answers that the catalog is unavailable.
- **`RELEASE_PLEASE_TOKEN`** repo secret: a fine-grained personal access token for this repo with read and write access to contents and pull requests. Required checks never run on a PR opened with the default `GITHUB_TOKEN`, so without this token the release PR can't be merged until someone closes and reopens it. Without the token, also allow GitHub Actions to create pull requests (Settings → Actions → General).
