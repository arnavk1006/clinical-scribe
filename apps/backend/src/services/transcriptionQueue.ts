import { db } from "../db/client";
import { transcriptChunks } from "../db/schema";
import { eq } from "drizzle-orm";
import { join, resolve } from "path";

export interface TranscriptionTask {
  transcriptId: string;
  chunkId: string;
}

const getUploadDir = () => {
  if (process.env.UPLOAD_DIR) {
    return resolve(process.cwd(), process.env.UPLOAD_DIR);
  }
  return "/tmp";
};

const UPLOAD_DIR = getUploadDir();

class TranscriptionQueue {
  private queue: TranscriptionTask[] = [];
  private isProcessing = false;

  /**
   * Enqueue a chunk for background processing (resampling + STT).
   */
  public enqueue(task: TranscriptionTask) {
    this.queue.push(task);
    this.processNext();
  }

  /**
   * Processes the next task in the queue sequentially.
   */
  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift()!;

    try {
      await this.processChunk(task.transcriptId, task.chunkId);
    } catch (err) {
      console.error(`Failed to process chunk ${task.chunkId}:`, err);
      // Mark chunk as failed in the DB on error
      await db
        .update(transcriptChunks)
        .set({ status: "failed" })
        .where(eq(transcriptChunks.id, task.chunkId));
    } finally {
      this.isProcessing = false;
      // Trigger processing of next item on next tick to avoid stack overflow/recursion
      setTimeout(() => this.processNext(), 0);
    }
  }

  /**
   * Main processing pipeline for a single chunk:
   * 1. Sets status to "processing"
   * 2. Resamples raw audio to 16kHz mono WAV using ffmpeg
   * 3. Saves resampled path to DB
   * 4. Enters transcription step
   */
  private async processChunk(transcriptId: string, chunkId: string) {
    await db
      .update(transcriptChunks)
      .set({ status: "processing" })
      .where(eq(transcriptChunks.id, chunkId));

    const chunk = await db.query.transcriptChunks.findFirst({
      where: (chunks, { eq }) => eq(chunks.id, chunkId),
    });

    if (!chunk) {
      throw new Error(`Chunk ${chunkId} not found in DB`);
    }

    const inputPath = chunk.location;

    const inputFileName = inputPath.split(/[\\/]/).pop() || "";
    const fileNameWithoutExt =
      inputFileName.substring(0, inputFileName.lastIndexOf(".")) || inputFileName;
    const outputPath = join(UPLOAD_DIR, `${fileNameWithoutExt}_16k.wav`);

    const proc = Bun.spawn([
      "ffmpeg",
      "-y",
      "-nostdin",
      "-i",
      inputPath,
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
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

    await this.transcribeChunk(transcriptId, chunkId, outputPath);
  }

  /**
   * Transcribes a resampled WAV file using the STT model.
   * Implementation is stubbed for now.
   */
  private async transcribeChunk(
    transcriptId: string,
    chunkId: string,
    processedPath: string
  ) {
    // TODO: Implement actual whisper.cpp speech-to-text processing here in the next step.
    console.log(
      `[STT Stub] Transcribing processed audio at ${processedPath} for chunk ${chunkId}`
    );

    // Mark as completed
    await db
      .update(transcriptChunks)
      .set({
        status: "completed",
        transcribedText: "Mock transcribed text placeholder.",
      })
      .where(eq(transcriptChunks.id, chunkId));
  }
}

export const transcriptionQueue = new TranscriptionQueue();
