// The logged-in User's own account: their Display Name and their password.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  AccountEditRequest,
  ErrorResponse,
  PasswordChangeRequest,
  UserResponse,
} from "../shared/api";
import { changePassword, editAccount } from "./accounts/accounts";
import { requireUser, unauthenticatedResponse } from "./auth";
import type { AppEnv } from "./env";

const editRoute = createRoute({
  method: "patch",
  path: "/account",
  summary: "Change the logged-in User's Display Name",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    body: { content: { "application/json": { schema: AccountEditRequest } }, required: true },
  },
  responses: {
    200: {
      content: { "application/json": { schema: UserResponse } },
      description: "The User as changed",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The request body is malformed, or the Display Name is too long",
    },
    401: unauthenticatedResponse,
  },
});

const passwordRoute = createRoute({
  method: "post",
  path: "/account/password",
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

export const accountRoutes = new OpenAPIHono<AppEnv>();

accountRoutes.openapi(editRoute, async (c) => {
  const user = await editAccount(c.var.db, c.var.userId, c.req.valid("json"));
  if (!user) return c.json({ error: "unauthenticated" }, 401);
  return c.json({ user }, 200);
});

accountRoutes.openapi(passwordRoute, async (c) => {
  const { db, userId, sessionToken } = c.var;
  if (!(await changePassword(db, userId, sessionToken, c.req.valid("json")))) {
    return c.json({ error: "wrong_password" }, 403);
  }
  return c.body(null, 204);
});
