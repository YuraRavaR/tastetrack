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
