import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

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
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: "./src/db/migrations" });
console.log("Migrations applied.");
