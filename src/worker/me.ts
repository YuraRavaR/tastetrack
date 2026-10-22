// The logged-in User's own settings: their Display Name and their password.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  DisplayNameRequest,
  ErrorResponse,
  PasswordChangeRequest,
  UserResponse,
} from "../shared/api";
import { changePassword, setDisplayName } from "./accounts/accounts";
import { requireUser, unauthenticated, unauthenticatedResponse } from "./auth";
import type { AppEnv } from "./env";

const displayNameRoute = createRoute({
  method: "put",
  path: "/me/display-name",
  summary: "Set the logged-in User's Display Name, which others see on Share Links",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    body: { content: { "application/json": { schema: DisplayNameRequest } }, required: true },
  },
  responses: {
    200: {
      content: { "application/json": { schema: UserResponse } },
      description: "The User with their new Display Name",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The request body is malformed, or the Display Name is over 50 characters",
    },
    401: unauthenticatedResponse,
  },
});

const passwordRoute = createRoute({
  method: "post",
  path: "/me/password",
  summary: "Change the logged-in User's password, ending their other sessions",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    body: { content: { "application/json": { schema: PasswordChangeRequest } }, required: true },
  },
  responses: {
    204: {
      description: "The password is changed; every other session of the User's has ended",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The request body is malformed, or the new password isn't 10–128 characters",
    },
    401: unauthenticatedResponse,
    403: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The current password is wrong (`wrong_password`); nothing changed",
    },
  },
});

export const meRoutes = new OpenAPIHono<AppEnv>();

meRoutes.openapi(displayNameRoute, async (c) => {
  const { displayName } = c.req.valid("json");
  const user = await setDisplayName(c.var.db, c.var.userId, displayName);
  if (!user) return c.json(unauthenticated, 401);
  return c.json({ user }, 200);
});

meRoutes.openapi(passwordRoute, async (c) => {
  const { db, userId, sessionToken } = c.var;
  if (!(await changePassword(db, userId, sessionToken, c.req.valid("json")))) {
    return c.json({ error: "wrong_password" }, 403);
  }
  return c.body(null, 204);
});
