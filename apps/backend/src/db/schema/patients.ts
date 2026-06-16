import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const patients = sqliteTable("patients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  oauthProvider: text("oauth_provider"),
  oauthId: text("oauth_id"),
  mrn: text("mrn").unique(),
  dateOfBirth: integer("date_of_birth", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
