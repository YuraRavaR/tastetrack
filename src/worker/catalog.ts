// Searching the catalog: the External Source of the Media Type, TMDB for films.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { CatalogSearchQuery, CatalogSearchResponse, ErrorResponse } from "../shared/api";
import { requireUser } from "./auth";
import { searchFilms, TmdbUnavailable } from "./catalog/tmdb";
import type { AppEnv } from "./env";

const searchRoute = createRoute({
  method: "get",
  path: "/catalog/search",
  summary: "Search the catalog by title, in English or Ukrainian",
  description:
    "One TMDB search in the query's language: uk-UA when the query has a Cyrillic letter, " +
    "otherwise en-US. Results come in TMDB's order, titled in that language.",
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
      description: "The query is empty or longer than 100 characters, or the Media Type unknown",
    },
    401: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "No live session",
    },
    502: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The External Source didn't answer (`catalog_unavailable`)",
    },
  },
});

export const catalogRoutes = new OpenAPIHono<AppEnv>();

catalogRoutes.openapi(searchRoute, async (c) => {
  const { query } = c.req.valid("query");
  const config = { baseUrl: c.env.TMDB_BASE_URL, accessToken: c.env.TMDB_ACCESS_TOKEN };
  try {
    return c.json({ results: await searchFilms(config, query) }, 200);
  } catch (error) {
    if (!(error instanceof TmdbUnavailable)) throw error;
    console.error(error);
    return c.json({ error: "catalog_unavailable" }, 502);
  }
});
