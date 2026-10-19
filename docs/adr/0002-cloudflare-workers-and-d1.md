# Cloudflare Workers and D1 for hosting and storage

We run the app on Cloudflare Workers with D1 (SQLite) as the database. The free tier covers our expected load and, unlike Supabase's free tier, does not pause projects after a period of inactivity, which would break ADR-0001.

## Considered Options

- **Supabase (Postgres) free tier**: rejected because inactive projects are paused and need a manual restore.
- **Cloudflare Workers + D1**: chosen; no pausing, and app and database share one platform and one deploy tool.

## Consequences

- The data model has to fit SQLite semantics (no Postgres-specific types or extensions).
- Runtime code must run in the Workers runtime, not full Node.js.
