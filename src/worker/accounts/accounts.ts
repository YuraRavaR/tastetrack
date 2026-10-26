// Users, credentials and sessions. Route handlers only translate HTTP to these calls; every rule
// about passwords and session lifetime lives here.
import { and, eq, gt, inArray, lte, ne, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { alias } from "drizzle-orm/sqlite-core";
import { inviteCodes, sessions, users } from "../../db/schema";
import type { PasswordChangeRequest, RegisterRequest, User } from "../../shared/api";
import { createBacklog } from "../lists/backlog";
import { randomCode, randomToken } from "../random-token";
import {
  activeAt,
  type InviteCodeProblem,
  inviteCodeProblem,
  normalizeInviteCode,
} from "./invite-codes";
import { beginLoginAttempt, clearLoginFailures } from "./login-lockout";
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

// The stored hash, read back in the shape verifyPassword takes.
const storedPassword = {
  hash: users.passwordHash,
  salt: users.passwordSalt,
  iterations: users.passwordIterations,
};

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
  // The password is a Temporary Password the Operator issued, so the session can only set a new one.
  passwordChangeRequired: boolean;
}

export type Login =
  | { ok: true; loggedIn: LoggedIn }
  | { ok: false; error: "invalid_credentials" }
  | { ok: false; error: "too_many_attempts"; retryAfterMs: number };

// Logs the User in from the client's IP unless that IP has locked their Username with failed
// logins (login-lockout.ts). An unknown Username fails, and locks, just as a wrong password does,
// and a locked pair is refused before any lookup, so no answer says which Usernames exist.
export async function logIn(
  db: DrizzleD1Database,
  username: string,
  password: string,
  ip: string,
  now: Date,
): Promise<Login> {
  const attempt = await beginLoginAttempt(db, username, ip, now);
  if (!attempt.allowed) {
    return { ok: false, error: "too_many_attempts", retryAfterMs: attempt.retryAfterMs };
  }
  const loggedIn = await checkCredentials(db, username, password, now);
  if (!loggedIn) return { ok: false, error: "invalid_credentials" };
  await clearLoginFailures(db, username, ip);
  return { ok: true, loggedIn };
}

// Returns null for an unknown Username and a wrong password alike, after the same hashing work,
// so neither the answer nor its timing says which Usernames exist.
async function checkCredentials(
  db: DrizzleD1Database,
  username: string,
  password: string,
  now: Date,
): Promise<LoggedIn | null> {
  const [found] = await db
    .select({
      id: users.id,
      ...storedPassword,
      ...userColumns,
      passwordChangeRequired: users.passwordChangeRequired,
    })
    .from(users)
    .where(byUsername(username))
    .limit(1);
  if (!found) {
    await hashPassword(password);
    return null;
  }
  if (!(await verifyPassword(password, found))) return null;

  // A re-hash lands only on the hash that was checked; if the password changed meanwhile, the
  // session below is refused.
  let checkedHash = found.hash;
  if (found.iterations < targetIterations) {
    const [rehashed] = await db
      .update(users)
      .set(passwordColumns(await hashPassword(password)))
      .where(and(eq(users.id, found.id), eq(users.passwordHash, found.hash)))
      .returning({ hash: users.passwordHash });
    if (rehashed) checkedHash = rehashed.hash;
  }

  const token = await startSession(db, found.id, checkedHash, now);
  if (!token) return null;
  return {
    user: { username: found.username, displayName: found.displayName },
    token,
    passwordChangeRequired: found.passwordChangeRequired,
  };
}

// Returns the new session's token, or null when the User's password hash is no longer
// `checkedHash`: a login that checked the old password while it was being changed must not
// outlive the change, which ends every other session.
async function startSession(
  db: DrizzleD1Database,
  userId: number,
  checkedHash: string,
  now: Date,
): Promise<string | null> {
  const token = randomToken(tokenBytes);
  // Expired sessions are cleared here, so each User's stay bounded without a cron.
  const [, started] = await db.batch([
    db.delete(sessions).where(and(eq(sessions.userId, userId), lte(sessions.expiresAt, now))),
    db
      .insert(sessions)
      .select(
        db
          .select({
            tokenHash: sql<string>`${await hashToken(token)}`.as("token_hash"),
            userId: users.id,
            createdAt: sql<number>`${now.getTime()}`.as("created_at"),
            expiresAt: sql<number>`${expiryFrom(now).getTime()}`.as("expires_at"),
          })
          .from(users)
          .where(and(eq(users.id, userId), eq(users.passwordHash, checkedHash))),
      )
      .returning({ tokenHash: sessions.tokenHash }),
  ]);
  return started.length > 0 ? token : null;
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
              passwordChangeRequired: sql<boolean>`0`.as("password_change_required"),
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
  const token = await startSession(db, created.id, hash.hash, now);
  if (!token) throw new Error("A User who just registered has no session");
  return {
    ok: true,
    loggedIn: { user: { username, displayName: username }, token, passwordChangeRequired: false },
  };
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
  // The User logged in with a Temporary Password and hasn't set their own yet.
  passwordChangeRequired: boolean;
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
  const [found] = await db
    .select({ ...userColumns, passwordChangeRequired: users.passwordChangeRequired })
    .from(users)
    .where(eq(users.id, session.userId));
  if (!found) return null;
  const { passwordChangeRequired, ...user } = found;
  return { userId: session.userId, user, passwordChangeRequired };
}

