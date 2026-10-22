// Users, credentials and sessions. Route handlers only translate HTTP to these calls; every rule
// about passwords and session lifetime lives here.
import { and, eq, gt, lte, ne, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { alias } from "drizzle-orm/sqlite-core";
import { inviteCodes, sessions, users } from "../../db/schema";
import type {
  AccountEditRequest,
  PasswordChangeRequest,
  RegisterRequest,
  User,
} from "../../shared/api";
import { createBacklog } from "../lists/backlog";
import { randomToken } from "../random-token";
import {
  activeAt,
  type InviteCodeProblem,
  inviteCodeProblem,
  normalizeInviteCode,
} from "./invite-codes";
import { hashPassword, type PasswordHash, targetIterations, verifyPassword } from "./password";

// A session lasts 30 days from the User's last activity.
export const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

const tokenBytes = 32;

// Sessions are stored by the SHA-256 of their token, so the table alone can't be replayed.
async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + sessionLifetimeMs);
}

function passwordColumns({ hash, salt, iterations }: PasswordHash) {
  return { passwordHash: hash, passwordSalt: salt, passwordIterations: iterations };
}

function byUsername(username: string) {
  return sql`lower(${users.username}) = lower(${username})`;
}

// A User as the API shows them, with their Username standing in until they set a Display Name.
export const userColumns = {
  username: users.username,
  displayName: sql<string>`coalesce(${users.displayName}, ${users.username})`,
};

export interface NewUser {
  username: string;
  password: string;
  // Below the target only to test re-hashing; real Users always get the target.
  passwordIterations?: number;
}

// Creates the User with their Backlog. Returns null when the Username is taken, in any letter
// case.
export async function createUser(
  db: DrizzleD1Database,
  { username, password, passwordIterations }: NewUser,
  now: Date,
): Promise<User | null> {
  const [[created]] = await db.batch([
    db
      .insert(users)
      .values({
        username,
        ...passwordColumns(await hashPassword(password, passwordIterations)),
        createdAt: now,
      })
      .onConflictDoNothing()
      .returning(userColumns),
    createBacklog(db, byUsername(username)),
  ]);
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
  const [found] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      passwordSalt: users.passwordSalt,
      passwordIterations: users.passwordIterations,
      ...userColumns,
    })
    .from(users)
    .where(byUsername(username))
    .limit(1);
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
    await db
      .update(users)
      .set(passwordColumns(await hashPassword(password)))
      .where(eq(users.id, found.id));
  }

  const token = await startSession(db, found.id, now);
  return { user: { username: found.username, displayName: found.displayName }, token };
}

// Returns the new session's token.
async function startSession(db: DrizzleD1Database, userId: number, now: Date): Promise<string> {
  const token = randomToken(tokenBytes);
  // Expired sessions are cleared here, so each User's stay bounded without a cron.
  await db.batch([
    db.delete(sessions).where(and(eq(sessions.userId, userId), lte(sessions.expiresAt, now))),
    db.insert(sessions).values({
      tokenHash: await hashToken(token),
      userId,
      createdAt: now,
      expiresAt: expiryFrom(now),
    }),
  ]);
  return token;
}

export type Registration =
  | { ok: true; loggedIn: LoggedIn }
  | { ok: false; error: InviteCodeProblem | "username_taken" };

