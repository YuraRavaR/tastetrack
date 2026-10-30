// Searching the catalog and adding to it: the External Source of the Media Type, TMDB for films.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  AddCatalogItemRequest,
  CatalogSearchQuery,
  CatalogSearchResponse,
  ErrorResponse,
  ManualMediaItemEditRequest,
  ManualMediaItemResponse,
  MediaItemIdsQuery,
  MediaItemParams,
  MediaItemResponse,
  MediaItemsResponse,
  NewManualMediaItemRequest,
} from "../shared/api";
import {
  earliestFilmYear,
  maxManualMediaItems,
  maxManualSearchResults,
  maxMetadataFills,
  maxSearchQueryLength,
} from "../shared/catalog";
import { requireUser, unauthenticatedResponse } from "./auth";
import {
  createManualMediaItem,
  deleteManualMediaItem,
  editManualMediaItem,
  manualMediaItemUsage,
  manualSearch,
} from "./catalog/manual-media-items";
import { addFromSearch, catalogMediaItems, mediaItemIdsByExternalId } from "./catalog/media-items";
import { searchFilms, TmdbUnavailable } from "./catalog/tmdb";
import { type AppEnv, tmdbConfig } from "./env";
import { plannedExternalIds } from "./lists/backlog";
import { loggedExternalIds } from "./log/log-entries";

const searchRoute = createRoute({
  method: "get",
  path: "/catalog/search",
  summary: "Search the catalog by title, in English or Ukrainian",
  description:
    "One TMDB search in the query's language: uk-UA when the query has a Cyrillic letter, " +
    "otherwise en-US. Results come in TMDB's order, titled in that language, with their Media " +
    "Item's id once they are in the catalog, and marked when the User has a Log Entry for them " +
    "and when they are in the User's Backlog. Before them, to be listed first, come up to " +
    `${maxManualSearchResults} of the User's own Manual Media Items whose title or Original ` +
    "Title contains the query, regardless of case, in title order and marked the same way.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: { query: CatalogSearchQuery },
  responses: {
    200: {
      content: { "application/json": { schema: CatalogSearchResponse } },
      description: "The first page of matches",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: `The query is empty or longer than ${maxSearchQueryLength} characters, or the Media Type unknown`,
    },
    401: unauthenticatedResponse,
    502: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The External Source didn't answer (`catalog_unavailable`)",
    },
  },
});

const addRoute = createRoute({
  method: "post",
  path: "/catalog/items",
  summary: "Add a search result to the catalog, or find it there",
  description:
    "Makes the catalog-backed Media Item for the result's External Reference, or finds the one " +
    "that exists, and fills its metadata with one TMDB details call. If that call fails, the " +
    "result is added anyway, with the metadata the search result carries.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    body: { content: { "application/json": { schema: AddCatalogItemRequest } }, required: true },
  },
  responses: {
    200: {
      content: { "application/json": { schema: MediaItemResponse } },
      description: "The Media Item already existed",
    },
    201: {
      content: { "application/json": { schema: MediaItemResponse } },
      description: "The Media Item is new",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The request body is malformed",
    },
    401: unauthenticatedResponse,
  },
});

const itemsRoute = createRoute({
  method: "get",
  path: "/catalog/items",
  summary: "Show catalog-backed Media Items by id, filling metadata the cache is missing",
  description:
    `A page fills the metadata of at most ${maxMetadataFills} films missing from the TMDB ` +
    "cache and shows the rest without it; the client loads those here, up to " +
    `${maxMetadataFills} at a time, each with one TMDB details call. A film TMDB doesn't ` +
    "answer for keeps null metadata. Catalog-backed Media Items are no one's, so this needs no " +
    "login; Manual Media Items, and ids that match nothing, are left out.",
  request: { query: MediaItemIdsQuery },
  responses: {
    200: {
      content: { "application/json": { schema: MediaItemsResponse } },
      description: "The catalog-backed Media Items among the ids, in the order given",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        `The ids aren't 1 to ${maxMetadataFills} comma-separated positive integers ` +
        "(`invalid_request`)",
    },
  },
});

const createManualRoute = createRoute({
  method: "post",
  path: "/catalog/manual-items",
  summary: "Add a Media Item by hand, as a Manual Media Item",
  description:
    "For works the External Source doesn't have. The Manual Media Item has no External " +
    "Reference, belongs to the logged-in User and is visible to them alone. It needs a title, " +
    "and can have an Original Title, year, runtime and genres.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    body: {
      content: { "application/json": { schema: NewManualMediaItemRequest } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: MediaItemResponse } },
      description: "The new Manual Media Item",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        "The request body is malformed, or a value is implausible: a title of 1–200 " +
        `characters, a year from ${earliestFilmYear} to five years from now, a runtime of ` +
        "1–1000 minutes and TMDB's film genres, each once (`invalid_request`)",
    },
    401: unauthenticatedResponse,
    409: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        "Another of the User's Manual Media Items has the same title, regardless of case, and " +
        "the same year, and `allowDuplicate` isn't set, or the User already has " +
        `${maxManualMediaItems} (\`possible_duplicate\`, \`too_many_manual_media_items\`)`,
    },
  },
});

const unknownManualResponse = {
  content: { "application/json": { schema: ErrorResponse } },
  description: "The User has no such Manual Media Item (`unknown_media_item`)",
};

