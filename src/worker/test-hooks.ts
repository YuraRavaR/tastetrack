// Test-only routes, mounted under /api/test. They stay out of the OpenAPI spec, and with test
// hooks off the whole prefix falls through to the JSON 404.
import { z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { tmdbCache } from "../db/schema";
import { type ErrorResponse, Password, Username } from "../shared/api";
import { maxManualMediaItems } from "../shared/catalog";
import { maxListItems } from "../shared/lists";
import { createUser, deleteUser, inviterOf, passwordIterationsOf } from "./accounts/accounts";
import { refreshCache } from "./catalog/cache-refresh";
import { fillManualMediaItems } from "./catalog/manual-media-items";
import { tmdbFake } from "./catalog/tmdb-fake";
import { type AppEnv, testHooksOn, tmdbConfig } from "./env";
import { fillBacklog } from "./lists/backlog";
import { fillList } from "./lists/list-items";
import { simulateLogin } from "./pbkdf2-spike";

export const testHooks = new Hono<AppEnv>();

testHooks.use(async (c, next) => {
  if (!testHooksOn(c.env)) return c.notFound();
  await next();
});

// Staging is public: well past the 10 ms budget, but not a way to burn CPU at will.
const maxSpikeIterations = 1_000_000;

testHooks.get("/pbkdf2", async (c) => {
  const iterations = Number(c.req.query("iterations"));
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > maxSpikeIterations) {
    return c.json({ error: "invalid_iterations" } satisfies ErrorResponse, 400);
  }
  const derivedKey = await simulateLogin(c.var.db, iterations);
  return c.json({ iterations, derivedKey }, 200);
});

// Creates seed Users, who need no Invite Code. Test factories use one per worker to issue the
// Invite Codes that every other test User registers with. Test hooks are off in production, so
// seed Users exist only in local and staging.
const NewTestUser = z.object({
  username: Username,
  password: Password,
  passwordIterations: z.int().min(1).max(100_000).optional(),
});

testHooks.post("/users", async (c) => {
  const body = NewTestUser.safeParse(await c.req.json().catch(() => undefined));
  if (!body.success) return c.json({ error: "invalid_request" } satisfies ErrorResponse, 400);
  const user = await createUser(c.var.db, body.data, c.var.now);
  if (!user) return c.json({ error: "username_taken" } satisfies ErrorResponse, 409);
  return c.json({ user }, 201);
});

testHooks.delete("/users/:username", async (c) => {
  if (!(await deleteUser(c.var.db, c.req.param("username")))) return c.notFound();
  return c.body(null, 204);
});

testHooks.get("/users/:username/password-iterations", async (c) => {
  const iterations = await passwordIterationsOf(c.var.db, c.req.param("username"));
  if (iterations === null) return c.notFound();
  return c.json({ iterations }, 200);
});

testHooks.get("/users/:username/invited-by", async (c) => {
  const invitedBy = await inviterOf(c.var.db, c.req.param("username"));
  if (invitedBy === undefined) return c.notFound();
  return c.json({ invitedBy }, 200);
});

// Plans placeholder films for a User, or adds them to a List, so tests reach the limit without
// adding a thousand films through search.
const ListFill = z.object({ count: z.int().min(1).max(maxListItems) });

testHooks.post("/users/:username/backlog", async (c) => {
  const body = ListFill.safeParse(await c.req.json().catch(() => undefined));
  if (!body.success) return c.json({ error: "invalid_request" } satisfies ErrorResponse, 400);
  if (!(await fillBacklog(c.var.db, c.req.param("username"), body.data.count, c.var.now))) {
    return c.notFound();
  }
  return c.body(null, 204);
});

testHooks.post("/lists/:listId/items", async (c) => {
  const listId = Number(c.req.param("listId"));
  const body = ListFill.safeParse(await c.req.json().catch(() => undefined));
  if (!Number.isInteger(listId) || !body.success) {
    return c.json({ error: "invalid_request" } satisfies ErrorResponse, 400);
  }
  if (!(await fillList(c.var.db, listId, body.data.count, c.var.now))) return c.notFound();
  return c.body(null, 204);
});

// Adds placeholder Manual Media Items for a User, so tests reach the limit without making a
// thousand one by one.
const ManualFill = z.object({ count: z.int().min(1).max(maxManualMediaItems) });

testHooks.post("/users/:username/manual-items", async (c) => {
  const body = ManualFill.safeParse(await c.req.json().catch(() => undefined));
  if (!body.success) return c.json({ error: "invalid_request" } satisfies ErrorResponse, 400);
  const filled = await fillManualMediaItems(
    c.var.db,
    c.req.param("username"),
    body.data.count,
    c.var.now,
  );
  if (!filled) return c.notFound();
  return c.body(null, 204);
});

// Runs the Cron Trigger's TMDB cache refresh now, at the request's time, so tests needn't wait
// for the schedule.
testHooks.post("/cron", async (c) => {
  return c.json(await refreshCache(c.var.db, tmdbConfig(c.env), c.var.now), 200);
});

// Takes one film out of the TMDB cache, as the cron does once an entry expires, so tests can
// see a page on a cold cache.
testHooks.delete("/tmdb-cache/:mediaType/:externalId", async (c) => {
  const { mediaType, externalId } = c.req.param();
  if (mediaType !== "film") return c.notFound();
  await c.var.db
    .delete(tmdbCache)
    .where(and(eq(tmdbCache.mediaType, mediaType), eq(tmdbCache.externalId, externalId)));
  return c.body(null, 204);
});

// The TMDB fake that the `local` Worker searches (wrangler.jsonc).
testHooks.route("/tmdb", tmdbFake);
