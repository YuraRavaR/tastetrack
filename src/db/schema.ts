import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Deployment-wide settings as key/value pairs. The health check reads it to
// prove the migrations have been applied.
export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Usernames are ASCII, so SQLite's lower() is enough to make them unique regardless of case.
// The password hash records its own salt and iteration count (ADR-0007), so a hash made under an
// older target still verifies and can be re-hashed at the next login. invitedBy is the User whose
// Invite Code they registered with; it is cleared if that User is deleted, never the invitee.
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    passwordIterations: integer("password_iterations").notNull(),
    invitedBy: integer("invited_by").references((): AnySQLiteColumn => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("users_username_unique").on(sql`lower(${table.username})`)],
);

// A session is stored under the SHA-256 of its token, so a leaked database can't be replayed as
// cookies. It is valid until expiresAt, which every authenticated request pushes 30 days out.
export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

// An Invite Code is active until it is used or expires, 7 days after it was issued. Codes are
// shown back to their issuer, so they are stored as issued, not hashed. usedAt alone marks a code
// used, so it stays used whatever happens to the User who registered with it.
export const inviteCodes = sqliteTable(
  "invite_codes",
  {
    code: text("code").primaryKey(),
    issuerId: integer("issuer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("invite_codes_issuer_id_idx").on(table.issuerId)],
);
