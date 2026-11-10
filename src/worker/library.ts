// The logged-in User's Library of a Media Type: what they plan to experience and what they have
// experienced, in one read, which the client sorts and filters.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ErrorResponse, LibraryQuery, LibraryResponse } from "../shared/api";
import { requireUser, unauthenticatedResponse } from "./auth";
import { fillMissingMetadata } from "./catalog/media-items";
import type { AppEnv } from "./env";
import { userLibrary } from "./library/user-library";

const libraryRoute = createRoute({
  method: "get",
  path: "/library",
  summary: "Show the logged-in User's Library of a Media Type",
  description:
    "Every Media Item of the type that is in the User's Backlog or has at least one of their Log " +
    "Entries, each once: whether it is in the Backlog and since when, and, once logged, its " +
    "Current Rating and the date of the last Log Entry in Log Order. In no particular order, " +
    "and not paged.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: { query: LibraryQuery },
  responses: {
    200: {
      content: { "application/json": { schema: LibraryResponse } },
      description: "The Library's Media Items",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The Media Type is unknown (`invalid_request`)",
    },
    401: unauthenticatedResponse,
  },
});

export const libraryRoutes = new OpenAPIHono<AppEnv>();

libraryRoutes.openapi(libraryRoute, async (c) => {
  const { mediaType } = c.req.valid("query");
  const items = await userLibrary(c.var.db, c.var.userId, mediaType, c.var.now);
  const mediaItems = items.map((item) => item.mediaItem);
  await fillMissingMetadata(c.var.db, c.env, mediaItems, c.var.now);
  return c.json({ items }, 200);
});
