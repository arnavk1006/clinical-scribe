import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

import { mkdirSync } from "fs";
import { dirname } from "path";

if (!process.env.DATABASE_PATH) {
  throw new Error("DATABASE_PATH environment variable is not set");
}
const dbPath = process.env.DATABASE_PATH;
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.run("PRAGMA journal_mode = WAL");
sqlite.run("PRAGMA foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
