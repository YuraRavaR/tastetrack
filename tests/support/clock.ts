import { testHooksHeaders } from "./test-hooks-secret";

export const day = 24 * 60 * 60 * 1000;

// The options for a request at `time`: with test hooks on and their secret, the Worker treats this
// header's time as now.
export function at(time: number | string) {
  return { headers: { ...testHooksHeaders(), "X-Test-Now": new Date(time).toISOString() } };
}

const minute = 60 * 1000;

// The moment `minutes` ago, for tests that need one creation time before another. A request at a
// test time sets the session's expiry from that time, so a fixed date would end the session for
// the test's later requests once the real date passes that expiry.
export function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * minute).toISOString();
}
