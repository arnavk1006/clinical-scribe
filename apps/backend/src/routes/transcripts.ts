import { Hono } from "hono";
import { db } from "../db/client";
import { transcripts, transcriptChunks } from "../db/schema";
import { eq } from "drizzle-orm";
import { promises as fs } from "fs";
import { join, resolve } from "path";
import { transcriptionQueue } from "../services/transcriptionQueue";
import { validator } from "hono/validator";

const getUploadDir = () => {
  if (process.env.UPLOAD_DIR) {
    return resolve(process.cwd(), process.env.UPLOAD_DIR);
  }
  return "/tmp";
};

const UPLOAD_DIR = getUploadDir();

const routes = new Hono()
  .get("/", async (c) => {
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
  })
  .get("/:id", async (c) => {
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
  })
  .get("/session/:sessionId", async (c) => {
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
  })
  .get("/process/:transcriptId/chunk/:chunkId", async (c) => {
    const transcriptId = c.req.param("transcriptId");
    const chunkId = c.req.param("chunkId");
    try {
      const transcriptExists = await db.query.transcripts.findFirst({
        where: (transcripts, { eq }) => eq(transcripts.id, transcriptId),
      });
      if (!transcriptExists) {
        return c.json({ error: "Transcript not found" }, 404);
      }

      const chunk = await db.query.transcriptChunks.findFirst({
        where: (chunks, { eq }) => eq(chunks.id, chunkId),
      });
      if (!chunk) {
        return c.json({ error: "Chunk not found" }, 404);
      }

      if (chunk.transcriptId !== transcriptId) {
        return c.json({ error: "Chunk does not belong to the given transcript" }, 400);
      }

      const inputPath = chunk.location;

      try {
        await fs.access(inputPath);
      } catch {
        return c.json({ error: "Chunk file not found on disk" }, 404);
      }

      await db
        .update(transcriptChunks)
        .set({ status: "processing" })
        .where(eq(transcriptChunks.id, chunkId));

      transcriptionQueue.enqueue({ transcriptId, chunkId });

      return c.json({
        message: "Processing started in the background",
        status: "processing",
      }, 202);
    } catch (error: any) { 
      return c.json({ error: error.message }, 500);
    }
  })
  .post(
    "/",
    validator("json", (value, c) => {
      const body = value as { sessionId?: string };
      if (!body.sessionId) {
        return c.json({ error: "SessionId is required" }, 400);
      }
      return { sessionId: body.sessionId };
    }),
    async (c) => {
      try {
        const { sessionId } = c.req.valid("json");

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

        return c.json(
          {
            ...newTranscript,
            chunks: [],
          },
          201,
        );
      } catch (error: any) {
        return c.json({ error: error.message }, 400);
      }
    }
  )
  .post(
    "/:id/chunks",
    validator("form", (value, c) => {
      const sequenceNumber = value["sequenceNumber"];
      const file = value["file"];

      if (sequenceNumber === undefined || !(file instanceof File)) {
        return c.json({ error: "sequenceNumber and file are required" }, 400);
      }

      return {
        sequenceNumber: String(sequenceNumber),
        file: file,
      };
    }),
    async (c) => {
      const transcriptId = c.req.param("id");
      try {
        const { sequenceNumber, file } = c.req.valid("form");

        const transcriptExists = await db.query.transcripts.findFirst({
          where: (transcripts, { eq }) => eq(transcripts.id, transcriptId),
        });
        if (!transcriptExists) {
          return c.json({ error: "Transcript not found" }, 404);
        }

        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        const extension = file.name?.split(".").pop() || "webm";
        const fileName = `${crypto.randomUUID()}.${extension}`;
        const filePath = join(UPLOAD_DIR, fileName);
        await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));

        const newChunk = {
          id: crypto.randomUUID(),
          transcriptId,
          sequenceNumber: Number(sequenceNumber),
          location: filePath, // Server-derived
          createdAt: new Date(),
        };

        await db.insert(transcriptChunks).values(newChunk);
        return c.json(newChunk, 201);
      } catch (error: any) {
        return c.json({ error: error.message }, 500);
      }
    }
  )
  .delete("/:id", async (c) => {
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

export default routes;
