import { Queue } from "bullmq";
import { redisConnection, defaultJobOptions } from "./connection";

export interface SoapGenerationTask {
  sessionId: string;
}

export const soapGenerationQueue = new Queue<SoapGenerationTask>("soap-generation", {
  connection: redisConnection,
  defaultJobOptions
});
