// The logged-in User's own settings: their Display Name and their password, the new password
// that a Temporary Password requires, and deleting the User altogether.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  DisplayNameRequest,
  ErrorResponse,
  NewPasswordRequest,
  PasswordChangeRequest,
  UserDeletionRequest,
  UserResponse,
} from "../shared/api";
import {
  changePassword,
  deleteUser,
  replaceTemporaryPassword,
  setDisplayName,
} from "./accounts/accounts";
import {
  clearSessionCookie,
  requireSession,
  requireUser,
  unauthenticated,
  unauthenticatedResponse,
} from "./auth";
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

// The one route a session from a Temporary Password may use.
const newPasswordRoute = createRoute({
  method: "post",
  path: "/me/new-password",
  summary:
    "Set the logged-in User's own password in place of the Temporary Password the Operator issued, " +
    "ending their other sessions",
  middleware: [requireSession] as const,
  security: [{ session: [] }],
  request: {
    body: { content: { "application/json": { schema: NewPasswordRequest } }, required: true },
  },
  responses: {
    200: {
      content: { "application/json": { schema: UserResponse } },
      description:
        "The password is set and the session is no longer restricted; every other session of " +
        "the User's has ended",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        "The request body is malformed, the new password isn't 10–128 characters, or it is the " +
        "Temporary Password (`temporary_password_reused`)",
    },
    401: unauthenticatedResponse,
    409: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        "The User has no Temporary Password to replace (`password_change_not_required`); they " +
        "change their password with `POST /api/me/password`",
    },
  },
});

const deletionRoute = createRoute({
  method: "delete",
  path: "/me",
  summary:
    "Delete the logged-in User and everything they own, for good; Users they invited keep their " +
    "accounts",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  request: {
    body: { content: { "application/json": { schema: UserDeletionRequest } }, required: true },
  },
  responses: {
    204: {
      description:
        "The User is deleted with their Log Entries, Lists, List Items, Share Links, Manual Media " +
        "Items, Invite Codes and sessions; the response clears the session cookie",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The request body is malformed",
    },
    401: unauthenticatedResponse,
    403: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The password is wrong (`wrong_password`); nothing is deleted",
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

meRoutes.openapi(newPasswordRoute, async (c) => {
  const { db, userId, sessionToken } = c.var;
  const { newPassword } = c.req.valid("json");
  const replaced = await replaceTemporaryPassword(db, userId, sessionToken, newPassword);
  if (!replaced.ok) {
    const { error } = replaced;
    return error === "temporary_password_reused" ? c.json({ error }, 400) : c.json({ error }, 409);
  }
  return c.json({ user: replaced.user }, 200);
});

meRoutes.openapi(deletionRoute, async (c) => {
  const { password } = c.req.valid("json");
  if (!(await deleteUser(c.var.db, c.var.userId, password))) {
    return c.json({ error: "wrong_password" }, 403);
  }
  clearSessionCookie(c);
  return c.body(null, 204);
});
