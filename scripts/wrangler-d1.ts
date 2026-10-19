// A Drizzle database for Node scripts, backed by `wrangler d1 execute`, so the Operator CLI runs
// the Worker's own data code against the D1 of any environment. It provides the part of a D1
// binding that Drizzle uses for single statements (prepare, bind, then all / raw / first / run);
// batches and transactions aren't supported. Wrangler takes no bound parameters, so each value
// is inlined as an SQLite literal.
import { spawn } from "node:child_process";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";

export class WranglerError extends Error {}

type Row = Record<string, unknown>;

function literal(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "bigint") return String(value);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  throw new WranglerError(`Can't write ${String(value)} as an SQLite literal.`);
}

// Replaces each `?` placeholder outside quotes with the next value. Drizzle writes values only as
// placeholders, so a `?` inside quotes is part of a name or literal and stays.
function inline(sql: string, values: unknown[]): string {
  let inlined = "";
  let next = 0;
  let quote: string | null = null;
  for (const char of sql) {
    if (quote) {
      if (char === quote) quote = null;
      inlined += char;
    } else if (char === "'" || char === '"' || char === "`") {
      quote = char;
      inlined += char;
    } else if (char === "?") {
      if (next >= values.length)
        throw new WranglerError("The SQL has more placeholders than values.");
      inlined += literal(values[next]);
      next += 1;
    } else {
      inlined += char;
    }
  }
  if (next !== values.length)
    throw new WranglerError("The SQL has fewer placeholders than values.");
  return inlined;
}

function wrangler(
  args: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "wrangler", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

// `target` is the wrangler arguments that pick the database, e.g. ["--env", "local", "--local"].
export function wranglerDatabase(target: readonly string[]): DrizzleD1Database {
  async function execute(sql: string): Promise<Row[]> {
    const result = await wrangler(["d1", "execute", "DB", ...target, "--json", "--command", sql]);
    if (result.code !== 0) {
      throw new WranglerError(`wrangler d1 execute failed:\n${result.stderr}${result.stdout}`);
    }
    const [statement] = JSON.parse(result.stdout) as { results: Row[] }[];
    return statement?.results ?? [];
  }

  function statement(sql: string, values: unknown[]) {
    const all = async () => ({ results: await execute(inline(sql, values)), success: true });
    return {
      bind: (...bound: unknown[]) => statement(sql, bound),
      all,
      run: all,
      // Rows as arrays in column order, which JSON objects keep.
      raw: async () => (await all()).results.map((row) => Object.values(row)),
      first: async (column?: string) => {
        const [row] = (await all()).results;
        if (row === undefined) return null;
        return column === undefined ? row : row[column];
      },
    };
  }

  const binding = {
    prepare: (sql: string) => statement(sql, []),
    batch: () => {
      throw new WranglerError("Batches aren't supported over wrangler d1 execute.");
    },
  };
  return drizzle(binding as unknown as Parameters<typeof drizzle>[0]);
}
