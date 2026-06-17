import { Hono } from "hono";
import patientsRouter from "./routes/patients";
import doctorsRouter from "./routes/doctors";
import sessionsRouter from "./routes/sessions";
import notesRouter from "./routes/notes";
import transcriptsRouter from "./routes/transcripts";

export const app = new Hono();

app.get("/", (c) => {
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
    },
  });
});

app.route("/api/patients", patientsRouter);
app.route("/api/doctors", doctorsRouter);
app.route("/api/sessions", sessionsRouter);
app.route("/api/notes", notesRouter);
app.route("/api/transcripts", transcriptsRouter);

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
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
