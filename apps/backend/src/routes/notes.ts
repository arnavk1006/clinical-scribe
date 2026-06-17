import { Hono } from "hono";
import { db } from "../db/client";
import { notes, sessions } from "../db/schema";
import { eq } from "drizzle-orm";
import type { NewNote } from "../types";

const app = new Hono();

// GET all notes
app.get("/", async (c) => {
  try {
    const allNotes = await db.query.notes.findMany();
    return c.json(allNotes);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// GET single note by ID
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const note = await db.query.notes.findFirst({
      where: (notes, { eq }) => eq(notes.id, id),
    });
    if (!note) {
      return c.json({ error: "Note not found" }, 404);
    }
    return c.json(note);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// GET notes by sessionId
app.get("/session/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  try {
    const result = await db.query.notes.findMany({
      where: (notes, { eq }) => eq(notes.sessionId, sessionId),
    });
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// POST create note
app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, subjective, objective, assessment, plan, doctorEdited } = body;

    if (!sessionId) {
      return c.json({ error: "SessionId is required" }, 400);
    }

    // Check if session exists
    const sessionExists = await db.query.sessions.findFirst({
      where: (sessions, { eq }) => eq(sessions.id, sessionId),
    });
    if (!sessionExists) {
      return c.json({ error: "Session not found" }, 404);
    }

    const noteId = crypto.randomUUID();

    const noteExists = await db.query.notes.findFirst({
      where: (notes, { eq }) => eq(notes.id, noteId),
    });
    if (noteExists) {
      return c.json({ error: "Note with given ID already exists" }, 409);
    }

    const now = new Date();
    const newNote = {
      id: noteId,
      sessionId,
      subjective: subjective || null,
      objective: objective || null,
      assessment: assessment || null,
      plan: plan || null,
      doctorEdited: doctorEdited !== undefined ? !!doctorEdited : false,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(notes).values(newNote);

    return c.json(newNote, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// PUT/PATCH update note
app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { subjective, objective, assessment, plan, doctorEdited } = body;

    const existing = await db.query.notes.findFirst({
      where: (notes, { eq }) => eq(notes.id, id),
    });
    if (!existing) {
      return c.json({ error: "Note not found" }, 404);
    }

    const updates: Partial<NewNote> = {};
    if (subjective !== undefined) updates.subjective = subjective;
    if (objective !== undefined) updates.objective = objective;
    if (assessment !== undefined) updates.assessment = assessment;
    if (plan !== undefined) updates.plan = plan;
    if (doctorEdited !== undefined) updates.doctorEdited = !!doctorEdited;
    
    // Always update updatedAt when changes are made
    updates.updatedAt = new Date();

    await db.update(notes).set(updates).where(eq(notes.id, id));

    const updatedResult = await db.query.notes.findFirst({
      where: (notes, { eq }) => eq(notes.id, id),
    });
    if (!updatedResult) {
      return c.json({ error: "Note not found" }, 404);
    }
    return c.json(updatedResult);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// DELETE note
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const existing = await db.query.notes.findFirst({
      where: (notes, { eq }) => eq(notes.id, id),
    });
    if (!existing) {
      return c.json({ error: "Note not found" }, 404);
    }

    await db.delete(notes).where(eq(notes.id, id));
    return c.json({ message: "Note deleted successfully" });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default app;
