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
  event: { request?: { url: string } } | null;
}

const defaultIterations = [1, 25_000, 50_000, 75_000, 100_000, 100_001, 125_000, 150_000, 200_000];

const [baseURL, ...counts] = process.argv.slice(2);
if (!baseURL) {
  console.error("Usage: node scripts/pbkdf2-spike.ts <staging-url> [iterations ...]");
  process.exit(1);
}
const iterationCounts = counts.length > 0 ? counts.map(Number) : defaultIterations;
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
    events.push(JSON.parse(text));
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

function percentile(sorted: number[], p: number): number | undefined {
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))];
}

// The tail takes a few seconds to attach, so knock until it reports a request.
async function waitForTail(): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await fetch(`${baseURL}/api/health`);
    await sleep(2000);
    if (events.length > 0) return;
  }
  throw new Error("wrangler tail reported no events within a minute");
}

try {
  await waitForTail();

  const statuses = new Map<number, Map<number, number>>();
  for (const iterations of iterationCounts) {
    const counted = new Map<number, number>();
    statuses.set(iterations, counted);
    for (let i = 0; i < requestsPerCount; i += 1) {
      const response = await fetch(`${baseURL}/api/test/pbkdf2?iterations=${iterations}`);
      await response.arrayBuffer();
      counted.set(response.status, (counted.get(response.status) ?? 0) + 1);
    }
  }
  // Trace events arrive after their responses.
  await sleep(10_000);

  const rows = iterationCounts.map((iterations) => {
    const traced = events.filter((event) => iterationsOf(event) === iterations);
    const cpu = traced.map((event) => event.cpuTime ?? Number.NaN).sort((a, b) => a - b);
    const wall = traced.map((event) => event.wallTime ?? Number.NaN).sort((a, b) => a - b);
    const outcomes = new Map<string, number>();
    for (const event of traced) outcomes.set(event.outcome, (outcomes.get(event.outcome) ?? 0) + 1);
    const errors = new Set(traced.flatMap((event) => event.exceptions.map((e) => e.message)));
    return {
      iterations,
      statuses: Object.fromEntries(statuses.get(iterations) ?? []),
      traced: traced.length,
      outcomes: Object.fromEntries(outcomes),
      "cpu p50 ms": percentile(cpu, 50),
      "cpu p90 ms": percentile(cpu, 90),
      "cpu max ms": cpu.at(-1),
      "wall p50 ms": percentile(wall, 50),
      errors: [...errors].join("; "),
    };
  });
  console.log(JSON.stringify(rows, null, 2));
} finally {
  tail.kill();
}
