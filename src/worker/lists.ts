// The logged-in User's Backlog and own Lists: reading them, marking Media Items Planned, making,
// renaming and deleting Lists and adding to them, and reordering, noting and removing List Items.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  BacklogQuery,
  BacklogResponse,
  ErrorResponse,
  ListEditRequest,
  ListItemEditRequest,
  ListItemParams,
  ListItemResponse,
  ListParams,
  ListResponse,
  ListSummaryResponse,
  ListsResponse,
  NewListItemRequest,
  NewListRequest,
  PlanRequest,
} from "../shared/api";
import { maxListItems, maxLists } from "../shared/lists";
import { requireUser, unauthenticatedResponse } from "./auth";
import type { AppEnv } from "./env";
import { plan, userBacklog } from "./lists/backlog";
import {
  addToList,
  createList,
  deleteList,
  editList,
  userList,
  userLists,
} from "./lists/custom-lists";
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

const listsRoute = createRoute({
  method: "get",
  path: "/lists",
  summary: "Show the logged-in User's own Lists, oldest first",
  description: "Each List comes without its items, with how many it holds. The Backlog isn't one.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: ListsResponse } },
      description: "The User's Lists",
    },
    401: unauthenticatedResponse,
  },
});

const createListRoute = createRoute({
  method: "post",
  path: "/lists",
  summary: "Make a List of one Media Type",
  description:
    "The new List is private and empty. Its Media Type is set here, and only Media Items of that " +
    "type can go in.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    body: { content: { "application/json": { schema: NewListRequest } }, required: true },
  },
  responses: {
    201: {
      content: { "application/json": { schema: ListSummaryResponse } },
      description: "The new List",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        "The request body is malformed, or the name is reserved for a Backlog " +
        "(`invalid_request`, `list_name_reserved`)",
    },
    401: unauthenticatedResponse,
    409: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        "Another of the User's Lists has the same name, regardless of case, or the User already " +
        `has ${maxLists} Lists (\`list_name_taken\`, \`too_many_lists\`)`,
    },
  },
});

const unknownListResponse = {
  content: { "application/json": { schema: ErrorResponse } },
  description: "The User has no such List (`unknown_list`)",
};

const listRoute = createRoute({
  method: "get",
  path: "/lists/{listId}",
  summary: "Show one of the logged-in User's Lists and its List Items, in order",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: { params: ListParams },
  responses: {
    200: {
      content: { "application/json": { schema: ListResponse } },
      description: "The List and its List Items in order",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The List id isn't a positive integer (`invalid_request`)",
    },
    401: unauthenticatedResponse,
    404: unknownListResponse,
  },
});

const editListRoute = createRoute({
  method: "patch",
  path: "/lists/{listId}",
  summary: "Rename one of the logged-in User's Lists, or change its description",
  description:
    "Changes only the fields given, by the same rules as making a List. A null or empty " +
    "description clears it. The Media Type can't change.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    params: ListParams,
    body: { content: { "application/json": { schema: ListEditRequest } }, required: true },
  },
  responses: {
    200: {
      content: { "application/json": { schema: ListSummaryResponse } },
      description: "The List as it now is",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        "The request body is malformed or names a field that can't be edited, or the name is " +
        "reserved for a Backlog (`invalid_request`, `list_name_reserved`)",
    },
    401: unauthenticatedResponse,
    404: unknownListResponse,
    409: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        "Another of the User's Lists has the name, regardless of case (`list_name_taken`)",
    },
  },
});

const deleteListRoute = createRoute({
  method: "delete",
  path: "/lists/{listId}",
  summary: "Delete one of the logged-in User's Lists",
  description:
    "Deletes the List and its List Items only: their Media Items and the User's Log Entries " +
    "for them stay. The Backlog can't be deleted.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: { params: ListParams },
  responses: {
    204: { description: "The List is deleted" },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The List id isn't a positive integer (`invalid_request`)",
    },
    401: unauthenticatedResponse,
    404: unknownListResponse,
  },
});

const addToListRoute = createRoute({
  method: "post",
  path: "/lists/{listId}/items",
  summary: "Add a Media Item to one of the logged-in User's Lists",
  description:
    "Adds the Media Item at the end of the List, or at `position` when given. A Media Item " +
    "already in the List is refused, and so is one of another Media Type than the List's.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    params: ListParams,
    body: { content: { "application/json": { schema: NewListItemRequest } }, required: true },
  },
  responses: {
    201: {
      content: { "application/json": { schema: ListItemResponse } },
      description: "The Media Item's new List Item",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        "The request is malformed, the Media Item doesn't exist, or it is of another Media " +
        "Type than the List (`invalid_request`, `unknown_media_item`, `wrong_media_type`)",
    },
    401: unauthenticatedResponse,
    404: unknownListResponse,
    409: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        `The Media Item is in the List already, or the List holds ${maxListItems} items ` +
        "(`already_in_list`, `list_full`)",
    },
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

listRoutes.openapi(listsRoute, async (c) => {
  return c.json({ lists: await userLists(c.var.db, c.var.userId) }, 200);
});

listRoutes.openapi(createListRoute, async (c) => {
  const created = await createList(c.var.db, c.var.userId, c.req.valid("json"), c.var.now);
  if (!created.ok) {
    return c.json({ error: created.error }, created.error === "list_name_reserved" ? 400 : 409);
  }
  return c.json({ list: created.list }, 201);
});

listRoutes.openapi(listRoute, async (c) => {
  const list = await userList(c.var.db, c.var.userId, c.req.valid("param").listId);
  if (!list) return c.json({ error: "unknown_list" }, 404);
  return c.json({ list }, 200);
});

listRoutes.openapi(editListRoute, async (c) => {
  const { listId } = c.req.valid("param");
  const edited = await editList(c.var.db, c.var.userId, listId, c.req.valid("json"));
  if (!edited.ok) return c.json({ error: edited.error }, editListStatus[edited.error]);
  return c.json({ list: edited.list }, 200);
});

listRoutes.openapi(deleteListRoute, async (c) => {
  if (!(await deleteList(c.var.db, c.var.userId, c.req.valid("param").listId))) {
    return c.json({ error: "unknown_list" }, 404);
  }
  return c.body(null, 204);
});

const editListStatus = {
  unknown_list: 404,
  list_name_reserved: 400,
  list_name_taken: 409,
} as const;

const addToListStatus = {
  unknown_list: 404,
  unknown_media_item: 400,
  wrong_media_type: 400,
  already_in_list: 409,
  list_full: 409,
} as const;

listRoutes.openapi(addToListRoute, async (c) => {
  const { listId } = c.req.valid("param");
  const added = await addToList(c.var.db, c.var.userId, listId, c.req.valid("json"), c.var.now);
  if (!added.ok) return c.json({ error: added.error }, addToListStatus[added.error]);
  return c.json({ listItem: added.listItem }, 201);
});
