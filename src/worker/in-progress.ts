// The logged-in User's In Progress: starting a Media Item, changing when they started it, finishing
// it with a Log Entry and stopping it.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  ErrorResponse,
  FinishRequest,
  InProgressEditRequest,
  InProgressResponse,
  MediaItemParams,
  NewInProgressRequest,
  NewInProgressResponse,
  NewLogEntryResponse,
} from "../shared/api";
import { requireUser, unauthenticatedResponse } from "./auth";
import type { AppEnv } from "./env";
import { changeStartDate, finish, start, stop } from "./log/in-progress";

const dateRules =
  "the start date isn't a calendar date, is before 1900-01-01 or after today in the User's time " +
  "zone (`invalid_date`, `date_too_early`, `date_in_future`)";

const notInProgressResponse = {
  content: { "application/json": { schema: ErrorResponse } },
  description: "The User doesn't have the Media Item In Progress (`not_in_progress`)",
};

const startRoute = createRoute({
  method: "post",
  path: "/in-progress",
  summary: "Start a Media Item, marking it In Progress",
  description:
    "Also takes the Media Item off the User's Backlog, and says where it was and its Note, so " +
    "that marking it Planned at that position with that Note undoes it. Only a book can be " +
    "started, and not while it is In Progress already.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    body: { content: { "application/json": { schema: NewInProgressRequest } }, required: true },
  },
  responses: {
    201: {
      content: { "application/json": { schema: NewInProgressResponse } },
      description: "The new In Progress, and where its Media Item was in the Backlog, if it was",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        "The request body is malformed, the Media Item doesn't exist, or its Media Type has no " +
        "In Progress, as a film has none (`invalid_request`, `unknown_media_item`, " +
        `\`not_progressable\`), or ${dateRules}`,
    },
    401: unauthenticatedResponse,
    409: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The User has the Media Item In Progress already (`already_in_progress`)",
    },
  },
});

const editRoute = createRoute({
  method: "patch",
  path: "/in-progress/{mediaItemId}",
  summary: "Change when the User started a Media Item In Progress",
  description: "A null start date clears it.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    params: MediaItemParams,
    body: { content: { "application/json": { schema: InProgressEditRequest } }, required: true },
  },
  responses: {
    200: {
      content: { "application/json": { schema: InProgressResponse } },
      description: "The In Progress with its new start date",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: `The request is malformed (\`invalid_request\`), or ${dateRules}`,
    },
    401: unauthenticatedResponse,
    404: notInProgressResponse,
  },
});

const finishRoute = createRoute({
  method: "post",
  path: "/in-progress/{mediaItemId}/finish",
  summary: "Finish a Media Item In Progress, recording a Log Entry",
  description:
    "Records a Log Entry by the rules of marking a Media Item Experienced, and ends In Progress " +
    "in the same batch. Answers as marking it Experienced does.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    params: MediaItemParams,
    body: { content: { "application/json": { schema: FinishRequest } }, required: true },
  },
  responses: {
    201: {
      content: { "application/json": { schema: NewLogEntryResponse } },
      description:
        "The new Log Entry, where its Media Item was in the Backlog, if it was, and its Current " +
        "Rating and number of Log Entries now",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        "The request is malformed, the Rating isn't 0.5–5 in half stars, or the date isn't a " +
        "calendar date, is before 1900-01-01 or after today in the User's time zone " +
        "(`invalid_request`, `invalid_date`, `date_too_early`, `date_in_future`)",
    },
    401: unauthenticatedResponse,
    404: notInProgressResponse,
  },
});

const stopRoute = createRoute({
  method: "delete",
  path: "/in-progress/{mediaItemId}",
  summary: "Stop a Media Item In Progress without a Log Entry",
  description: "Ends In Progress and leaves no trace of it: no Log Entry, and no Backlog item.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: { params: MediaItemParams },
  responses: {
    204: { description: "The Media Item is no longer In Progress" },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The Media Item id isn't a positive integer (`invalid_request`)",
    },
    401: unauthenticatedResponse,
    404: notInProgressResponse,
  },
});

export const inProgressRoutes = new OpenAPIHono<AppEnv>();

inProgressRoutes.openapi(startRoute, async (c) => {
  const started = await start(c.var.db, c.var.userId, c.req.valid("json"), c.var.now);
  if (started.ok) {
    const { inProgress, removedFromBacklog } = started;
    return c.json({ inProgress, removedFromBacklog }, 201);
  }
  if (started.error === "already_in_progress") return c.json({ error: started.error }, 409);
  return c.json({ error: started.error }, 400);
});

inProgressRoutes.openapi(editRoute, async (c) => {
  const { mediaItemId } = c.req.valid("param");
  const edit = c.req.valid("json");
  const changed = await changeStartDate(c.var.db, c.var.userId, mediaItemId, edit, c.var.now);
  if (changed.ok) return c.json({ inProgress: changed.inProgress }, 200);
  if (changed.error === "not_in_progress") return c.json({ error: changed.error }, 404);
  return c.json({ error: changed.error }, 400);
});

inProgressRoutes.openapi(finishRoute, async (c) => {
  const { mediaItemId } = c.req.valid("param");
  const finished = await finish(
    c.var.db,
    c.var.userId,
    mediaItemId,
    c.req.valid("json"),
    c.var.now,
  );
  if (finished.ok) {
    const { logEntry, removedFromBacklog, currentRating, logEntryCount } = finished;
    return c.json({ logEntry, removedFromBacklog, currentRating, logEntryCount }, 201);
  }
  if (finished.error === "not_in_progress") return c.json({ error: finished.error }, 404);
  return c.json({ error: finished.error }, 400);
});

inProgressRoutes.openapi(stopRoute, async (c) => {
  if (!(await stop(c.var.db, c.var.userId, c.req.valid("param").mediaItemId))) {
    return c.json({ error: "not_in_progress" }, 404);
  }
  return c.body(null, 204);
});
