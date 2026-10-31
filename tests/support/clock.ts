// The options for a request at `time`: with test hooks on, the Worker treats this header's time as
// now.
export function at(time: number | string) {
  return { headers: { "X-Test-Now": new Date(time).toISOString() } };
}
