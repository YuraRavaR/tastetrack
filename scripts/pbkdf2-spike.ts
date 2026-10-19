// Measures the CPU time of the PBKDF2 spike endpoint on deployed staging (issue #6, ADR-0007).
// A Worker can't time its own CPU (its clocks stop between I/O), so this tails the staging
// Worker and reads each request's `cpuTime` from its trace event.
//
//   node scripts/pbkdf2-spike.ts <staging-url> [iterations ...]
//
// Needs Wrangler logged in to the account that hosts staging, and staging deployed with test
// hooks on. Set REQUESTS to change how many requests each iteration count gets (default 20).
import { spawn } from "node:child_process";

interface TailEvent {
  outcome: string;
  cpuTime?: number;
  wallTime?: number;
  exceptions: { name: string; message: string }[];
  // Hono catches a thrown error and console.errors it, so a runtime refusal lands here.
  logs: { level: string; message: unknown[] }[];
  event: { request?: { url: string } } | null;
}

const defaultIterations = [1, 25_000, 50_000, 75_000, 100_000, 100_001, 125_000, 150_000, 200_000];

const [baseURL, ...iterationArgs] = process.argv.slice(2);
if (!baseURL) {
  console.error("Usage: node scripts/pbkdf2-spike.ts <staging-url> [iterations ...]");
  process.exit(1);
}
const iterationCounts = iterationArgs.length > 0 ? iterationArgs.map(Number) : defaultIterations;
const requestsPerCount = Number(process.env.REQUESTS ?? 20);

// `wrangler tail --format json` prints each event as indented JSON that closes with a "}" line.
const events: TailEvent[] = [];
const tail = spawn("pnpm", ["exec", "wrangler", "tail", "--env", "staging", "--format", "json"], {
  stdio: ["ignore", "pipe", "inherit"],
});
let buffered = "";
tail.stdout.setEncoding("utf8").on("data", (chunk: string) => {
  buffered += chunk;
  let end = buffered.indexOf("\n}\n");
  while (end !== -1) {
    const text = buffered.slice(buffered.indexOf("{"), end + 2);
    buffered = buffered.slice(end + 3);
    try {
      events.push(JSON.parse(text));
    } catch {
      console.error(`Skipped a tail event that isn't JSON: ${text.slice(0, 200)}`);
    }
    end = buffered.indexOf("\n}\n");
  }
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function iterationsOf(event: TailEvent): number | undefined {
  const url = event.event?.request?.url;
  if (!url) return undefined;
  const { pathname, searchParams } = new URL(url);
  return pathname === "/api/test/pbkdf2" ? Number(searchParams.get("iterations")) : undefined;
}

function tally<K>(keys: K[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const key of keys) counts[String(key)] = (counts[String(key)] ?? 0) + 1;
  return counts;
}

// Ascending, leaving out events the tail sent without that timing.
function sortedTimes(events: TailEvent[], field: "cpuTime" | "wallTime"): number[] {
  return events
    .map((event) => event[field])
    .filter((ms) => ms !== undefined)
    .sort((a, b) => a - b);
}

function percentile(sorted: number[], p: number): number | undefined {
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))];
}

// The tail takes a few seconds to attach, so knock until it reports a request.
async function waitForTail(): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`${baseURL}/api/health`);
    await response.arrayBuffer();
    await sleep(2000);
    if (events.length > 0) return;
  }
  throw new Error("wrangler tail reported no events within a minute");
}

try {
  console.error("Waiting for wrangler tail to attach...");
  await waitForTail();

  const statusesByIterations = new Map<number, number[]>();
  for (const iterations of iterationCounts) {
    const statuses: number[] = [];
    statusesByIterations.set(iterations, statuses);
    console.error(`${iterations} iterations: ${requestsPerCount} requests`);
    for (let i = 0; i < requestsPerCount; i += 1) {
      const response = await fetch(`${baseURL}/api/test/pbkdf2?iterations=${iterations}`);
      await response.arrayBuffer();
      statuses.push(response.status);
      // Faster than this, wrangler tail drops into sampling and reports few of the requests.
      await sleep(500);
    }
  }
  // Trace events arrive after their responses.
  console.error("Waiting for the last trace events...");
  await sleep(10_000);

  const rows = iterationCounts.map((iterations) => {
    const traced = events.filter((event) => iterationsOf(event) === iterations);
    const cpu = sortedTimes(traced, "cpuTime");
    const wall = sortedTimes(traced, "wallTime");
    const errors = new Set(
      traced.flatMap((event) => [
        ...event.exceptions.map((exception) => exception.message),
        ...event.logs
          .filter((log) => log.level === "error")
          .map((log) => log.message.map(String).join(" ")),
      ]),
    );
    return {
      iterations,
      statuses: tally(statusesByIterations.get(iterations) ?? []),
      traced: traced.length,
      outcomes: tally(traced.map((event) => event.outcome)),
      "cpu p50 ms": percentile(cpu, 50),
      "cpu p90 ms": percentile(cpu, 90),
      "cpu max ms": cpu.at(-1),
      "wall p50 ms": percentile(wall, 50),
      errors: [...errors].join("; "),
    };
  });
  console.log(JSON.stringify(rows, null, 2));
} finally {
  // Killing pnpm leaves wrangler holding the pipe open, so let go of it too.
  tail.kill();
  tail.stdout.destroy();
  tail.unref();
}
