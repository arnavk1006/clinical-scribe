if (!process.env.REDIS_HOST) {
  throw new Error("REDIS_HOST environment variable is not set");
}
if (!process.env.REDIS_PORT) {
  throw new Error("REDIS_PORT environment variable is not set");
}

export const redisConnection = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT, 10),
};

export const defaultJobOptions = {
  attempts: 4,
  backoff: {
    type: "exponential" as const,
    delay: 1000,
  },
};
