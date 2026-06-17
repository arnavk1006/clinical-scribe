import { describe, expect, it, beforeAll } from "bun:test";
import { app } from "./index";
import { db } from "./db/client";
import { patients, doctors, sessions, transcripts, transcriptChunks, notes } from "./db/schema";
import { eq } from "drizzle-orm";

describe("Clinical Scribe Backend API", () => {
  let doctorId: string;
  let patientId: string;
  let sessionId: string;
  let noteId: string;
  let transcriptId: string;

  beforeAll(async () => {
    // Clean and seed the database to a known state
    await db.delete(notes);
    await db.delete(transcriptChunks);
    await db.delete(transcripts);
    await db.delete(sessions);
    await db.delete(patients);
    await db.delete(doctors);

    // Create doctor
    doctorId = "doc-test";
    await db.insert(doctors).values({
      id: doctorId,
      name: "Dr. Test",
      email: "dr.test@hospital.org",
      passwordHash: "hash",
      createdAt: new Date(),
    });

    // Create patient
    patientId = "pat-test";
    await db.insert(patients).values({
      id: patientId,
      name: "Patient Test",
      email: "patient.test@gmail.com",
      passwordHash: "hash",
      mrn: "MRN-TEST",
      dateOfBirth: new Date("1990-01-01"),
      createdAt: new Date(),
    });

    // Create session
    sessionId = "session-test";
    await db.insert(sessions).values({
      id: sessionId,
      patientId,
      doctorId,
      status: "recording",
      createdAt: new Date(),
    });
  });

  describe("Health Check", () => {
    it("should return the endpoints listing", async () => {
      const res = await app.request("/");
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data).toHaveProperty("endpoints");
      expect(data.endpoints.notes).toBe("/api/notes");
      expect(data.endpoints.transcripts).toBe("/api/transcripts");
    });
  });

  describe("Notes Router", () => {
    it("should create a new note", async () => {
      const res = await app.request("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          subjective: "Patient reports mild headache.",
          objective: "Vitals normal.",
          assessment: "Tension headache.",
          plan: "Rest and hydration.",
          doctorEdited: false,
        }),
      });

      expect(res.status).toBe(201);
      const data = (await res.json()) as any;
      expect(data).toHaveProperty("id");
      expect(data.sessionId).toBe(sessionId);
      expect(data.subjective).toBe("Patient reports mild headache.");
      noteId = data.id;
    });

    it("should get note by ID", async () => {
      const res = await app.request(`/api/notes/${noteId}`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.id).toBe(noteId);
      expect(data.subjective).toBe("Patient reports mild headache.");
    });

    it("should get notes by session ID", async () => {
      const res = await app.request(`/api/notes/session/${sessionId}`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].id).toBe(noteId);
    });

    it("should update a note", async () => {
      const res = await app.request(`/api/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjective: "Patient reports resolved headache.",
          doctorEdited: true,
        }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.subjective).toBe("Patient reports resolved headache.");
      expect(data.doctorEdited).toBe(true);
    });
  });

  describe("Transcripts Router", () => {
    it("should create a new transcript", async () => {
      const res = await app.request("/api/transcripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
        }),
      });

      expect(res.status).toBe(201);
      const data = (await res.json()) as any;
      expect(data).toHaveProperty("id");
      expect(data.sessionId).toBe(sessionId);
      expect(data.chunks.length).toBe(0);
      transcriptId = data.id;

      // Seed chunks directly in database for subsequent tests
      await db.insert(transcriptChunks).values([
        {
          id: crypto.randomUUID(),
          transcriptId,
          sequenceNumber: 0,
          location: "s3://clinical-scribe/transcripts/chunk0.json",
          createdAt: new Date(),
        },
        {
          id: crypto.randomUUID(),
          transcriptId,
          sequenceNumber: 1,
          location: "/local/path/to/chunk1.json",
          createdAt: new Date(),
        },
      ]);
    });

    it("should get transcript by ID with chunks in order", async () => {
      const res = await app.request(`/api/transcripts/${transcriptId}`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.id).toBe(transcriptId);
      expect(data.chunks.length).toBe(2);
      expect(data.chunks[0].sequenceNumber).toBe(0);
      expect(data.chunks[1].sequenceNumber).toBe(1);
    });

    it("should add a chunk to an existing transcript", async () => {
      const formData = new FormData();
      formData.append("sequenceNumber", "2");
      const file = new File(["test chunk audio data"], "chunk2.webm", { type: "audio/webm" });
      formData.append("file", file);

      const res = await app.request(`/api/transcripts/${transcriptId}/chunks`, {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(201);
      const data = (await res.json()) as any;
      expect(data.transcriptId).toBe(transcriptId);
      expect(data.sequenceNumber).toBe(2);
      expect(data.location).toContain(".webm");

      // Verify it was added
      const getRes = await app.request(`/api/transcripts/${transcriptId}`);
      const getData = (await getRes.json()) as any;
      expect(getData.chunks.length).toBe(3);
      expect(getData.chunks[2].sequenceNumber).toBe(2);

      // Clean up the created file on disk
      const { promises: fs } = await import("fs");
      try {
        await fs.unlink(data.location);
      } catch (err) {
        // Ignore if file doesn't exist
      }
    });

    it("should get transcripts by session ID", async () => {
      const res = await app.request(`/api/transcripts/session/${sessionId}`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].id).toBe(transcriptId);
      expect(data[0].chunks.length).toBe(3);
    });

    it("should delete transcript and cascade delete chunks", async () => {
      // Confirm chunks exist in DB first
      const chunksBefore = await db.select().from(transcriptChunks).where(eq(transcriptChunks.transcriptId, transcriptId));
      expect(chunksBefore.length).toBe(3);

      const deleteRes = await app.request(`/api/transcripts/${transcriptId}`, {
        method: "DELETE",
      });
      expect(deleteRes.status).toBe(200);

      // Verify transcript is gone
      const getRes = await app.request(`/api/transcripts/${transcriptId}`);
      expect(getRes.status).toBe(404);

      // Verify chunks are cascadingly deleted
      const chunksAfter = await db.select().from(transcriptChunks).where(eq(transcriptChunks.transcriptId, transcriptId));
      expect(chunksAfter.length).toBe(0);
    });

    describe("Process Transcript Chunk", () => {
      let processSessionId: string;
      let processTranscriptId: string;
      let processChunkId: string;
      let correctFilePath: string;

      beforeAll(async () => {
        // Seed an isolated session to prevent side effects in other tests
        processSessionId = `session-process-${crypto.randomUUID()}`;
        await db.insert(sessions).values({
          id: processSessionId,
          patientId: "pat-test",
          doctorId: "doc-test",
          status: "recording",
          createdAt: new Date(),
        });

        const res = await app.request("/api/transcripts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: processSessionId }),
        });
        const data = (await res.json()) as any;
        processTranscriptId = data.id;

        processChunkId = crypto.randomUUID();
        correctFilePath = `/tmp/${crypto.randomUUID()}.wav`;

        await db.insert(transcriptChunks).values({
          id: processChunkId,
          transcriptId: processTranscriptId,
          sequenceNumber: 0,
          location: correctFilePath,
          createdAt: new Date(),
        });
      });

      it("should return 404 if the transcript does not exist", async () => {
        const res = await app.request(`/api/transcripts/process/non-existent-transcript/chunk/${processChunkId}`);
        expect(res.status).toBe(404);
        const data = await res.json() as any;
        expect(data.error).toContain("Transcript not found");
      });

      it("should return 404 if the chunk does not exist", async () => {
        const res = await app.request(`/api/transcripts/process/${processTranscriptId}/chunk/non-existent-chunk`);
        expect(res.status).toBe(404);
        const data = await res.json() as any;
        expect(data.error).toContain("Chunk not found");
      });

      it("should return 400 if the chunk belongs to a different transcript", async () => {
        const otherRes = await app.request("/api/transcripts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: processSessionId }),
        });
        const otherData = (await otherRes.json()) as any;
        const otherTranscriptId = otherData.id;

        const res = await app.request(`/api/transcripts/process/${otherTranscriptId}/chunk/${processChunkId}`);
        expect(res.status).toBe(400);
        const data = await res.json() as any;
        expect(data.error).toContain("Chunk does not belong to the given transcript");
      });

      it("should return 404 if the physical chunk file is missing on disk", async () => {
        const res = await app.request(`/api/transcripts/process/${processTranscriptId}/chunk/${processChunkId}`);
        expect(res.status).toBe(404);
        const data = await res.json() as any;
        expect(data.error).toContain("Chunk file not found on disk");
      });

      it("should process the chunk in the background successfully and return 202", async () => {
        const { promises: fs } = await import("fs");
        
        // Use Bun.spawn to safely generate the silent audio file
        const proc = Bun.spawn([
          "ffmpeg",
          "-y",
          "-nostdin",
          "-f",
          "lavfi",
          "-i",
          "anullsrc=r=44100:cl=mono",
          "-t",
          "1",
          correctFilePath,
        ]);
        const exitCode = await proc.exited;
        expect(exitCode).toBe(0);

        const res = await app.request(`/api/transcripts/process/${processTranscriptId}/chunk/${processChunkId}`);
        expect(res.status).toBe(202);
        const data = await res.json() as any;
        expect(data.message).toBe("Processing started in the background");
        expect(data.status).toBe("processing");

        // Poll DB to verify async execution completes
        let chunkInDb;
        for (let i = 0; i < 30; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          chunkInDb = await db.query.transcriptChunks.findFirst({
            where: (chunks, { eq }) => eq(chunks.id, processChunkId),
          });
          if (chunkInDb && (chunkInDb.status === "completed" || chunkInDb.status === "failed")) {
            break;
          }
        }

        expect(chunkInDb).toBeDefined();
        expect(chunkInDb!.status).toBe("completed");
        expect(chunkInDb!.transcribedText).toBe("Mock transcribed text placeholder.");
        expect(chunkInDb!.processedLocation).toBeDefined();

        await fs.access(chunkInDb!.processedLocation!);

        try {
          await fs.unlink(correctFilePath);
          await fs.unlink(chunkInDb!.processedLocation!);
        } catch (err) {
          // Ignore errors
        }
      });
    });
  });
});
