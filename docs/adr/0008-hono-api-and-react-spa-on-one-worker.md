# Hono API and React SPA served from one Worker

A single Worker serves a Hono JSON API and a client-rendered React app as static assets. Only Share Link pages get server-rendered `<head>` metadata (title, description, `noindex`), so links pasted into messengers show preview cards. We chose this over a full server-rendering framework (such as React Router v7 framework mode) to keep CPU per request low under the free plan's 10 ms budget, and to keep the API a separate, directly testable surface.

## Consequences

- The API is described by an OpenAPI spec generated from code (`@hono/zod-openapi`). The same Zod schemas validate requests, and tests validate every API response against the spec.
- Pages other than Share Links are not server-rendered; SEO is a non-goal, since everything except Share Links is behind login.
