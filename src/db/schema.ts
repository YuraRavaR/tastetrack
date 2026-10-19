import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Deployment-wide settings as key/value pairs. The health check reads it to
// prove the migrations have been applied.
export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Usernames are ASCII, so SQLite's lower() is enough to make them unique regardless of case.
// The password hash records its own salt and iteration count (ADR-0007), so a hash made under an
// older target still verifies and can be re-hashed at the next login.
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    passwordIterations: integer("password_iterations").notNull(),
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
