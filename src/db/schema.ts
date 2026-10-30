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
import { visibilities } from "../shared/lists";

// Deployment-wide settings as key/value pairs. The health check reads it to
// prove the migrations have been applied.
export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Usernames are ASCII, so SQLite's lower() is enough to make them unique regardless of case.
// The password hash records its own salt and iteration count (ADR-0007), so a hash made under an
// older target still verifies and can be re-hashed at the next login. invitedBy is the User whose
// Invite Code they registered with; it is cleared if that User is deleted, never the invitee. A
// null displayName means the User hasn't set one, so their Display Name is their Username.
// passwordChangeRequired marks a password the Operator reset to a Temporary Password: until the User
// sets their own, their sessions can do nothing else.
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
    displayName: text("display_name"),
    passwordChangeRequired: integer("password_change_required", { mode: "boolean" })
      .notNull()
      .default(false),
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

// The login failures of one Username from one IP, which lock that pair once there are enough
// (ADR-0007). The Username is kept lower-cased, as logins match it, and need not belong to a User,
// so an unknown one locks the same way. An attempt counts as a failure before its password is
// checked, and a success deletes the row; attempts while the pair is locked count too, but leave
// lastFailedAt at the failure that locked it. Once lastFailedAt is a lockout in the past, the
// failures no longer count, and the Cron Trigger deletes the row.
export const loginFailures = sqliteTable(
  "login_failures",
  {
    usernameKey: text("username_key").notNull(),
    ip: text("ip").notNull(),
    failures: integer("failures").notNull(),
    lastFailedAt: integer("last_failed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.usernameKey, table.ip] }),
    index("login_failures_last_failed_at_idx").on(table.lastFailedAt),
  ],
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
// Media Type and the source's own id) and shared by all Users, or a Manual Media Item, which has
// no External Reference. Nothing else about a catalog-backed item is stored here: its metadata
// lives only in the disposable cache below (ADR-0004). SQLite lets NULLs repeat in a unique index,
// so the index constrains catalog-backed items alone.
//
// A Manual Media Item, and only one, has an owner and its own metadata: a title always, the rest
// when its User gave them. Being manual follows from having no External Reference, with no flag of
// its own. The keys are the titles as search and the same-title warning compare them
// (src/shared/catalog.ts). These columns came after the table, so their rules are kept by the
// Worker rather than a table check: adding one would rebuild the table, and on D1 dropping the old
// one would cascade-delete every Log Entry and List Item.
export const mediaItems = sqliteTable(
  "media_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mediaType: text("media_type", { enum: ["film"] }).notNull(),
    externalSource: text("external_source", { enum: ["tmdb"] }),
    externalId: text("external_id"),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "cascade" }),
    title: text("title"),
    titleKey: text("title_key"),
    originalTitle: text("original_title"),
    originalTitleKey: text("original_title_key"),
    year: integer("year"),
    runtime: integer("runtime"),
    genres: text("genres", { mode: "json" }).$type<string[]>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("media_items_owner_id_idx").on(table.ownerId),
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
// a search result alone, when the details call failed, has no detailedAt, no backdrop and no
// runtime or genres. A row filled before backdrops were kept has none until the cron refreshes it.
// ukrainianTitle is null when TMDB has no Ukrainian title. englishTitle is TMDB's English title,
// which TMDB itself falls back to the Original Title for; it is null only in a row filled from a
// search result that didn't run in English. checkedAt is when the cron last tried to refresh the
// row and TMDB didn't answer, if it has since the row was last filled; filling it clears it.
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
    backdropPath: text("backdrop_path"),
    runtime: integer("runtime"),
    genres: text("genres", { mode: "json" }).$type<string[]>(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    detailedAt: integer("detailed_at", { mode: "timestamp_ms" }),
    checkedAt: integer("checked_at", { mode: "timestamp_ms" }),
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

// A List: an ordered collection of Media Items of one Media Type, owned by a User. The Backlog is
// the system List of what the User plans to experience: every User has exactly one per Media Type,
// made with their account. It has no name, since its name is the UI's word for its Media Type
// ("Watchlist"), so there is nothing to rename. Every other List, of kind "list", has a name,
// unique for its User by nameKey (src/shared/lists.ts), which SQLite's ASCII-only lower()
// couldn't decide for Ukrainian names; the Backlog's null nameKey repeats freely in the unique
// index. The Media Type is the List's, not a rule of the table: its items' Media Type is checked
// as they are added, so a List may later change or mix types. Visibility is on the ordered scale
// of src/shared/lists.ts, which sets its order: as text, SQL would sort it alphabetically.
export const lists = sqliteTable(
  "lists",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["backlog", "list"] }).notNull(),
    mediaType: text("media_type", { enum: ["film"] }).notNull(),
    name: text("name"),
    nameKey: text("name_key"),
    description: text("description"),
    visibility: text("visibility", { enum: visibilities }).notNull().default("private"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("lists_user_id_idx").on(table.userId),
    uniqueIndex("lists_name_unique").on(table.userId, table.nameKey),
    uniqueIndex("lists_backlog_unique")
      .on(table.userId, table.mediaType)
      .where(sql`${table.kind} = 'backlog'`),
  ],
);

// A List's Share Link: an unguessable token that shows the List to anyone holding it, without
// login. A List has at most one, and has one exactly while its Visibility is link or higher.
// Regenerating replaces the token and revoking deletes the row. The token is shown back to the
// List's owner, so it is stored as issued, not hashed.
export const shareLinks = sqliteTable("share_links", {
  token: text("token").primaryKey(),
  listId: integer("list_id")
    .notNull()
    .unique("share_links_list_id_unique")
    .references(() => lists.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// One Media Item's place in one List, with an optional Note. Items are in position order, with
// the id breaking ties, so a gap left by a removed item changes nothing; reordering numbers the
// whole List afresh from 0.
export const listItems = sqliteTable(
  "list_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listId: integer("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    mediaItemId: integer("media_item_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("list_items_list_media_item_unique").on(table.listId, table.mediaItemId),
    index("list_items_media_item_id_idx").on(table.mediaItemId),
  ],
);
