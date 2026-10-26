// The login lockout (ADR-0007): 5 failed logins for one Username from one IP lock that pair for
// 15 minutes, so guessing from one IP is slowed, while the same Username from anywhere else, its
// User included, logs in as usual.
import { and, eq, lte, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { loginFailures } from "../../db/schema";

export const maxLoginFailures = 5;

export const lockoutMs = 15 * 60 * 1000;

export type LoginAttempt = { allowed: true } | { allowed: false; retryAfterMs: number };

// Usernames are ASCII and match in any letter case, so every spelling of one shares a lockout.
function usernameKey(username: string): string {
  return username.toLowerCase();
}

function staleBefore(now: Date): Date {
  return new Date(now.getTime() - lockoutMs);
}

// Counts an attempt for the Username from the IP as a failure, before its password is checked, so
// attempts sent all at once can't each slip in ahead of the others' failures. Allowed while the
// pair has fewer than 5 failures; a locked pair stays locked until 15 minutes after the failure
// that locked it, and failures that old no longer count. Only the pair's own row is read, so no
// other pair's attempts, at whatever time, change the answer.
export async function beginLoginAttempt(
  db: DrizzleD1Database,
  username: string,
  ip: string,
  now: Date,
): Promise<LoginAttempt> {
  const { failures, lastFailedAt } = loginFailures;
  const stale = sql`${lastFailedAt} <= ${staleBefore(now).getTime()}`;
  const [counted] = await db
    .insert(loginFailures)
    .values({ usernameKey: usernameKey(username), ip, failures: 1, lastFailedAt: now })
    .onConflictDoUpdate({
      target: [loginFailures.usernameKey, loginFailures.ip],
      set: {
        failures: sql`case when ${stale} then 1 else ${failures} + 1 end`,
        lastFailedAt: sql`case when not ${stale} and ${failures} >= ${maxLoginFailures}
          then ${lastFailedAt} else ${now.getTime()} end`,
      },
    })
    .returning({ failures, lastFailedAt });
  if (!counted) throw new Error("A login attempt wasn't counted");
  if (counted.failures <= maxLoginFailures) return { allowed: true };
  return {
    allowed: false,
    retryAfterMs: counted.lastFailedAt.getTime() + lockoutMs - now.getTime(),
  };
}

// A successful login clears the pair's failures.
export async function clearLoginFailures(
  db: DrizzleD1Database,
  username: string,
  ip: string,
): Promise<void> {
  await db
    .delete(loginFailures)
    .where(and(eq(loginFailures.usernameKey, usernameKey(username)), eq(loginFailures.ip, ip)));
}

// Deletes the failures that no longer count, so pairs that are never tried again don't stay
// forever. The Cron Trigger runs it; returns how many pairs it cleared.
export async function pruneLoginFailures(db: DrizzleD1Database, now: Date): Promise<number> {
  const pruned = await db
    .delete(loginFailures)
    .where(lte(loginFailures.lastFailedAt, staleBefore(now)))
    .returning({ ip: loginFailures.ip });
  return pruned.length;
}
