import { db } from "./client";
import { transcripts, transcriptChunks } from "./schema";

export type Transcript = typeof transcripts.$inferSelect;
export type TranscriptChunk = typeof transcriptChunks.$inferSelect;

export async function fetchTranscripts(sessionId: string): Promise<Transcript[]> {
  const session = await db.query.sessions.findFirst({
    where: (sessions, { eq }) => eq(sessions.id, sessionId),
  });

  if (!session) {
    throw new Error(`Session ${sessionId} was not found in database`);
  }

  return await db.query.transcripts.findMany({
    where: (transcripts, { eq }) => eq(transcripts.sessionId, sessionId),
  });
}

export async function fetchTranscriptChunk(transcriptChunkId: string): Promise<TranscriptChunk> {
  const transcriptChunk = await db.query.transcriptChunks.findFirst({
    where: (transcriptChunks, { eq }) => eq(transcriptChunks.id, transcriptChunkId),
  });

  if (!transcriptChunk) {
    throw new Error(`TranscriptChunk ${transcriptChunkId} was not found in database`);
  }

  return transcriptChunk;
}

export async function fetchTranscriptChunks(transcriptId: string): Promise<TranscriptChunk[]> {
  const transcript = await db.query.transcripts.findFirst({
    where: (transcripts, { eq }) => eq(transcripts.id, transcriptId),
  });

  if (!transcript) {
    throw new Error(`Transcript ${transcriptId} was not found in database`);
  }

  return await db.query.transcriptChunks.findMany({
    where: (transcriptChunks, { eq }) => eq(transcriptChunks.transcriptId, transcriptId),
    orderBy: (transcriptChunks, { asc }) => asc(transcriptChunks.sequenceNumber),
  });
}
