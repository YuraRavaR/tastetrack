// Schemas for the HTTP API, shared by the Worker (validation and the OpenAPI
// spec) and the client (response types).
import { z } from "@hono/zod-openapi";

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

// Username rules (PRD #1): 3–30 ASCII letters, digits or underscores. ASCII keeps case-insensitive
// uniqueness simple and rules out look-alike letters from other scripts.
export const Username = z
  .string()
  .regex(/^[A-Za-z0-9_]{3,30}$/)
  .openapi({ example: "olena_k" });

// Any 10–128 characters, with no composition rules, so long passphrases work.
export const Password = z.string().min(10).max(128);

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
