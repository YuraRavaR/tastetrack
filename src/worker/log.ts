// The logged-in User's Log: marking a Media Item Experienced, editing and deleting Log Entries, and
// reading the Log and a Media Item's Item History.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  ErrorResponse,
  ItemHistoryResponse,
  LogEntryEditRequest,
  LogEntryParams,
  LogEntryResponse,
  LogResponse,
  MediaItemParams,
  NewLogEntryRequest,
  NewLogEntryResponse,
} from "../shared/api";
import { requireUser, unauthenticatedResponse } from "./auth";
import { fillMissingMetadata } from "./catalog/media-items";
import { type AppEnv, tmdbConfig } from "./env";
import {
  createLogEntry,
  deleteLogEntry,
  editLogEntry,
  itemHistory,
  userLog,
} from "./log/log-entries";

const experiencedRoute = createRoute({
  method: "post",
  path: "/log-entries",
  summary: "Mark a Media Item Experienced, recording a Log Entry",
  description:
    "Also takes the Media Item off the User's Backlog, and says where it was and its Note, so " +
    "that marking it Planned at that position with that Note undoes it.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    body: { content: { "application/json": { schema: NewLogEntryRequest } }, required: true },
  },
  responses: {
    201: {
      content: { "application/json": { schema: NewLogEntryResponse } },
      description: "The new Log Entry, and where its Media Item was in the Backlog, if it was",
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

const unknownLogEntryResponse = {
  content: { "application/json": { schema: ErrorResponse } },
  description: "The User has no such Log Entry (`unknown_log_entry`)",
};

const editRoute = createRoute({
  method: "patch",
  path: "/log-entries/{logEntryId}",
  summary: "Edit a Log Entry",
  description:
    "Changes only the fields given, by the same rules as a new Log Entry; a null date or Review " +
    "clears it. The creation time never changes, so the entry keeps its place among same-day " +
    "entries.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    params: LogEntryParams,
    body: { content: { "application/json": { schema: LogEntryEditRequest } }, required: true },
  },
  responses: {
    200: {
      content: { "application/json": { schema: LogEntryResponse } },
      description: "The edited Log Entry",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        "The request body is malformed or names a field that can't be edited, the Rating isn't " +
        "0.5–5 in half stars, or the date isn't a calendar date, is before 1900-01-01 or after " +
        "today in the User's time zone (`invalid_request`, `invalid_date`, `date_too_early`, " +
        "`date_in_future`)",
    },
    401: unauthenticatedResponse,
    404: unknownLogEntryResponse,
  },
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/log-entries/{logEntryId}",
  summary: "Delete a Log Entry",
  description:
    "Deletes only the Log Entry. A Media Item left with no entries counts as not experienced and " +
    "has no Current Rating.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: { params: LogEntryParams },
  responses: {
    204: { description: "The Log Entry is deleted" },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The Log Entry id isn't a positive integer (`invalid_request`)",
    },
    401: unauthenticatedResponse,
    404: unknownLogEntryResponse,
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

const historyRoute = createRoute({
  method: "get",
  path: "/catalog/items/{mediaItemId}/history",
  summary: "Show the logged-in User's Item History of a Media Item, and its Current Rating",
  description:
    "Every Log Entry the User has for the Media Item, in Log Order. The Current Rating is the " +
    "last one's Rating, so a backdated entry doesn't override it; with no entries it is null. " +
    "`inBacklog` says whether the Media Item is in the User's Backlog of its Media Type.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: { params: MediaItemParams },
  responses: {
    200: {
      content: { "application/json": { schema: ItemHistoryResponse } },
      description: "The Item History, empty if the User hasn't experienced the Media Item",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The Media Item id isn't a positive integer (`invalid_request`)",
    },
    401: unauthenticatedResponse,
    404: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "There is no such Media Item (`unknown_media_item`)",
    },
  },
});

export const logRoutes = new OpenAPIHono<AppEnv>();

logRoutes.openapi(experiencedRoute, async (c) => {
  const created = await createLogEntry(c.var.db, c.var.userId, c.req.valid("json"), c.var.now);
  if (!created.ok) return c.json({ error: created.error }, 400);
  const { logEntry, removedFromBacklog } = created;
  return c.json({ logEntry, removedFromBacklog }, 201);
});

logRoutes.openapi(editRoute, async (c) => {
  const { logEntryId } = c.req.valid("param");
  const edited = await editLogEntry(
    c.var.db,
    c.var.userId,
    logEntryId,
    c.req.valid("json"),
    c.var.now,
  );
  if (edited.ok) return c.json({ logEntry: edited.logEntry }, 200);
  if (edited.error === "unknown_log_entry") return c.json({ error: edited.error }, 404);
  return c.json({ error: edited.error }, 400);
});

logRoutes.openapi(deleteRoute, async (c) => {
  if (!(await deleteLogEntry(c.var.db, c.var.userId, c.req.valid("param").logEntryId))) {
    return c.json({ error: "unknown_log_entry" }, 404);
  }
  return c.body(null, 204);
});

logRoutes.openapi(listRoute, async (c) => {
  const logEntries = await userLog(c.var.db, c.var.userId, c.var.now);
  const mediaItems = logEntries.map((entry) => entry.mediaItem);
  await fillMissingMetadata(c.var.db, tmdbConfig(c.env), mediaItems, c.var.now);
  return c.json({ logEntries }, 200);
});

logRoutes.openapi(historyRoute, async (c) => {
  const { mediaItemId } = c.req.valid("param");
  const history = await itemHistory(c.var.db, c.var.userId, mediaItemId, c.var.now);
  if (!history) return c.json({ error: "unknown_media_item" }, 404);
  // Each Log Entry shows the same Media Item, so filling it once fills them all.
  const mediaItems = [history.mediaItem, ...history.logEntries.map((entry) => entry.mediaItem)];
  await fillMissingMetadata(c.var.db, tmdbConfig(c.env), mediaItems, c.var.now);
  return c.json(history, 200);
});
