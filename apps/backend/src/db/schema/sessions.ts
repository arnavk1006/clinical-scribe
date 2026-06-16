import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { patients } from "./patients";
import { doctors } from "./doctors";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  doctorId: text("doctor_id")
    .notNull()
    .references(() => doctors.id),
  status: text("status", {
    enum: ["recording", "processing", "transcribed", "reviewed"],
  })
    .notNull()
    .default("recording"),
  audioPath: text("audio_path"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp" }),
});
