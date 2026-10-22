// For Vitest only: a real local D1, in memory, with every migration applied, through the same
// Wrangler config the `local` Worker runs with, so tests exercise the SQL that D1 runs.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";

const migrationsDir = join(import.meta.dirname, "../../migrations");

export interface TestDatabase {
  db: DrizzleD1Database;
  dispose(): Promise<void>;
}

export async function openTestDatabase(): Promise<TestDatabase> {
  const proxy = await getPlatformProxy<Env>({ environment: "local", persist: false });
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const statements = readFileSync(join(migrationsDir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    await proxy.env.DB.batch(statements.map((statement) => proxy.env.DB.prepare(statement)));
  }
  return { db: drizzle(proxy.env.DB), dispose: () => proxy.dispose() };
}