// Sets the User's Display Name; null or empty puts their Username back in its place. Null when
// the User is gone.
export async function setDisplayName(
  db: DrizzleD1Database,
  userId: number,
  displayName: string | null,
): Promise<User | null> {
  const [user] = await db
    .update(users)
    .set({ displayName: displayName || null })
    .where(eq(users.id, userId))
    .returning(userColumns);
  return user ?? null;
}

// Changes the User's password once their current one checks out, and ends every other session
// of theirs, so one that was stolen stops working; the session of `token` stays. The new hash
// replaces only the one that was checked, and sessions end only once it has, so of two changes
// racing, one fails as if its current password were wrong. False for a wrong current password,
// which changes nothing.
export async function changePassword(
  db: DrizzleD1Database,
  userId: number,
  token: string,
  { currentPassword, newPassword }: PasswordChangeRequest,
): Promise<boolean> {
  const byId = eq(users.id, userId);
  const [found] = await db.select(storedPassword).from(users).where(byId);
  if (!found || !(await verifyPassword(currentPassword, found))) return false;

  const changed = await hashPassword(newPassword);
  const [updated] = await db.batch([
    db
      .update(users)
      .set(passwordColumns(changed))
      .where(and(byId, eq(users.passwordHash, found.hash)))
      .returning({ id: users.id }),
    endOtherSessionsOnceChanged(db, userId, changed.hash, await hashToken(token)),
  ]);
  return updated.length > 0;
}

// Ends every session of the User's but the one whose token hashes to `keptTokenHash`, if their
// password hash is now `changedHash`. A new hash has a fresh salt, so it is the User's only if the
// change batched before this landed.
function endOtherSessionsOnceChanged(
  db: DrizzleD1Database,
  userId: number,
  changedHash: string,
  keptTokenHash: string,
) {
  return db.delete(sessions).where(
    and(
      inArray(
        sessions.userId,
        db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, userId), eq(users.passwordHash, changedHash))),
      ),
      ne(sessions.tokenHash, keptTokenHash),
    ),
  );
}

export type TemporaryPasswordReplacement =
  | { ok: true; user: User }
  | { ok: false; error: "password_change_not_required" | "temporary_password_reused" };

// Sets the User's own password in place of the Temporary Password the Operator issued, which lifts
// the restriction on their sessions, and ends every other session of theirs; the session of
// `token` stays. The new hash replaces only the Temporary Password that was checked, so a second reset
// meanwhile wins. A User who has no Temporary Password changes theirs with changePassword.
export async function replaceTemporaryPassword(
  db: DrizzleD1Database,
  userId: number,
  token: string,
  newPassword: string,
): Promise<TemporaryPasswordReplacement> {
  const byId = eq(users.id, userId);
  const [found] = await db
    .select({ ...storedPassword, passwordChangeRequired: users.passwordChangeRequired })
    .from(users)
    .where(byId);
  if (!found?.passwordChangeRequired) return { ok: false, error: "password_change_not_required" };
  if (await verifyPassword(newPassword, found)) {
    return { ok: false, error: "temporary_password_reused" };
  }

  const changed = await hashPassword(newPassword);
  const [updated] = await db.batch([
    db
      .update(users)
      .set({ ...passwordColumns(changed), passwordChangeRequired: false })
      .where(and(byId, eq(users.passwordHash, found.hash), eq(users.passwordChangeRequired, true)))
      .returning(userColumns),
    endOtherSessionsOnceChanged(db, userId, changed.hash, await hashToken(token)),
  ]);
  const [user] = updated;
  return user ? { ok: true, user } : { ok: false, error: "password_change_not_required" };
}

// Four groups of four Crockford base32 characters: 80 random bits, easy to read out and type, and
// long enough for the password rules.
function newTemporaryPassword(): string {
  return randomCode(16).match(/.{4}/g)?.join("-") ?? "";
}

// The Operator's reset for a User who forgot their password: gives them a new Temporary Password,
// which they must replace with their own at their next login, and ends every session of theirs.
// Returns the Temporary Password, to hand to the User, or null for an unknown Username.
export async function resetPassword(
  db: DrizzleD1Database,
  username: string,
): Promise<string | null> {
  const temporaryPassword = newTemporaryPassword();
  const [reset] = await db.batch([
    db
      .update(users)
      .set({
        ...passwordColumns(await hashPassword(temporaryPassword)),
        passwordChangeRequired: true,
      })
      .where(byUsername(username))
      .returning({ id: users.id }),
    db
      .delete(sessions)
      .where(
        inArray(
          sessions.userId,
          db.select({ id: users.id }).from(users).where(byUsername(username)),
        ),
      ),
  ]);
  return reset.length > 0 ? temporaryPassword : null;
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

// Deletes the User for good once their password checks out. The schema's cascades take everything
// of theirs with them: sessions, Invite Codes, Log Entries, Lists with their List Items and Share
// Links, and Manual Media Items. Users they invited stay, with no inviter; catalog-backed Media
// Items have no owner, so other Users' records of them stay too. Only the hash that was checked is
// deleted, so a password change racing this one fails it as a wrong password would. False for a
// wrong password, which deletes nothing.
export async function deleteUser(
  db: DrizzleD1Database,
  userId: number,
  password: string,
): Promise<boolean> {
  const byId = eq(users.id, userId);
  const [found] = await db.select(storedPassword).from(users).where(byId);
  if (!found || !(await verifyPassword(password, found))) return false;
  const deleted = await db
    .delete(users)
    .where(and(byId, eq(users.passwordHash, found.hash)))
    .returning({ id: users.id });
  return deleted.length > 0;
}
