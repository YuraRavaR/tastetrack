// The English message catalogue, in ICU MessageFormat.
// Film words belong here, not in domain code (ADR-0005).
export const en = {
  "app.name": "TasteTrack",
  "app.tagline": "Your personal film tracker",
  "health.checking": "Checking the connection to the server…",
  "health.ok": "The server is up",
  "health.unavailable": "The server is unavailable",
  "auth.checking": "Loading…",
  "auth.logout": "Log out",
  "login.title": "Log in",
  "login.username": "Username",
  "login.password": "Password",
  "login.submit": "Log in",
  "login.submitting": "Logging in…",
  "login.invalidCredentials": "Wrong Username or password",
  "login.unavailable": "Couldn't log in. Please try again.",
  "films.count": "{count, plural, one {# film} other {# films}}",
} as const;

export type MessageId = keyof typeof en;
