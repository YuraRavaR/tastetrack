import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// Deployment-wide settings as key/value pairs. The health check reads it to
// prove the migrations have been applied.
export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
