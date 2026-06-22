import { Queue } from "bullmq";
import { redisConnection, defaultJobOptions } from "./connection";

export interface TranscriptionTask {
  chunkId: string;
}

export const transcriptionQueue = new Queue<TranscriptionTask>("transcription", {
  connection: redisConnection,
  defaultJobOptions
});
