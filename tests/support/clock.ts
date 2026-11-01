import { testHooksHeaders } from "./test-hooks-secret";

export const day = 24 * 60 * 60 * 1000;

// The options for a request at `time`: with test hooks on and their secret, the Worker treats this
// header's time as now.
export function at(time: number | string) {
  return { headers: { ...testHooksHeaders(), "X-Test-Now": new Date(time).toISOString() } };
}
