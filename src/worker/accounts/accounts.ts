// Users, credentials and sessions. Route handlers only translate HTTP to these calls; every rule
// about passwords and session lifetime lives here.
import { and, eq, gt, lte, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { sessions, users } from "../../db/schema";
import type { User } from "../../shared/api";
import { hashPassword, targetIterations, verifyPassword } from "./password";

// A session lasts 30 days from the User's last activity.
export const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

const tokenBytes = 32;

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(tokenBytes));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

// Sessions are stored by the SHA-256 of their token, so the table alone can't be replayed.
async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function byUsername(username: string) {
  return sql`lower(${users.username}) = lower(${username})`;
}

export interface NewUser {
  username: string;
  password: string;
  // Below the target only to test re-hashing; real Users always get the target.
  passwordIterations?: number;
}

// Returns null when the Username is taken, in any letter case.
export async function createUser(
  db: DrizzleD1Database,
  { username, password, passwordIterations }: NewUser,
  now: Date,
): Promise<User | null> {
  const { hash, salt, iterations } = await hashPassword(password, passwordIterations);
  const [created] = await db
    .insert(users)
    .values({
      username,
      passwordHash: hash,
      passwordSalt: salt,
      passwordIterations: iterations,
      createdAt: now,
    })
    .onConflictDoNothing()
    .returning({ username: users.username });
  return created ?? null;
}

export interface LoggedIn {
  user: User;
  token: string;
}

// Returns null for an unknown Username and a wrong password alike, after the same hashing work,
// so neither the answer nor its timing says which Usernames exist.
export async function logIn(
  db: DrizzleD1Database,
  username: string,
  password: string,
  now: Date,
): Promise<LoggedIn | null> {
  const [found] = await db.select().from(users).where(byUsername(username)).limit(1);
  if (!found) {
    await hashPassword(password);
    return null;
  }
  const stored = {
    hash: found.passwordHash,
    salt: found.passwordSalt,
    iterations: found.passwordIterations,
  };
  if (!(await verifyPassword(password, stored))) return null;

  if (found.passwordIterations < targetIterations) {
    const fresh = await hashPassword(password);
    await db
      .update(users)
      .set({
        passwordHash: fresh.hash,
        passwordSalt: fresh.salt,
        passwordIterations: fresh.iterations,
      })
      .where(eq(users.id, found.id));
  }

  const token = newToken();
  // Expired sessions are cleared here, so each User's stay bounded without a cron.
  await db.batch([
    db.delete(sessions).where(and(eq(sessions.userId, found.id), lte(sessions.expiresAt, now))),
    db.insert(sessions).values({
      tokenHash: await hashToken(token),
      userId: found.id,
      createdAt: now,
      expiresAt: new Date(now.getTime() + sessionLifetimeMs),
    }),
  ]);
  return { user: { username: found.username }, token };
}

// Returns the session's User, or null if the session is unknown, ended or expired. Each call
// counts as activity and pushes the expiry 30 days out.
export async function authenticate(
  db: DrizzleD1Database,
  token: string,
  now: Date,
): Promise<User | null> {
  const [session] = await db
    .update(sessions)
    .set({ expiresAt: new Date(now.getTime() + sessionLifetimeMs) })
    .where(and(eq(sessions.tokenHash, await hashToken(token)), gt(sessions.expiresAt, now)))
    .returning({ userId: sessions.userId });
  if (!session) return null;
  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, session.userId));
  return user ?? null;
}

export async function logOut(db: DrizzleD1Database, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, await hashToken(token)));
}

// For the test hooks only: lets a test observe re-hashing, which the API never reports.
export async function passwordIterationsOf(
  db: DrizzleD1Database,
  username: string,
): Promise<number | null> {
  const [found] = await db
    .select({ iterations: users.passwordIterations })
    .from(users)
    .where(byUsername(username));
  return found?.iterations ?? null;
}
