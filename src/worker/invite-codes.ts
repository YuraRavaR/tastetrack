// Issuing and listing the logged-in User's Invite Codes.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ErrorResponse, InviteCodeResponse, InviteCodesResponse } from "../shared/api";
import { activeInviteCodes, issueInviteCode } from "./accounts/invite-codes";
import { requireUser } from "./auth";
import type { AppEnv } from "./env";

const unauthenticatedResponse = {
  content: { "application/json": { schema: ErrorResponse } },
  description: "No live session",
};

const issueRoute = createRoute({
  method: "post",
  path: "/invite-codes",
  summary: "Generate an Invite Code, valid for 7 days",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  responses: {
    201: {
      content: { "application/json": { schema: InviteCodeResponse } },
      description: "The new Invite Code",
    },
    401: unauthenticatedResponse,
    409: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "The User already has 5 active Invite Codes",
    },
  },
});

const listRoute = createRoute({
  method: "get",
  path: "/invite-codes",
  summary: "List the logged-in User's active (unused, unexpired) Invite Codes",
  middleware: [requireUser] as const,
  security: [{ session: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: InviteCodesResponse } },
      description: "The active Invite Codes, soonest to expire first",
    },
    401: unauthenticatedResponse,
  },
});

export const inviteCodeRoutes = new OpenAPIHono<AppEnv>();

inviteCodeRoutes.openapi(issueRoute, async (c) => {
  const inviteCode = await issueInviteCode(c.var.db, c.var.userId, c.var.now);
  if (!inviteCode) return c.json({ error: "invite_code_limit" }, 409);
  return c.json({ inviteCode }, 201);
});

inviteCodeRoutes.openapi(listRoute, async (c) => {
  const inviteCodes = await activeInviteCodes(c.var.db, c.var.userId, c.var.now);
  return c.json({ inviteCodes }, 200);
});
