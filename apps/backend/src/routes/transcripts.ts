import { Hono } from "hono";
import { db } from "../db/client";
import { transcripts, transcriptChunks, sessions } from "../db/schema";
import { eq, asc } from "drizzle-orm";

const app = new Hono();

app.get("/", async (c) => {
  try {
    const allTranscripts = await db.query.transcripts.findMany();

    const result = [];
    for (const transcript of allTranscripts) {
      const chunks = await db.query.transcriptChunks.findMany({
        where: (chunks, { eq }) => eq(chunks.transcriptId, transcript.id),
        orderBy: (chunks, { asc }) => asc(chunks.sequenceNumber),
      });

      result.push({
        ...transcript,
        chunks,
      });
    }

    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const transcript = await db.query.transcripts.findFirst({
      where: (transcripts, { eq }) => eq(transcripts.id, id),
    });

    if (!transcript) {
      return c.json({ error: "Transcript not found" }, 404);
    }

    const chunks = await db.query.transcriptChunks.findMany({
      where: (chunks, { eq }) => eq(chunks.transcriptId, id),
      orderBy: (chunks, { asc }) => asc(chunks.sequenceNumber),
    });

    return c.json({
      ...transcript,
      chunks,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get("/session/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  try {
    // Multiple transcripts per session can be used when there are multiple
    // audio input streams (like over a video call)
    const allTranscripts = await db.query.transcripts.findMany({
      where: (transcripts, { eq }) => eq(transcripts.sessionId, sessionId),
    });

    const result = [];
    for (const transcript of allTranscripts) {
      const chunks = await db.query.transcriptChunks.findMany({
        where: (chunks, { eq }) => eq(chunks.transcriptId, transcript.id),
        orderBy: (chunks, { asc }) => asc(chunks.sequenceNumber),
      });

      result.push({
        ...transcript,
        chunks,
      });
    }

    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, chunks } = body;

    if (!sessionId) {
      return c.json({ error: "SessionId is required" }, 400);
    }

    const sessionExists = await db.query.sessions.findFirst({
      where: (sessions, { eq }) => eq(sessions.id, sessionId),
    });
    if (!sessionExists) {
      return c.json({ error: "Session not found" }, 404);
    }

    const transcriptId = crypto.randomUUID();
    const now = new Date();

    const newTranscript = {
      id: transcriptId,
      sessionId,
      createdAt: now,
    };

    const transcriptExists = await db.query.transcripts.findFirst({
      where: (transcripts, { eq }) => eq(transcripts.id, transcriptId),
    });
    if (transcriptExists) { 
      return c.json({error: "Transcript with given ID already exists"}, 409)
    }

    await db.insert(transcripts).values(newTranscript);

    const createdChunks = [];
    if (chunks && Array.isArray(chunks)) {
      for (const chunk of chunks) {
        const { id, sequenceNumber, location } = chunk;
        if (sequenceNumber === undefined || !location) {
          throw new Error("Each chunk must have a sequenceNumber and location");
        }
        const newChunk = {
          id: id || crypto.randomUUID(),
          transcriptId,
          sequenceNumber: Number(sequenceNumber),
          location,
          createdAt: now,
        };
        await db.insert(transcriptChunks).values(newChunk);
        createdChunks.push(newChunk);
      }
    }

    return c.json(
      {
        ...newTranscript,
        chunks: createdChunks,
      },
      201,
    );
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post("/:id/chunks", async (c) => {
  const transcriptId = c.req.param("id");
  try {
    const body = await c.req.json();
    const { id, sequenceNumber, location } = body;

    if (sequenceNumber === undefined || !location) {
      return c.json({ error: "SequenceNumber and location are required" }, 400);
    }

    const transcriptExists = await db.query.transcripts.findFirst({
      where: (transcripts, { eq }) => eq(transcripts.id, transcriptId),
    });
    if (!transcriptExists) {
      return c.json({ error: "Transcript not found" }, 404);
    }

    const newChunk = {
      id: id || crypto.randomUUID(),
      transcriptId,
      sequenceNumber: Number(sequenceNumber),
      location,
      createdAt: new Date(),
    };

    await db.insert(transcriptChunks).values(newChunk);

    return c.json(newChunk, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const existing = await db.query.transcripts.findFirst({
      where: (transcripts, { eq }) => eq(transcripts.id, id),
    });
    if (!existing) {
      return c.json({ error: "Transcript not found" }, 404);
    }

    await db.delete(transcripts).where(eq(transcripts.id, id));
    return c.json({ message: "Transcript deleted successfully" });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default app;
