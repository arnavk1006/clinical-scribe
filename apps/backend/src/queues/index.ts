import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serveStatic } from "hono/bun";
import { transcriptionQueue } from "./transcription";
import { soapGenerationQueue } from "./soap-generation";
import { redisConnection, defaultJobOptions } from "./connection";

export const serverAdapter = new HonoAdapter(serveStatic);
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [
    new BullMQAdapter(transcriptionQueue),
    new BullMQAdapter(soapGenerationQueue),
  ],
  serverAdapter,
});

export { redisConnection, defaultJobOptions, transcriptionQueue, soapGenerationQueue };
