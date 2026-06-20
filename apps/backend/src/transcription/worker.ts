import { Worker } from "bullmq";
import { db } from "../db/client";
import { transcriptChunks } from "../db/schema";
import { eq } from "drizzle-orm";
import { redisConnection } from "./queue";
import { join, resolve } from "path";

const getUploadDir = () => {
  if (process.env.UPLOAD_DIR) {
    return resolve(process.cwd(), process.env.UPLOAD_DIR);
  }
  return "/tmp";
};

export const transcriptionWorker = new Worker(
  "transcription",
  async (job) => {
    // BullMQ automatically retrieves the job payload from Redis
    const { chunkId } = job.data;

    try {
      const chunk = await db.query.transcriptChunks.findFirst({
        where: (chunks, { eq }) => eq(chunks.id, chunkId),
      });

      if (!chunk) {
        throw new Error(`Chunk ${chunkId} was not found in database`);
      }

      const inputPath = chunk.location;

      // Extract the filename without the directories
      const inputFileName = inputPath.split(/[\\/]/).pop() || "";
      const fileNameWithoutExt =
        inputFileName.substring(0, inputFileName.lastIndexOf(".")) || inputFileName;
      // New re-sampling format is 16k which is compatible with the STT model. We also convert to mono and PCM 16-bit little-endian format.
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
        .where(eq(transcriptChunks.id, chunkId));

      const whisperRequestBody = new FormData();
      whisperRequestBody.append("file", Bun.file(outputPath));
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
        await db
          .update(transcriptChunks)
          .set({
            status: "completed",
            transcribedText: (data as { text: string }).text,
          })
          .where(eq(transcriptChunks.id, chunkId));
      } else {
        throw new Error(`whisper-server returned invalid response format: ${JSON.stringify(data)}`);
      }
    } catch (error: any) {
      // Worker returns a promise on completion, which doesn't happen in case
      // an error is thrown. This tells the queue there needs to be a retry.

      const attemptsMade = job.attemptsMade;
      const totalAttempts = job.opts.attempts ?? 1;
      
      console.error(`Failed to process chunk ${chunkId} (attempt ${attemptsMade}/${totalAttempts}):`, error);
      
      await db
        .update(transcriptChunks)
        .set({ status: attemptsMade < totalAttempts ? "retrying": "failed" })
        .where(eq(transcriptChunks.id, chunkId));
      throw error;
    }
  },
  { connection: redisConnection }
);
