// The logged-in User's Backlog: reading it, marking Media Items Planned, and reordering, noting
// and removing its List Items.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  BacklogQuery,
  BacklogResponse,
  ErrorResponse,
  ListItemEditRequest,
  ListItemParams,
  ListItemResponse,
  PlanRequest,
} from "../shared/api";
import { maxListItems } from "../shared/lists";
import { requireUser, unauthenticatedResponse } from "./auth";
import type { AppEnv } from "./env";
import { plan, userBacklog } from "./lists/backlog";
import { editListItem, removeListItem } from "./lists/list-items";

const backlogRoute = createRoute({
  method: "get",
  path: "/backlog",
  summary: "Show the logged-in User's Backlog of a Media Type, in order",
  description:
    "Every User has exactly one Backlog per Media Type, made with their account, which can be " +
    "neither deleted nor renamed.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: { query: BacklogQuery },
  responses: {
    200: {
      content: { "application/json": { schema: BacklogResponse } },
      description: "The Backlog and its List Items in order",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The Media Type is unknown (`invalid_request`)",
    },
    401: unauthenticatedResponse,
  },
});

const planRoute = createRoute({
  method: "post",
  path: "/backlog/items",
  summary: "Mark a Media Item Planned, adding it to the Backlog of its Media Type",
  description:
    "Adds the Media Item to the end of the logged-in User's Backlog, without a Log Entry. A " +
    "Media Item already in the Backlog keeps its place.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    body: { content: { "application/json": { schema: PlanRequest } }, required: true },
  },
  responses: {
    200: {
      content: { "application/json": { schema: ListItemResponse } },
      description: "The Media Item was already in the Backlog, and keeps its place",
    },
    201: {
      content: { "application/json": { schema: ListItemResponse } },
      description: "The Media Item's new List Item in the Backlog",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        "The request body is malformed, or the Media Item doesn't exist (`invalid_request`, " +
        "`unknown_media_item`)",
    },
    401: unauthenticatedResponse,
    409: {
      content: { "application/json": { schema: ErrorResponse } },
      description: `The Backlog already holds ${maxListItems} items (\`backlog_full\`)`,
    },
  },
});

const unknownListItemResponse = {
  content: { "application/json": { schema: ErrorResponse } },
  description: "The User has no such List Item (`unknown_list_item`)",
};

const editRoute = createRoute({
  method: "patch",
  path: "/list-items/{listItemId}",
  summary: "Move a List Item within its List, or change its Note",
  description:
    "Changes only the fields given. A position, counted from 0, moves the List Item there, " +
    "shifting the items between; a position past the end moves it to the end. A null or empty " +
    "Note clears it.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    params: ListItemParams,
    body: { content: { "application/json": { schema: ListItemEditRequest } }, required: true },
  },
  responses: {
    200: {
      content: { "application/json": { schema: ListItemResponse } },
      description: "The List Item where it now is",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        "The request body is malformed or names a field that can't be edited (`invalid_request`)",
    },
    401: unauthenticatedResponse,
    404: unknownListItemResponse,
  },
});

const removeRoute = createRoute({
  method: "delete",
  path: "/list-items/{listItemId}",
  summary: "Remove a List Item from its List",
  description:
    "Removes only the List Item: its Media Item and the User's Log Entries for it stay. The " +
    "items after it move up one place.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: { params: ListItemParams },
  responses: {
    204: { description: "The List Item is removed" },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The List Item id isn't a positive integer (`invalid_request`)",
    },
    401: unauthenticatedResponse,
    404: unknownListItemResponse,
  },
});

export const listRoutes = new OpenAPIHono<AppEnv>();

listRoutes.openapi(backlogRoute, async (c) => {
  const { mediaType } = c.req.valid("query");
  return c.json({ backlog: await userBacklog(c.var.db, c.var.userId, mediaType) }, 200);
});

listRoutes.openapi(planRoute, async (c) => {
  const planned = await plan(c.var.db, c.var.userId, c.req.valid("json"), c.var.now);
  if (!planned.ok)
    return c.json({ error: planned.error }, planned.error === "backlog_full" ? 409 : 400);
  return c.json({ listItem: planned.listItem }, planned.created ? 201 : 200);
});

listRoutes.openapi(editRoute, async (c) => {
  const { listItemId } = c.req.valid("param");
  const edited = await editListItem(c.var.db, c.var.userId, listItemId, c.req.valid("json"));
  if (!edited) return c.json({ error: "unknown_list_item" }, 404);
  return c.json({ listItem: edited }, 200);
});

listRoutes.openapi(removeRoute, async (c) => {
  if (!(await removeListItem(c.var.db, c.var.userId, c.req.valid("param").listItemId))) {
    return c.json({ error: "unknown_list_item" }, 404);
  }
  return c.body(null, 204);
});