// Creates the User with their Backlog, marks the Invite Code used and logs the new User in. The
// code is checked first, so a bad one costs no hashing and only someone holding a good one learns
// whether a Username is taken. Creating the User and using the code are then one transaction: the
// insert copies the issuer from the code only while the code is still active, so two
// registrations racing for one code can't both succeed, and a taken Username rolls the whole
// thing back, leaving the code unused.
export async function register(
  db: DrizzleD1Database,
  { inviteCode, username, password }: RegisterRequest,
  now: Date,
): Promise<Registration> {
  const code = normalizeInviteCode(inviteCode);
  const problem = await inviteCodeProblem(db, code, now);
  if (problem) return { ok: false, error: problem };

  const hash = await hashPassword(password);
  const byCode = and(eq(inviteCodes.code, code), activeAt(now));
  let created: { id: number } | undefined;
  try {
    [[created]] = await db.batch([
      // Insert-select lists every column in table order; a null id takes the next one.
      db
        .insert(users)
        .select(
          db
            .select({
              id: sql<number>`null`.as("id"),
              username: sql<string>`${username}`.as("username"),
              passwordHash: sql<string>`${hash.hash}`.as("password_hash"),
              passwordSalt: sql<string>`${hash.salt}`.as("password_salt"),
              passwordIterations: sql<number>`${hash.iterations}`.as("password_iterations"),
              invitedBy: inviteCodes.issuerId,
              createdAt: sql<number>`${now.getTime()}`.as("created_at"),
              displayName: sql<string | null>`null`.as("display_name"),
            })
            .from(inviteCodes)
            .where(byCode),
        )
        .returning({ id: users.id }),
      createBacklog(db, byUsername(username)),
      db.update(inviteCodes).set({ usedAt: now }).where(byCode),
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "username_taken" };
    throw error;
  }
  // Someone else registered with the code since it was checked.
  if (!created) return { ok: false, error: "invite_code_used" };
  const token = await startSession(db, created.id, now);
  return { ok: true, loggedIn: { user: { username, displayName: username }, token } };
}

// D1 reports a broken unique index as an error whose message, possibly on a wrapped cause, names
// the constraint.
function isUniqueViolation(error: unknown): boolean {
  for (let cause = error; cause instanceof Error; cause = cause.cause) {
    if (cause.message.includes("UNIQUE constraint failed")) return true;
  }
  return false;
}

export interface Authenticated {
  userId: number;
  user: User;
}

// Returns the session's User, or null if the session is unknown, ended or expired. Each call
// counts as activity and pushes the expiry 30 days out.
export async function authenticate(
  db: DrizzleD1Database,
  token: string,
  now: Date,
): Promise<Authenticated | null> {
  const [session] = await db
    .update(sessions)
    .set({ expiresAt: expiryFrom(now) })
    .where(and(eq(sessions.tokenHash, await hashToken(token)), gt(sessions.expiresAt, now)))
    .returning({ userId: sessions.userId });
  if (!session) return null;
  const [user] = await db.select(userColumns).from(users).where(eq(users.id, session.userId));
  return user ? { userId: session.userId, user } : null;
}

// Changes the given fields of the User's account. An empty Display Name counts as none, so the
// Username stands in again. Null when the User is gone.
export async function editAccount(
  db: DrizzleD1Database,
  userId: number,
  edit: AccountEditRequest,
): Promise<User | null> {
  const byId = eq(users.id, userId);
  const [user] =
    edit.displayName === undefined
      ? await db.select(userColumns).from(users).where(byId)
      : await db
          .update(users)
          .set({ displayName: edit.displayName || null })
          .where(byId)
          .returning(userColumns);
  return user ?? null;
}

// Changes the User's password once their current one checks out, and ends every other session
// of theirs, so one that was stolen stops working; the session of `token` stays. False for a
// wrong current password, which changes nothing.
export async function changePassword(
  db: DrizzleD1Database,
  userId: number,
  token: string,
  { currentPassword, newPassword }: PasswordChangeRequest,
): Promise<boolean> {
  const byId = eq(users.id, userId);
  const [found] = await db
    .select({
      hash: users.passwordHash,
      salt: users.passwordSalt,
      iterations: users.passwordIterations,
    })
    .from(users)
    .where(byId);
  if (!found || !(await verifyPassword(currentPassword, found))) return false;

  await db.batch([
    db
      .update(users)
      .set(passwordColumns(await hashPassword(newPassword)))
      .where(byId),
    db
      .delete(sessions)
      .where(and(eq(sessions.userId, userId), ne(sessions.tokenHash, await hashToken(token)))),
  ]);
  return true;
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

// For the test hooks only: the Username of the User who invited this one, null if they registered
// without an Invite Code or their inviter is gone, or undefined for an unknown Username.
export async function inviterOf(
  db: DrizzleD1Database,
  username: string,
): Promise<string | null | undefined> {
  const inviters = alias(users, "inviters");
  const [found] = await db
    .select({ inviter: inviters.username })
    .from(users)
    .leftJoin(inviters, eq(users.invitedBy, inviters.id))
    .where(byUsername(username));
  return found ? found.inviter : undefined;
}

// For the test hooks only, until Users can remove their accounts: deletes the User, which ends
// their sessions and Invite Codes and clears them as the inviter of anyone they invited. Returns
// false for an unknown Username.
export async function deleteUser(db: DrizzleD1Database, username: string): Promise<boolean> {
  const deleted = await db.delete(users).where(byUsername(username)).returning({ id: users.id });
  return deleted.length > 0;
}
