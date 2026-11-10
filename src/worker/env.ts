import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { ErrorResponse } from "../shared/api";
import { equalInConstantTime } from "./accounts/password";
import { countQueries } from "./query-count";

export const QUERY_COUNT_HEADER = "X-D1-Query-Count";

// With test hooks on, a request with their secret can set the time the Worker treats as now, so
// tests can step past time-based rules such as session expiry without waiting.
const TEST_NOW_HEADER = "X-Test-Now";

const TEST_HOOKS_SECRET_HEADER = "X-Test-Hooks-Secret";

export type AppEnv = {
  Bindings: Env;
  Variables: { db: DrizzleD1Database; now: Date };
};

export function testHooksOn(env: Pick<Env, "TEST_HOOKS">): boolean {
  return env.TEST_HOOKS === "1";
}

// Staging is public, so test hooks answer only a request with their secret (ADR-0010). With no
// secret set they answer nobody, so a forgotten `wrangler secret put` leaves them closed.
export function hasTestHooksAccess(
  env: Pick<Env, "TEST_HOOKS" | "TEST_HOOKS_SECRET">,
  presentedSecret: string | undefined,
): boolean {
  if (!testHooksOn(env) || !env.TEST_HOOKS_SECRET || !presentedSecret) return false;
  const encoder = new TextEncoder();
  return equalInConstantTime(
    encoder.encode(presentedSecret),
    encoder.encode(env.TEST_HOOKS_SECRET),
  );
}

export function requestHasTestHooksAccess(c: Context<AppEnv>): boolean {
  return hasTestHooksAccess(c.env, c.req.header(TEST_HOOKS_SECRET_HEADER));
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
  const testNow = requestHasTestHooksAccess(c) ? c.req.header(TEST_NOW_HEADER) : undefined;
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
