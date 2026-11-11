# Test hooks need a secret, and staging's reports are encrypted

Staging is public and runs with test hooks on, and those hooks skip rules the public API enforces. So the routes under `/api/test/` and the `X-Test-Now` header now answer only a request whose `X-Test-Hooks-Secret` header matches `TEST_HOOKS_SECRET`. Any other request behaves as with hooks off: a JSON 404, and a test clock that is ignored. With no secret set, hooks answer nobody. The `local` env and the tests share a placeholder, so local runs and CI need no setup, and production stays as it was, with hooks off and no secret.

Cloudflare Access, alone or with the secret, was rejected. Production is just as reachable and draws on the same account limits, so closing staging as a whole would leave the shared limits exposed. It would also live only in the dashboard, out of reach of the tests, and browser tests would have to send its token with every request, to third parties too.

## Risks

| Risk | Verdict |
| --- | --- |
| Bulk fills and seed Users spend the D1 write budget shared with production (ADR-0006), which stops production's writes for the day | Critical; closed by the secret |
| Password resets hand over any staging account, and staging holds a few hand-made accounts besides test Users. Its other data is test data; routes return no password hashes or TMDB token | High; closed by the secret |
| A seed User gives a session without an Invite Code, and with it everything behind login, including TMDB search, which spends our token's quota | High; closed by the secret |
| `X-Test-Now` steps past login lockout and session expiry | Medium; closed by the secret |
| Evicting cached films forces TMDB calls and D1 writes on the next read | Low; closed by the secret |
| The read-outs of passwords' iterations, inviters and stored records reveal details of any account | Low; closed by the secret |
| The Workers free tier's 100,000 requests a day are per account, and API requests count towards them; D1's 5 million rows read a day can be spent too | Accepted: production's public URL offers the same way in |
| Failed logins write to D1 from a public route | Accepted: production has the same route |
| `X-D1-Query-Count` stays open | Accepted: a count, no data, and many tests read it on ordinary requests |
| Traces record request headers and test Users' logins, and this repo's artifacts are public | Closed by encrypting staging's reports |

Nothing here rate-limits requests. Separating staging into its own Cloudflare account would remove the shared limits, and is a decision of its own.

## Consequences

- The test side sends the secret only on requests that use a hook, never as a context-wide header, so it doesn't reach third parties from the browser.
- The TMDB fake can't sit behind the secret, because the `local` Worker calls itself without it. Only a Worker whose `TMDB_BASE_URL` points at the fake serves it, so staging has none.
- Staging runs publish `playwright-staging.enc`, encrypted with `STAGING_REPORT_KEY`, which `pnpm test:report` opens, and the D1 backup taken before migrations, encrypted with age (ADR-0009), and nothing else (revised 2026-11-11, #195). Don't upload a staging run's `test-results/` or `playwright-report/` in the clear. A missing key fails the run rather than publishing anything.
- Job logs stay public. GitHub masks the secret there, but not test Users' logins, so a failure message can show one.
- `TEST_HOOKS_SECRET` lives on the Worker and in the `staging` GitHub environment. A mismatch shows up as 404s in the staging smoke tests.
