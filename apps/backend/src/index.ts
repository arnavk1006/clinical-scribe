import { Hono } from "hono";
import patientsRouter from "./routes/patients";
import doctorsRouter from "./routes/doctors";
import sessionsRouter from "./routes/sessions";
import notesRouter from "./routes/notes";
import transcriptsRouter from "./routes/transcripts";
import { serverAdapter } from "./transcription/queue";
import "./transcription/worker";

export const app = new Hono();

const routes = app
  .get("/", (c) => {
    return c.json({
      status: "ok",
      message: "Clinical Scribe API is running",
      endpoints: {
        patients: "/api/patients",
        doctors: "/api/doctors",
        sessions: "/api/sessions",
        notes: "/api/notes",
        transcripts: "/api/transcripts",
        upload: "/api/upload",
        queues: "/admin/queues",
      },
    });
  })
  .route("/api/patients", patientsRouter)
  .route("/api/doctors", doctorsRouter)
  .route("/api/sessions", sessionsRouter)
  .route("/api/notes", notesRouter)
  .route("/api/transcripts", transcriptsRouter)
  .route("/admin/queues", serverAdapter.registerPlugin());

export type AppType = typeof routes;

if (!process.env.PORT) {
  throw new Error("PORT environment variable is not set");
}
const port = parseInt(process.env.PORT, 10);
console.log(`Server is running on port ${port}...`);

// Validate system dependencies
try {
  const proc = Bun.spawn(["ffmpeg", "-version"], { stdout: "ignore", stderr: "ignore" });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error();
  }
} catch {
  console.warn("\x1b[33m%s\x1b[0m", "⚠️ WARNING: 'ffmpeg' was not found in the system PATH. Transcript chunk processing will fail. Please install ffmpeg.");
}

export default {
  port,
  fetch: app.fetch,
};
