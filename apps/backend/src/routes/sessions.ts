import { Hono } from "hono";
import { db } from "../db/client";
import { sessions } from "../db/schema";
import { eq } from "drizzle-orm";

const app = new Hono();

app.get("/", async (c) => {
  try {
    const allSessions = await db.query.sessions.findMany();
    return c.json(allSessions);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const session = await db.query.sessions.findFirst({
      where: (sessions, { eq }) => eq(sessions.id, id),
    });
    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }
    return c.json(session);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { patientId, doctorId, status, audioPath } = body;

    if (!patientId || !doctorId) {
      return c.json({ error: "PatientId and DoctorId are required" }, 400);
    }

    const patientExists = await db.query.patients.findFirst({
      where: (patients, { eq }) => eq(patients.id, patientId),
    });
    if (!patientExists) {
      return c.json({ error: "Patient not found" }, 404);
    }

    const doctorExists = await db.query.doctors.findFirst({
      where: (doctors, { eq }) => eq(doctors.id, doctorId),
    });
    if (!doctorExists) {
      return c.json({ error: "Doctor not found" }, 404);
    }

    const sessionId = crypto.randomUUID();

    const sessionExists = await db.query.sessions.findFirst({
      where: (sessions, { eq }) => eq(sessions.id, sessionId),
    });
    if (sessionExists) {
      return c.json({ error: "Session with given ID already exists" }, 409);
    }

    const newSession = {
      id: sessionId,
      patientId,
      doctorId,
      status: status || "recording",
      audioPath: audioPath || null,
      createdAt: new Date(),
      endedAt: null,
    };

    await db.insert(sessions).values(newSession);

    return c.json(newSession, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { status, audioPath, endedAt } = body;

    const existing = await db.query.sessions.findFirst({
      where: (sessions, { eq }) => eq(sessions.id, id),
    });
    if (!existing) {
      return c.json({ error: "Session not found" }, 404);
    }

    const updates: Partial<typeof sessions.$inferInsert> = {};
    if (status !== undefined) {
      if (!["recording", "processing", "transcribed", "reviewed"].includes(status)) {
        return c.json({ error: "Invalid status value" }, 400);
      }
      updates.status = status;
    }
    if (audioPath !== undefined) updates.audioPath = audioPath || null;
    if (endedAt !== undefined) updates.endedAt = endedAt ? new Date(endedAt) : null;

    if (Object.keys(updates).length === 0) {
      return c.json({ message: "No updates provided" });
    }

    await db.update(sessions).set(updates).where(eq(sessions.id, id));

    const updatedResult = await db.query.sessions.findFirst({
      where: (sessions, { eq }) => eq(sessions.id, id),
    });
    if (!updatedResult) {
      return c.json({ error: "Session not found" }, 404);
    }
    return c.json(updatedResult);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const existing = await db.query.sessions.findFirst({
      where: (sessions, { eq }) => eq(sessions.id, id),
    });
    if (!existing) {
      return c.json({ error: "Session not found" }, 404);
    }

    await db.delete(sessions).where(eq(sessions.id, id));
    return c.json({ message: "Session deleted successfully" });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default app;
