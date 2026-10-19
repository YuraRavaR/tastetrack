# Username and password login, with Recovery Codes and invite-only registration

Users log in with a Username and password, hashed with PBKDF2-SHA256 through Web Crypto using a per-User salt and an app-wide pepper. A lost password is recovered with one of eight one-time Recovery Codes, and new Users can only register with an Invite Code from an existing User. This keeps auth inside our own Worker with no email sender and no third-party identity provider, which fits ADR-0001 and a small friends-only audience.

## MVP phasing

The MVP ships Username + password (PBKDF2 with the iteration count stored per hash), sessions, the Username + IP lockout, invite-only signup, account deletion, and the Operator CLI for bootstrap and password reset. Recovery Codes, the pepper, the Pwned Passwords check and Turnstile come later. Until then, **every forgotten password is reset by the Operator**, and nothing slows distributed guessing against a single Username beyond invite-only registration and the per-IP lockout. Users who registered before Recovery Codes exist will generate their first set from Settings once the feature ships.

## Considered Options

- **Google OAuth**: rejected for the MVP. It needs an external identity provider and its setup and consent screen, and makes local, preview and E2E environments harder to run. It may be added later as an optional login method.
- **Email magic link, or password with email reset**: rejected. Both need an email-sending service, which is one more free tier to depend on and maintain.
- **Username + password + Recovery Codes + Invite Codes**: chosen. Self-contained and testable end to end through the real login form.

## Consequences

- Password hashing must fit the Workers free-plan budget of 10 ms CPU per request. We accept the highest PBKDF2-SHA256 iteration count that fits, even though it is below OWASP's recommended 600,000. A spike on a deployed Worker sets the number (local dev doesn't enforce CPU limits) and checks the reported 100,000-iteration cap in Workers Web Crypto.
- We compensate for the lower iteration count: the iteration count is stored with each hash and re-hashed on login when below target; a pepper (a Workers secret, never in the database) is mixed into every hash; passwords must be at least 10 characters and are checked against Pwned Passwords (k-anonymity range API) on signup and change; registration is invite-only.
- Recovery Codes are high-entropy random values, so they are hashed with plain SHA-256, not PBKDF2, which keeps checking all eight within the CPU budget.
- Brute-force protection must not become a way to lock someone out: failures lock a Username + IP pair, while the per-Username cap only adds a Cloudflare Turnstile challenge.
- A User who loses both their password and all Recovery Codes depends on the Operator, who can issue a single Recovery Code through the CLI. Each such issue is audited and shown to the User.
- We own credential storage, rate limiting and session handling, and the test suite must cover them.
