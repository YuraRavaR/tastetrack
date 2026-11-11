# Drizzle ORM with forward-only, expand/contract migrations

Data access uses Drizzle ORM. drizzle-kit generates SQL migrations, which are committed and applied with `wrangler d1 migrations apply` the same way in every environment. Applied migrations are never edited, and breaking schema changes are split across releases (expand first, contract in a later release), so rolling back code to the previous release never meets an incompatible database.

## Consequences

- D1 Free allows 50 queries per Worker invocation, so every page loads in a fixed number of queries (JOIN / IN, never one query per item). An integration test counts the queries.
- Before every migration, staging and production deploys back up their D1: an export encrypted with age to the Operator's public key, kept 90 days as a workflow artifact, so the public repo's artifacts never hold Users' data in the clear. Only the Operator's private key opens one. D1 Time Travel (always on, 7 days on the free plan) is the main line of recovery, and the backup the fallback beyond it. (revised 2026-11-11, when it replaced a manual export the Operator took before each production deploy).
