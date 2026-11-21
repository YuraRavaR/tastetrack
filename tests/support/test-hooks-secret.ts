// The same placeholder as the `local` env in wrangler.jsonc.
const localSecret = "local-test-hooks-secret";

// The header that opens test hooks, sent only on requests that use them: traces and reports record
// every header, and a browser would send a context-wide header to third parties as well.
export function testHooksHeaders() {
  const secret = process.env.TEST_HOOKS_SECRET ?? (process.env.BASE_URL ? undefined : localSecret);
  if (!secret)
    throw new Error("Set TEST_HOOKS_SECRET to run tests against a deployed URL (README)");
  return { "X-Test-Hooks-Secret": secret };
}

// The options for a request the Worker answers without these secrets of its own, as on a
// deployment the Operator hasn't set them on.
export function withoutSecrets(...names: ("TWITCH_CLIENT_ID" | "TWITCH_CLIENT_SECRET")[]) {
  return { headers: { ...testHooksHeaders(), "X-Test-Without-Secrets": names.join(", ") } };
}

// The options for a request whose first `times` calls to the MusicBrainz fake are answered 503, as
// MusicBrainz answers when it is busy. No other request's calls are.
export function withMusicBrainzBusy(times: 1 | 2) {
  return { headers: { ...testHooksHeaders(), "X-Test-MusicBrainz-Busy": String(times) } };
}
