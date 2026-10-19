// Searching the catalog and adding to it: the External Source of the Media Type, TMDB for films.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  AddCatalogItemRequest,
  CatalogSearchQuery,
  CatalogSearchResponse,
  ErrorResponse,
  MediaItemResponse,
} from "../shared/api";
import { maxSearchQueryLength } from "../shared/catalog";
import { requireUser, unauthenticatedResponse } from "./auth";
import { addFromSearch } from "./catalog/media-items";
import { searchFilms, type TmdbConfig, TmdbUnavailable } from "./catalog/tmdb";
import type { AppEnv } from "./env";
import { loggedExternalIds } from "./log/log-entries";

const searchRoute = createRoute({
  method: "get",
  path: "/catalog/search",
  summary: "Search the catalog by title, in English or Ukrainian",
  description:
    "One TMDB search in the query's language: uk-UA when the query has a Cyrillic letter, " +
    "otherwise en-US. Results come in TMDB's order, titled in that language, and marked when " +
    "the User has a Log Entry for them.",
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

function tmdbConfig(env: Env): TmdbConfig {
  return { baseUrl: env.TMDB_BASE_URL, accessToken: env.TMDB_ACCESS_TOKEN };
}

export const catalogRoutes = new OpenAPIHono<AppEnv>();

catalogRoutes.openapi(searchRoute, async (c) => {
  const { mediaType, query } = c.req.valid("query");
  let matches: Awaited<ReturnType<typeof searchFilms>>;
  try {
    matches = await searchFilms(tmdbConfig(c.env), query);
  } catch (error) {
    if (!(error instanceof TmdbUnavailable)) throw error;
    console.error(error);
    return c.json({ error: "catalog_unavailable" }, 502);
  }
  const logged = await loggedExternalIds(
    c.var.db,
    c.var.userId,
    "tmdb",
    mediaType,
    matches.map((match) => match.externalReference.id),
  );
  const results = matches.map((match) => ({
    ...match,
    inLog: logged.has(match.externalReference.id),
  }));
  return c.json({ results }, 200);
});

catalogRoutes.openapi(addRoute, async (c) => {
  const added = await addFromSearch(c.var.db, tmdbConfig(c.env), c.req.valid("json"), c.var.now);
  return c.json({ mediaItem: added.mediaItem }, added.created ? 201 : 200);
});
