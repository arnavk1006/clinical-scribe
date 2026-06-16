import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const doctors = sqliteTable("doctors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  oauthProvider: text("oauth_provider"),
  oauthId: text("oauth_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
