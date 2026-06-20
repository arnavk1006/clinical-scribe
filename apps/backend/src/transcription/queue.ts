import { Queue } from "bullmq";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serveStatic } from "hono/bun";

export interface TranscriptionTask {
  chunkId: string;
}

export const redisConnection = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
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

createBullBoard({
  queues: [new BullMQAdapter(transcriptionQueue)],
  serverAdapter
});
