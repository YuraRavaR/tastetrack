import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { appMeta } from "../db/schema";
import { type ErrorResponse, HealthResponse } from "../shared/api";
import { auth } from "./auth";
import { type AppEnv, withClock, withDatabase } from "./env";
import { inviteCodeRoutes } from "./invite-codes";
import { testHooks } from "./test-hooks";

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

export const app = new OpenAPIHono<AppEnv>({
  // A request the route's schema rejects gets the same error shape as every other failure.
  defaultHook: (result, c) => {
    if (!result.success) return c.json({ error: "invalid_request" } satisfies ErrorResponse, 400);
  },
}).basePath("/api");

app.use(withDatabase);
app.use(withClock);

app.openapi(healthRoute, async (c) => {
  await c.var.db.select().from(appMeta).limit(1);
  return c.json({ status: "ok", database: "ok" } as const, 200);
});

app.route("/", auth);
app.route("/", inviteCodeRoutes);
app.route("/test", testHooks);

app.doc31("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "TasteTrack API",
    version: "0.1.0", // x-release-please-version
  },
});

app.notFound((c) => c.json({ error: "not_found" } satisfies ErrorResponse, 404));
