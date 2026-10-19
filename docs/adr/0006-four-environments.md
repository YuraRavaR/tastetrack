# Four environments: local, per-PR preview, staging, production

The app runs in four environments: local development (Wrangler with a local D1), a Cloudflare Workers Preview per pull request, a shared staging, and production. Each deployed environment has its own D1 database, so previews and staging never touch production data, and the automated test suite runs against a real deployed preview before a merge.

## MVP phasing

The MVP runs three environments: local, staging and production. Per-PR previews and the spike on giving each preview its own D1 come later. Until then, API and E2E tests run against local and staging, and the manual cron trigger is needed in local and staging only.

## Consequences

- Previews are created by `wrangler preview` (Workers Previews, 2026), not Version URLs: Version URLs use production bindings and must not be used.
- A preview gets its bindings from the static `previews` block in the Wrangler config, so by default all previews share one D1. Giving each PR its own database requires CI to create one and inject it per run (to be confirmed by a spike).
- D1 Free allows 10 databases per account; minus production and staging, that is at most 8 concurrent previews. CI deletes a preview and its database when the PR closes, a daily job removes leftovers, and hitting the limit fails the preview step clearly rather than reusing another database.
- Cron Triggers do not run in previews, so cron logic (cache refresh, Unavailable Media Item detection) has a test-only manual trigger, which exists in every environment except production.
- Preview URLs are public by default, so previews contain test seed data only. Test seed users exist in local, preview and staging, never in production.
