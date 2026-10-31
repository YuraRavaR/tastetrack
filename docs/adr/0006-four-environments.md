# Four environments: local, per-PR preview, staging, production

The app runs in four environments: local development (Wrangler with a local D1), a Cloudflare Workers Preview per pull request, a shared staging, and production. Each deployed environment has its own D1 database, so previews and staging never touch production data, and the automated test suite runs against a real deployed preview before a merge.

## MVP phasing

The MVP runs three environments: local, staging and production. Per-PR previews and the spike on giving each preview its own D1 come later. Until then, the full API and E2E suite runs against local D1, and staging runs only the smoke subset (see below).

## Consequences

- Previews are created by `wrangler preview` (Workers Previews, 2026), not Version URLs: Version URLs use production bindings and must not be used.
- A preview gets its bindings from the static `previews` block in the Wrangler config, so by default all previews share one D1. Giving each PR its own database requires CI to create one and inject it per run (to be confirmed by a spike).
- D1 Free allows 10 databases per account; minus production and staging, that is at most 8 concurrent previews. CI deletes a preview and its database when the PR closes, a daily job removes leftovers, and hitting the limit fails the preview step clearly rather than reusing another database.
- Cron Triggers do not run in previews, and cron logic has no manual trigger: the cache refresh is unit tested instead (revised 2026-10-31, when the test-only trigger was removed, as only its own tests called it).
- Every deployed environment on the account, staging, production and any preview, shares one D1 free-tier budget: 100,000 rows written a day, counting each index a write updates. Once it is spent, writes fail everywhere, production included, until 00:00 UTC (revised 2026-10-20, after the full suite's bulk fills against staging spent it). So tests against a deployed URL are smoke-only and write little: Playwright runs only the tests tagged `@smoke` when `BASE_URL` is set, and those never fill Lists in bulk. Cron Triggers run in production only.
- Preview URLs are public by default, so previews contain test seed data only. Test seed users exist in local, preview and staging, never in production.
