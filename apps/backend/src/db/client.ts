import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const sqlite = new Database(
  process.env.DATABASE_PATH ?? "./data/clinical-scribe.sqlite",
);
sqlite.run("PRAGMA foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
