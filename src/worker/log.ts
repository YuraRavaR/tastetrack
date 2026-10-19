// The logged-in User's Log: marking a Media Item Experienced, and reading the Log.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ErrorResponse, LogEntryResponse, LogResponse, NewLogEntryRequest } from "../shared/api";
import { requireUser, unauthenticatedResponse } from "./auth";
import type { AppEnv } from "./env";
import { createLogEntry, userLog } from "./log/log-entries";

const experiencedRoute = createRoute({
  method: "post",
  path: "/log-entries",
  summary: "Mark a Media Item Experienced, recording a Log Entry",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    body: { content: { "application/json": { schema: NewLogEntryRequest } }, required: true },
  },
  responses: {
    201: {
      content: { "application/json": { schema: LogEntryResponse } },
      description: "The new Log Entry",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        "The request body is malformed, the Rating isn't 0.5–5 in half stars, the date isn't a " +
        "calendar date, is before 1900-01-01 or after today in the User's time zone, or the Media " +
        "Item doesn't exist (`invalid_request`, `invalid_date`, `date_too_early`, " +
        "`date_in_future`, `unknown_media_item`)",
    },
    401: unauthenticatedResponse,
  },
});

const listRoute = createRoute({
  method: "get",
  path: "/log-entries",
  summary: "List the logged-in User's Log in Log Order",
  description:
    "Undated entries first by creation time, then dated entries by date, with creation time " +
    "breaking ties.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: LogResponse } },
      description: "Every Log Entry of the User",
    },
    401: unauthenticatedResponse,
  },
});

export const logRoutes = new OpenAPIHono<AppEnv>();

logRoutes.openapi(experiencedRoute, async (c) => {
  const created = await createLogEntry(c.var.db, c.var.userId, c.req.valid("json"), c.var.now);
  if (!created.ok) return c.json({ error: created.error }, 400);
  return c.json({ logEntry: created.logEntry }, 201);
});

logRoutes.openapi(listRoute, async (c) => {
  return c.json({ logEntries: await userLog(c.var.db, c.var.userId) }, 200);
});
