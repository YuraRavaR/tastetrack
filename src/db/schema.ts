import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
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

// A Media Item is a catalog-backed work, identified by its External Reference (External Source,
// Media Type and the source's own id) and shared by all Users, or, later, a Manual Media Item,
// which has no External Reference. Nothing else about a catalog-backed item is stored here: its
// metadata lives only in the disposable cache below (ADR-0004). SQLite lets NULLs repeat in a
// unique index, so the index constrains catalog-backed items alone.
export const mediaItems = sqliteTable(
  "media_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mediaType: text("media_type", { enum: ["film"] }).notNull(),
    externalSource: text("external_source", { enum: ["tmdb"] }),
    externalId: text("external_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("media_items_external_reference_unique").on(
      table.externalSource,
      table.mediaType,
      table.externalId,
    ),
    check(
      "media_items_external_reference_whole",
      sql`(${table.externalSource} is null) = (${table.externalId} is null)`,
    ),
  ],
);

// The disposable TMDB metadata cache (ADR-0004), keyed by External Reference; the External Source
// is TMDB for every row. It can be wiped at any time without losing User data. A row filled from
// a search result alone, when the details call failed, has no detailedAt and no runtime or genres.
// ukrainianTitle is null when TMDB has no Ukrainian title. englishTitle is TMDB's English title,
// which TMDB itself falls back to the Original Title for; it is null only in a row filled from a
// search result that didn't run in English.
export const tmdbCache = sqliteTable(
  "tmdb_cache",
  {
    mediaType: text("media_type", { enum: ["film"] }).notNull(),
    externalId: text("external_id").notNull(),
    englishTitle: text("english_title"),
    ukrainianTitle: text("ukrainian_title"),
    originalTitle: text("original_title").notNull(),
    year: integer("year"),
    posterPath: text("poster_path"),
    runtime: integer("runtime"),
    genres: text("genres", { mode: "json" }).$type<string[]>(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    detailedAt: integer("detailed_at", { mode: "timestamp_ms" }),
  },
  (table) => [primaryKey({ columns: [table.mediaType, table.externalId] })],
);

// One time a User experienced a Media Item. The Rating is stored in half stars, 1 to 10. The date
// is an optional calendar day, YYYY-MM-DD. createdAt never changes, so it settles Log Order among
// entries of the same day.
export const logEntries = sqliteTable(
  "log_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mediaItemId: integer("media_item_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    date: text("date"),
    review: text("review"),
    revisit: integer("revisit", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("log_entries_user_media_item_idx").on(table.userId, table.mediaItemId),
    check("log_entries_rating_range", sql`${table.rating} between 1 and 10`),
  ],
);
