import type { DrizzleD1Database } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loginFailures } from "../../db/schema";
import { openTestDatabase, type TestDatabase } from "../test-database";
import { beginLoginAttempt, lockoutMs, pruneLoginFailures } from "./login-lockout";

const now = new Date("2026-10-20T12:00:00Z");

function later(ms: number): Date {
  return new Date(now.getTime() + ms);
}

let database: TestDatabase;
let db: DrizzleD1Database;

beforeAll(async () => {
  database = await openTestDatabase();
  db = database.db;
}, 30_000);

afterAll(() => database.dispose());

beforeEach(async () => {
  await db.delete(loginFailures);
});

describe("beginLoginAttempt", () => {
  it("lets only 5 of many attempts sent at once through", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 20 }, () => beginLoginAttempt(db, "olena", "192.0.2.1", now)),
    );

    expect(attempts.filter((attempt) => attempt.allowed)).toHaveLength(5);
  });
});

describe("pruneLoginFailures", () => {
  it("deletes only the failures that no longer count", async () => {
    await beginLoginAttempt(db, "olena", "192.0.2.1", now);
    await beginLoginAttempt(db, "taras", "192.0.2.1", later(1000));

    expect(await pruneLoginFailures(db, later(lockoutMs))).toBe(1);

    const left = await db.select({ usernameKey: loginFailures.usernameKey }).from(loginFailures);
    expect(left).toEqual([{ usernameKey: "taras" }]);
  });

  it("keeps a lockout until it ends", async () => {
    for (let i = 0; i < 5; i++) await beginLoginAttempt(db, "olena", "192.0.2.1", now);
    // Attempts while locked leave the lockout's start where it was.
    await beginLoginAttempt(db, "olena", "192.0.2.1", later(lockoutMs - 1000));

    expect(await pruneLoginFailures(db, later(lockoutMs - 1))).toBe(0);
    expect(await pruneLoginFailures(db, later(lockoutMs))).toBe(1);
  });
});
