# Username and password login, with Recovery Codes and invite-only registration

Users log in with a Username and password, hashed with PBKDF2-SHA256 through Web Crypto using a per-User salt and an app-wide pepper. A lost password is recovered with one of eight one-time Recovery Codes, and new Users can only register with an Invite Code from an existing User. This keeps auth inside our own Worker with no email sender and no third-party identity provider, which fits ADR-0001 and a small friends-only audience.

## MVP phasing

The MVP ships Username + password (PBKDF2 with the iteration count stored per hash), sessions, the Username + IP lockout, invite-only signup, account deletion, and the Operator CLI for bootstrap and password reset. Recovery Codes, the pepper, the Pwned Passwords check and Turnstile come later. Until then, **every forgotten password is reset by the Operator**, and nothing slows distributed guessing against a single Username beyond invite-only registration and the per-IP lockout. Users who registered before Recovery Codes exist will generate their first set from Settings once the feature ships.

## Considered Options

- **Google OAuth**: rejected for the MVP. It needs an external identity provider and its setup and consent screen, and makes local, preview and E2E environments harder to run. It may be added later as an optional login method.
- **Email magic link, or password with email reset**: rejected. Both need an email-sending service, which is one more free tier to depend on and maintain.
- **Username + password + Recovery Codes + Invite Codes**: chosen. Self-contained and testable end to end through the real login form.

## Consequences

- Password hashing must fit the Workers free-plan budget of 10 ms CPU per request. We accept the highest PBKDF2-SHA256 iteration count that fits, even though it is below OWASP's recommended 600,000. **The target is 20,000 iterations**, set by a spike on deployed staging (issue #6), because local dev doesn't enforce CPU limits.
  - The spike sent 20 simulated login requests per iteration count and measured CPU time from `wrangler tail`. The simulated login was a D1 read, the hash, a constant-time compare, and a session token and its SHA-256. The tool is the test-hook endpoint `/api/test/pbkdf2` and `scripts/pbkdf2-spike.ts`.
  - Results, as p50 / p90 CPU ms, on 2026-10-19:

    | Iterations | Run 1 | Run 2 |
    | --- | --- | --- |
    | 1 | 1 / 2 | 1 / 2 |
    | 10,000 | n/a | 5 / 8 |
    | 20,000 | 5 | 8 / 9 |
    | 30,000 | 7 | 13 / 17 |
    | 40,000 | 8 | 14 / 21 |
    | 50,000 | 9–14 | 16 / 24 |
    | 100,000 | 22 | 31 / 39 |

  - Run 1 was unpaced, so `wrangler tail` sampled it down to one or two requests per count.
  - Edge machines differ by about 2×, so the target is the count that stays within 10 ms at p90 on the slower run.
  - **The 100,000-iteration cap is confirmed.** 100,001 fails with `NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not supported`.
  - The free plan didn't reject any request over 10 ms; up to 53 ms still ended `ok`. We treat the budget as the limit anyway, since Cloudflare can enforce it.
  - A login that re-hashes a below-target hash runs PBKDF2 twice. That is rare, and we accept it.
- We compensate for the lower iteration count: the iteration count is stored with each hash and re-hashed on login when below target; a pepper (a Workers secret, never in the database) is mixed into every hash; passwords must be at least 10 characters and are checked against Pwned Passwords (k-anonymity range API) on signup and change; registration is invite-only.
- Recovery Codes are high-entropy random values, so they are hashed with plain SHA-256, not PBKDF2, which keeps checking all eight within the CPU budget.
- Brute-force protection must not become a way to lock someone out: failures lock a Username + IP pair, while the per-Username cap only adds a Cloudflare Turnstile challenge.
- Until Recovery Codes ship, the Operator's reset never sets or learns the User's real password: the CLI issues a random Temporary Password, shown once, ends every session of the User's and flags the password for a change. A session from a Temporary Password can only set the User's own password, which must differ from it; every other route refuses it with a 403. Logout stays open to it, so a User can still walk away.
- A User who loses both their password and all Recovery Codes depends on the Operator, who can issue a single Recovery Code through the CLI. Each such issue is audited and shown to the User.
- We own credential storage, rate limiting and session handling, and the test suite must cover them.
