import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sessions } from "./sessions";

export const transcripts = sqliteTable("transcripts", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const transcriptChunks = sqliteTable("transcript_chunks", {
  id: text("id").primaryKey(),
  transcriptId: text("transcript_id")
    .notNull()
    .references(() => transcripts.id, { onDelete: "cascade" }),
  sequenceNumber: integer("sequence_number").notNull(),
  location: text("location").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
