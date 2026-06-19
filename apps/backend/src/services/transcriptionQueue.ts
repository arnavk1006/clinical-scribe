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
      await this.processChunk(task.chunkId);
    } catch (err) {
      console.error(`Failed to process chunk ${task.chunkId}:`, err);
      // Mark chunk as failed in the DB on error
      await db
        .update(transcriptChunks)
        .set({ status: "failed" })
        .where(eq(transcriptChunks.id, task.chunkId));
    } finally {
      this.isProcessing = false;
      // Yields control back to the event loop. This converts synchronous recursion 
      // into an async loop, clearing the call stack to prevent a stack overflow 
      // when processing long queues.
      // The `processNext` task is put on the MacroTask queue, which has the least
      // priority for processing.
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
  private async processChunk(chunkId: string) {
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

    await this.transcribeChunk(chunkId, outputPath);
  }

  /**
   * Transcribes a resampled WAV file using the STT model.
   */
   private async transcribeChunk(
      chunkId: string,
      processedPath: string
    ) {
      const whisperRequestBody = new FormData();
      whisperRequestBody.append('file', Bun.file(processedPath));
      whisperRequestBody.append('response_format', 'json');

      const res = await fetch(`${process.env.WHISPER_SERVER_URL}/inference`, {
        method: 'POST',
        body: whisperRequestBody,
      });

      if (!res.ok) {
        throw new Error(`whisper-server returned ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      if (data && typeof data === 'object' && 'text' in data) {
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
    }
}

export const transcriptionQueue = new TranscriptionQueue();
