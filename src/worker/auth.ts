// Registration, login, logout and the current User, over a session cookie.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import {
  ErrorResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  type User,
  UserResponse,
} from "../shared/api";
import { authenticate, logIn, logOut, register, sessionLifetimeMs } from "./accounts/accounts";
import type { AppEnv } from "./env";

const SESSION_COOKIE = "session";

// Re-sent with every authenticated response, so the browser keeps it as long as the server does.
function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: sessionLifetimeMs / 1000,
  });
}

export const unauthenticated = { error: "unauthenticated" } satisfies ErrorResponse;

// The 401 that every route behind requireUser documents.
export const unauthenticatedResponse = {
  content: { "application/json": { schema: ErrorResponse } },
  description: "No live session",
};

export const passwordChangeRequired = {
  error: "password_change_required",
} satisfies ErrorResponse;

// Refuses the request with a 401 unless it carries a live session, and makes `c.var.user` the
// session's User, `c.var.userId` their id and `c.var.sessionToken` the session's token. A session
// from a Temporary Password is refused with a 403 too, unless `forPasswordChange`.
function sessionMiddleware({ forPasswordChange }: { forPasswordChange: boolean }) {
  return createMiddleware<
    AppEnv & { Variables: { user: User; userId: number; sessionToken: string } }
  >(async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    const authenticated = token ? await authenticate(c.var.db, token, c.var.now) : null;
    if (!token || !authenticated) return c.json(unauthenticated, 401);
    setSessionCookie(c, token);
    if (authenticated.passwordChangeRequired && !forPasswordChange) {
      return c.json(passwordChangeRequired, 403);
    }
    c.set("user", authenticated.user);
    c.set("userId", authenticated.userId);
    c.set("sessionToken", token);
    await next();
  });
}

// Every route for a logged-in User sits behind this.
export const requireUser = sessionMiddleware({ forPasswordChange: false });

// Only for setting the new password a Temporary Password requires: it lets that session through.
export const requireSession = sessionMiddleware({ forPasswordChange: true });

const registerRoute = createRoute({
  method: "post",
  path: "/auth/register",
  summary: "Register a new User with an Invite Code, starting a session",
  request: {
    body: { content: { "application/json": { schema: RegisterRequest } }, required: true },
  },
  responses: {
    201: {
      content: { "application/json": { schema: UserResponse } },
      description: "Registered and logged in; the response sets the session cookie",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description:
        "The request body is malformed, or the Invite Code is unknown, used or expired " +
        "(`invite_code_unknown`, `invite_code_used`, `invite_code_expired`)",
    },
    409: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The Username is taken, in any letter case (`username_taken`)",
    },
  },
});

const loginRoute = createRoute({
  method: "post",
  path: "/auth/login",
  summary: "Log in with a Username and password, starting a session",
  request: {
    body: { content: { "application/json": { schema: LoginRequest } }, required: true },
  },
  responses: {
    200: {
      content: { "application/json": { schema: LoginResponse } },
      description:
        "Logged in; the response sets the session cookie. With a Temporary Password, the " +
        "session can only set a new one (`passwordChangeRequired`)",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The request body is malformed",
    },
    401: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The Username is unknown or the password is wrong; the two aren't told apart",
    },
    429: {
      headers: {
        "Retry-After": {
          schema: { type: "integer" },
          description: "Seconds until the lockout ends",
        },
      },
      content: { "application/json": { schema: ErrorResponse } },
      description:
        "5 logins for this Username from this IP failed, so further attempts from it are " +
        "refused for 15 minutes (`too_many_attempts`); an unknown Username locks the same way",
    },
  },
});

const logoutRoute = createRoute({
  method: "post",
  path: "/auth/logout",
  summary: "Log out, ending the session on the server",
  responses: {
    204: { description: "The session, if any, is ended and the cookie cleared" },
  },
});

const meRoute = createRoute({
  method: "get",
  path: "/auth/me",
  summary: "Get the logged-in User",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: UserResponse } },
      description: "The session's User",
    },
    401: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "No live session",
    },
  },
});

export const auth = new OpenAPIHono<AppEnv>();

auth.openAPIRegistry.registerComponent("securitySchemes", "session", {
  type: "apiKey",
  in: "cookie",
  name: SESSION_COOKIE,
  description:
    "The session cookie that login and registration set. A session from a Temporary Password " +
    "the Operator issued can only set a new password (`POST /api/me/new-password`); every other " +
    "route refuses it with a 403 `password_change_required`.",
});

auth.openapi(registerRoute, async (c) => {
  const registration = await register(c.var.db, c.req.valid("json"), c.var.now);
  if (!registration.ok) {
    const { error } = registration;
    return error === "username_taken" ? c.json({ error }, 409) : c.json({ error }, 400);
  }
  setSessionCookie(c, registration.loggedIn.token);
  return c.json({ user: registration.loggedIn.user }, 201);
});

// Cloudflare sets CF-Connecting-IP on every request, replacing any the client sent, so unlike
// X-Forwarded-For it can't be forged. Only outside Cloudflare can it be missing, and such requests
// then share one IP.
function clientIp(c: Context): string {
  return c.req.header("CF-Connecting-IP") ?? "";
}

auth.openapi(loginRoute, async (c) => {
  const { username, password } = c.req.valid("json");
  const login = await logIn(c.var.db, username, password, clientIp(c), c.var.now);
  if (!login.ok) {
    if (login.error === "invalid_credentials") return c.json({ error: login.error }, 401);
    c.header("Retry-After", String(Math.ceil(login.retryAfterMs / 1000)));
    return c.json({ error: login.error }, 429);
  }
  const { loggedIn } = login;
  setSessionCookie(c, loggedIn.token);
  return c.json(
    { user: loggedIn.user, passwordChangeRequired: loggedIn.passwordChangeRequired },
    200,
  );
});

auth.openapi(logoutRoute, async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await logOut(c.var.db, token);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.body(null, 204);
});

auth.openapi(meRoute, (c) => c.json({ user: c.var.user }, 200));
