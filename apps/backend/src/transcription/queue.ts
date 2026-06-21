import { Queue } from "bullmq";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serveStatic } from "hono/bun";

export interface TranscriptionTask {
  chunkId: string;
}

if (!process.env.REDIS_HOST) {
  throw new Error("REDIS_HOST environment variable is not set");
}
if (!process.env.REDIS_PORT) {
  throw new Error("REDIS_PORT environment variable is not set");
}

export const redisConnection = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT, 10),
}

export const transcriptionQueue = new Queue<TranscriptionTask>("transcription", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 4,
    backoff: {
      type: "exponential",
      delay: 1000,
    }
  }
});

export const serverAdapter = new HonoAdapter(serveStatic);
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(transcriptionQueue)],
  serverAdapter
});
