import { Worker, type Job } from "bullmq";
import { redisConnection } from "../queues";
import { join, resolve } from "path";
import { type TranscriptChunk, fetchTranscriptChunk } from "../db/queries";
import { db } from "../db/client";
import { transcriptChunks } from "../db/schema";
import { eq } from "drizzle-orm";

if (!process.env.WHISPER_SERVER_URL) {
  throw new Error("WHISPER_SERVER_URL environment variable is not set");
}

if (!process.env.UPLOAD_DIR) {
  throw new Error("UPLOAD_DIR environment variable is not set");
}

const getUploadDir = () => {
  return resolve(process.cwd(), process.env.UPLOAD_DIR!);
};

async function resampleAudio(chunk: TranscriptChunk): Promise<string> {
  const inputPath = chunk.location;

  // Extract the filename without the directories
  const inputFileName = inputPath.split(/[\\/]/).pop() || "";
  const fileNameWithoutExt =
    inputFileName.substring(0, inputFileName.lastIndexOf(".")) || inputFileName;
  
  const outputPath = join(getUploadDir(), `${fileNameWithoutExt}_16k.wav`);

  const proc = Bun.spawn([
    "ffmpeg",
    "-y",
    "-nostdin",
    "-i",
    inputPath,
    "-ar",
    "16000", // 16 k
    "-ac",
    "1",
    "-c:a",
    "pcm_s16le", // PCM 16-bit little-endian
    outputPath,
  ]);

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`ffmpeg exited with code ${exitCode}`);
  }

  await db
    .update(transcriptChunks)
    .set({ processedLocation: outputPath })
    .where(eq(transcriptChunks.id, chunk.id));

  return outputPath;
}

async function transcribeAudio(chunkId: string, wavPath: string): Promise<string> {
  const whisperRequestBody = new FormData();
  whisperRequestBody.append("file", Bun.file(wavPath));
  whisperRequestBody.append("response_format", "json");

  const res = await fetch(`${process.env.WHISPER_SERVER_URL}/inference`, {
    method: "POST",
    body: whisperRequestBody,
  });

  if (!res.ok) {
    throw new Error(`whisper-server returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  if (data && typeof data === "object" && "text" in data) {
    const text = (data as { text: string }).text;
    await db
      .update(transcriptChunks)
      .set({
        status: "completed",
        transcribedText: text,
      })
      .where(eq(transcriptChunks.id, chunkId));
    return text;
  } else {
    throw new Error(`whisper-server returned invalid response format: ${JSON.stringify(data)}`);
  }
}

export async function processTranscriptionChunk(chunkId: string): Promise<void> {
  const chunk = await fetchTranscriptChunk(chunkId);
  const outputPath = await resampleAudio(chunk);
  await transcribeAudio(chunk.id, outputPath);
}

export const transcriptionWorker = new Worker(
  "transcription",
  async (job: Job) => {
    const { chunkId } = job.data;

    try {
      await processTranscriptionChunk(chunkId);
    } catch (error: any) {
      // Worker returns a promise on completion, which doesn't happen in case
      // an error is thrown. This tells the queue there needs to be a retry.
      const attemptsMade = job.attemptsMade;
      const totalAttempts = job.opts.attempts ?? 1;
      
      console.error(`Failed to process chunk ${chunkId} (attempt ${attemptsMade}/${totalAttempts}):`, error);
      
      await db
        .update(transcriptChunks)
        .set({ status: attemptsMade < totalAttempts ? "retrying" : "failed" })
        .where(eq(transcriptChunks.id, chunkId));
      throw error;
    }
  },
  { connection: redisConnection }
);
