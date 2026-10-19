// Schemas for the HTTP API, shared by the Worker (validation and the OpenAPI
// spec) and the client (response types).
import { z } from "@hono/zod-openapi";
import { passwordLength, usernamePattern } from "./accounts";

export const HealthResponse = z
  .object({
    status: z.literal("ok"),
    database: z.literal("ok"),
  })
  .openapi("HealthResponse");

export type HealthResponse = z.infer<typeof HealthResponse>;

export const ErrorResponse = z
  .object({
    error: z.string().openapi({ example: "not_found" }),
  })
  .openapi("ErrorResponse");

export type ErrorResponse = z.infer<typeof ErrorResponse>;

export const Username = z.string().regex(usernamePattern).openapi({ example: "olena_k" });

export const Password = z.string().min(passwordLength.min).max(passwordLength.max);

// Login checks credentials, not the rules: a malformed Username is just one that doesn't exist.
// The caps only bound the work a request can cause.
export const LoginRequest = z
  .object({
    username: z.string().min(1).max(100).openapi({ example: "olena_k" }),
    password: z.string().min(1).max(1000),
  })
  .openapi("LoginRequest");

export type LoginRequest = z.infer<typeof LoginRequest>;

export const User = z
  .object({
    username: Username,
  })
  .openapi("User");

export type User = z.infer<typeof User>;

export const UserResponse = z
  .object({
    user: User,
  })
  .openapi("UserResponse");

export type UserResponse = z.infer<typeof UserResponse>;

// Registration checks the Invite Code itself, so any string up to the cap gets that code's error.
export const RegisterRequest = z
  .object({
    inviteCode: z.string().min(1).max(100).openapi({ example: "7KQ2-M9XD-PW4T" }),
    username: Username,
    password: Password,
  })
  .openapi("RegisterRequest");

export type RegisterRequest = z.infer<typeof RegisterRequest>;

export const InviteCode = z
  .object({
    code: z.string().openapi({ example: "7KQ2-M9XD-PW4T" }),
    expiresAt: z.iso.datetime().openapi({ example: "2026-10-26T12:00:00.000Z" }),
  })
  .openapi("InviteCode");

export type InviteCode = z.infer<typeof InviteCode>;

export const InviteCodeResponse = z
  .object({
    inviteCode: InviteCode,
  })
  .openapi("InviteCodeResponse");

export type InviteCodeResponse = z.infer<typeof InviteCodeResponse>;

export const InviteCodesResponse = z
  .object({
    inviteCodes: z.array(InviteCode),
  })
  .openapi("InviteCodesResponse");

export type InviteCodesResponse = z.infer<typeof InviteCodesResponse>;
