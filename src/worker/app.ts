import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { createMiddleware } from "hono/factory";
import { appMeta } from "../db/schema";
import { type ErrorResponse, HealthResponse } from "../shared/api";
import { countQueries } from "./query-count";

export const QUERY_COUNT_HEADER = "X-D1-Query-Count";

type AppEnv = {
  Bindings: Env;
  Variables: { db: DrizzleD1Database };
};

function testHooksOn(env: Env): boolean {
  return env.TEST_HOOKS === "1";
}

const withDatabase = createMiddleware<AppEnv>(async (c, next) => {
  if (!testHooksOn(c.env)) {
    c.set("db", drizzle(c.env.DB));
    return next();
  }
  const counted = countQueries(c.env.DB);
  c.set("db", drizzle(counted.db));
  await next();
  c.res.headers.set(QUERY_COUNT_HEADER, String(counted.count()));
});

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  summary: "Check that the Worker and its database are up",
  responses: {
    200: {
      content: { "application/json": { schema: HealthResponse } },
      description: "The Worker is up and the database is migrated",
    },
  },
});

export const app = new OpenAPIHono<AppEnv>().basePath("/api");

app.use(withDatabase);

app.openapi(healthRoute, async (c) => {
  await c.var.db.select().from(appMeta).limit(1);
  return c.json({ status: "ok", database: "ok" } as const, 200);
});

app.doc31("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "TasteTrack API",
    version: "0.1.0", // x-release-please-version
  },
});

app.notFound((c) => c.json({ error: "not_found" } satisfies ErrorResponse, 404));
