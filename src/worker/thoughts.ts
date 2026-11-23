// The logged-in User's Thoughts: keeping one on a Media Item, changing it and deleting it. The Item
// History route shows them.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  ErrorResponse,
  MediaItemParams,
  NewThoughtRequest,
  ThoughtEditRequest,
  ThoughtParams,
  ThoughtResponse,
} from "../shared/api";
import { maxPage } from "../shared/progress";
import { maxThoughtLength, maxThoughtsPerMediaItem } from "../shared/thoughts";
import { requireUser, unauthenticatedResponse } from "./auth";
import type { AppEnv } from "./env";
import { createThought, deleteThought, editThought } from "./log/thoughts";

const rules =
  `the text, trimmed, is empty or longer than ${maxThoughtLength} characters ` +
  "(`invalid_request`), the date isn't a calendar date, is before 1900-01-01 or after today in " +
  "the User's time zone (`invalid_date`, `date_too_early`, `date_in_future`), the Progress is of " +
  "another Media Type, or the Media Item's Media Type has none (`progress_mismatch`), the Media " +
  "Item is of a light Media Type, a song, which has no Thoughts (`wrong_media_type`), or a " +
  "series' season isn't a whole number from 1 or its episode a whole number from 0, or a book's " +
  `page isn't a whole number from 0 to ${maxPage}, its page count one from 1 to ${maxPage}, or ` +
  "the page is past the page count (`invalid_progress`)";

const unknownThoughtResponse = {
  content: { "application/json": { schema: ErrorResponse } },
  description: "The User has no such Thought (`unknown_thought`)",
};

const newThoughtRoute = createRoute({
  method: "post",
  path: "/catalog/items/{mediaItemId}/thoughts",
  summary: "Keep a Thought on a Media Item",
  description:
    "Keeps the User's own dated note or quote on any Media Item they may see, whether or not it " +
    "is in their Library, and changes nothing else: not the Backlog, In Progress or the Library. " +
    "The state is the one the Media Item is in for the User now: `in_progress` over " +
    "`experienced` (at least one Log Entry) over `planned` (on the Backlog), otherwise `none`. " +
    "The Progress is kept as given, checked for shape and range only. Thoughts are private: no " +
    "Share Link or Library carries them.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    params: MediaItemParams,
    body: { content: { "application/json": { schema: NewThoughtRequest } }, required: true },
  },
  responses: {
    201: {
      content: { "application/json": { schema: ThoughtResponse } },
      description: "The new Thought",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: `The request is malformed, or ${rules}`,
    },
    401: unauthenticatedResponse,
    404: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "There is no such Media Item (`unknown_media_item`)",
    },
    409: {
      content: { "application/json": { schema: ErrorResponse } },
      description: `The User has ${maxThoughtsPerMediaItem} Thoughts on the Media Item already (\`too_many_thoughts\`)`,
    },
  },
});

const editRoute = createRoute({
  method: "patch",
  path: "/thoughts/{thoughtId}",
  summary: "Change a Thought",
  description:
    "Changes only the fields given, by the same rules as a new Thought; a null Progress clears " +
    "it. The state and the creation time never change.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    params: ThoughtParams,
    body: { content: { "application/json": { schema: ThoughtEditRequest } }, required: true },
  },
  responses: {
    200: {
      content: { "application/json": { schema: ThoughtResponse } },
      description: "The changed Thought",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: `The request is malformed or names a field that can't be changed, or ${rules}`,
    },
    401: unauthenticatedResponse,
    404: unknownThoughtResponse,
  },
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/thoughts/{thoughtId}",
  summary: "Delete a Thought",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: { params: ThoughtParams },
  responses: {
    204: { description: "The Thought is deleted" },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The Thought id isn't a positive integer (`invalid_request`)",
    },
    401: unauthenticatedResponse,
    404: unknownThoughtResponse,
  },
});

export const thoughtRoutes = new OpenAPIHono<AppEnv>();

thoughtRoutes.openapi(newThoughtRoute, async (c) => {
  const { mediaItemId } = c.req.valid("param");
  const created = await createThought(
    c.var.db,
    c.var.userId,
    mediaItemId,
    c.req.valid("json"),
    c.var.now,
  );
  if (created.ok) return c.json({ thought: created.thought }, 201);
  if (created.error === "unknown_media_item") return c.json({ error: created.error }, 404);
  if (created.error === "too_many_thoughts") return c.json({ error: created.error }, 409);
  return c.json({ error: created.error }, 400);
});

thoughtRoutes.openapi(editRoute, async (c) => {
  const { thoughtId } = c.req.valid("param");
  const edited = await editThought(
    c.var.db,
    c.var.userId,
    thoughtId,
    c.req.valid("json"),
    c.var.now,
  );
  if (edited.ok) return c.json({ thought: edited.thought }, 200);
  if (edited.error === "unknown_thought") return c.json({ error: edited.error }, 404);
  return c.json({ error: edited.error }, 400);
});

thoughtRoutes.openapi(deleteRoute, async (c) => {
  if (!(await deleteThought(c.var.db, c.var.userId, c.req.valid("param").thoughtId))) {
    return c.json({ error: "unknown_thought" }, 404);
  }
  return c.body(null, 204);
});
