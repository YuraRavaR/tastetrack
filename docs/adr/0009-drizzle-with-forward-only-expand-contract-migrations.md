# Drizzle ORM with forward-only, expand/contract migrations

Data access uses Drizzle ORM. drizzle-kit generates SQL migrations, which are committed and applied with `wrangler d1 migrations apply` the same way in every environment. Applied migrations are never edited, and breaking schema changes are split across releases (expand first, contract in a later release), so rolling back code to the previous release never meets an incompatible database.

## Consequences

- D1 Free allows 50 queries per Worker invocation, so every page loads in a fixed number of queries (JOIN / IN, never one query per item). An integration test counts the queries.
- Before every production migration, the Operator takes a manual D1 export, kept off the public repo and CI. D1 Time Travel (always on, 7 days on the free plan) is the main line of recovery. Encrypted automated backups in CI come later.
