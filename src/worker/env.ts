import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { createMiddleware } from "hono/factory";
import type { ErrorResponse } from "../shared/api";
import { countQueries } from "./query-count";

export const QUERY_COUNT_HEADER = "X-D1-Query-Count";

// With test hooks on, a request can set the time the Worker treats as now, so tests can step
// past time-based rules such as session expiry without waiting.
export const TEST_NOW_HEADER = "X-Test-Now";

export type AppEnv = {
  Bindings: Env;
  Variables: { db: DrizzleD1Database; now: Date };
};

export function testHooksOn(env: Env): boolean {
  return env.TEST_HOOKS === "1";
}

export const withDatabase = createMiddleware<AppEnv>(async (c, next) => {
  if (!testHooksOn(c.env)) {
    c.set("db", drizzle(c.env.DB));
    return next();
  }
  const counted = countQueries(c.env.DB);
  c.set("db", drizzle(counted.db));
  await next();
  c.res.headers.set(QUERY_COUNT_HEADER, String(counted.count()));
});

export const withClock = createMiddleware<AppEnv>(async (c, next) => {
  const testNow = testHooksOn(c.env) ? c.req.header(TEST_NOW_HEADER) : undefined;
  if (testNow === undefined) {
    c.set("now", new Date());
    return next();
  }
  const now = new Date(testNow);
  if (Number.isNaN(now.getTime())) {
    return c.json({ error: "invalid_test_now" } satisfies ErrorResponse, 400);
  }
  c.set("now", now);
  await next();
});