const editManualRoute = createRoute({
  method: "patch",
  path: "/catalog/manual-items/{mediaItemId}",
  summary: "Edit one of the logged-in User's Manual Media Items",
  description:
    "Changes only the fields given, by the same rules as a new one; a null or empty Original " +
    "Title, or a null year or runtime, clears it. A catalog-backed Media Item can't be edited.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    params: MediaItemParams,
    body: {
      content: { "application/json": { schema: ManualMediaItemEditRequest } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: MediaItemResponse } },
      description: "The Manual Media Item as it now is",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        "The request body is malformed, names a field that can't be edited, or a value is " +
        "implausible, by the same rules as a new one (`invalid_request`)",
    },
    401: unauthenticatedResponse,
    404: unknownManualResponse,
  },
});

const manualRoute = createRoute({
  method: "get",
  path: "/catalog/manual-items/{mediaItemId}",
  summary: "Show one of the logged-in User's Manual Media Items, and what deleting it would delete",
  description:
    "Says how many of the User's Log Entries and List Items, the Backlog's included, the Manual " +
    "Media Item has, so the User can be told before deleting it.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: { params: MediaItemParams },
  responses: {
    200: {
      content: { "application/json": { schema: ManualMediaItemResponse } },
      description: "The Manual Media Item and how many Log Entries and List Items it has",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The Media Item id isn't a positive integer (`invalid_request`)",
    },
    401: unauthenticatedResponse,
    404: unknownManualResponse,
  },
});

const deleteManualRoute = createRoute({
  method: "delete",
  path: "/catalog/manual-items/{mediaItemId}",
  summary: "Delete one of the logged-in User's Manual Media Items",
  description:
    "Deletes the Manual Media Item with every Log Entry and List Item, the Backlog's included, " +
    "it has. A catalog-backed Media Item can't be deleted.",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: { params: MediaItemParams },
  responses: {
    204: { description: "The Manual Media Item is deleted, with its Log Entries and List Items" },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The Media Item id isn't a positive integer (`invalid_request`)",
    },
    401: unauthenticatedResponse,
    404: unknownManualResponse,
  },
});

export const catalogRoutes = new OpenAPIHono<AppEnv>();

catalogRoutes.openapi(searchRoute, async (c) => {
  const { mediaType, query } = c.req.valid("query");
  const manual = manualSearch(c.var.db, c.var.userId, mediaType, query);
  let matches: Awaited<ReturnType<typeof searchFilms>>;
  try {
    matches = await searchFilms(tmdbConfig(c.env), query);
  } catch (error) {
    // Settled, so its outcome isn't an unhandled rejection.
    await manual.catch(() => undefined);
    if (!(error instanceof TmdbUnavailable)) throw error;
    console.error(error);
    return c.json({ error: "catalog_unavailable" }, 502);
  }
  const ids = matches.map((match) => match.externalReference.id);
  const [manualResults, mediaItemIds, logged, planned] = await Promise.all([
    manual,
    mediaItemIdsByExternalId(c.var.db, "tmdb", mediaType, ids),
    loggedExternalIds(c.var.db, c.var.userId, "tmdb", mediaType, ids),
    plannedExternalIds(c.var.db, c.var.userId, "tmdb", mediaType, ids),
  ]);
  const results = matches.map((match) => ({
    ...match,
    mediaItemId: mediaItemIds.get(match.externalReference.id) ?? null,
    inLog: logged.has(match.externalReference.id),
    inBacklog: planned.has(match.externalReference.id),
  }));
  return c.json({ manualResults, results }, 200);
});

catalogRoutes.openapi(addRoute, async (c) => {
  const added = await addFromSearch(c.var.db, tmdbConfig(c.env), c.req.valid("json"), c.var.now);
  return c.json({ mediaItem: added.mediaItem }, added.created ? 201 : 200);
});

catalogRoutes.openapi(itemsRoute, async (c) => {
  const { ids } = c.req.valid("query");
  const mediaItems = await catalogMediaItems(c.var.db, tmdbConfig(c.env), ids, c.var.now);
  return c.json({ mediaItems }, 200);
});

catalogRoutes.openapi(createManualRoute, async (c) => {
  const created = await createManualMediaItem(
    c.var.db,
    c.var.userId,
    c.req.valid("json"),
    c.var.now,
  );
  if (!created.ok) {
    return c.json({ error: created.error }, created.error === "invalid_request" ? 400 : 409);
  }
  return c.json({ mediaItem: created.mediaItem }, 201);
});

catalogRoutes.openapi(editManualRoute, async (c) => {
  const edited = await editManualMediaItem(
    c.var.db,
    c.var.userId,
    c.req.valid("param").mediaItemId,
    c.req.valid("json"),
    c.var.now,
  );
  if (edited.ok) return c.json({ mediaItem: edited.mediaItem }, 200);
  return c.json({ error: edited.error }, edited.error === "unknown_media_item" ? 404 : 400);
});

catalogRoutes.openapi(manualRoute, async (c) => {
  const found = await manualMediaItemUsage(
    c.var.db,
    c.var.userId,
    c.req.valid("param").mediaItemId,
  );
  if (!found) return c.json({ error: "unknown_media_item" }, 404);
  return c.json(found, 200);
});

catalogRoutes.openapi(deleteManualRoute, async (c) => {
  const { mediaItemId } = c.req.valid("param");
  if (!(await deleteManualMediaItem(c.var.db, c.var.userId, mediaItemId))) {
    return c.json({ error: "unknown_media_item" }, 404);
  }
  return c.body(null, 204);
});
