import fs from "node:fs";
import path from "node:path";
import type { Database } from "./types";
import { createSeedDatabase } from "./seed";

const DB_PATH = path.join(process.cwd(), ".data", "db.json");

declare global {
  var __dtrDb: Database | undefined;
}

function loadFromDisk(): Database {
  if (fs.existsSync(DB_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8")) as Database;
      if (!data.contentBlocks) data.contentBlocks = [];
      if (!data.aiRoleplayScenarios) data.aiRoleplayScenarios = [];
      if (!data.aiRoleplaySessions) data.aiRoleplaySessions = [];
      return data;
    } catch {
      // fall through to reseed on parse failure
    }
  }
  const seeded = createSeedDatabase();
  saveToDisk(seeded);
  return seeded;
}

export function saveToDisk(db: Database) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

export function getDb(): Database {
  if (!globalThis.__dtrDb) {
    globalThis.__dtrDb = loadFromDisk();
  }
  return globalThis.__dtrDb;
}

export function persist() {
  saveToDisk(getDb());
}

export function resetDb() {
  globalThis.__dtrDb = createSeedDatabase();
  saveToDisk(globalThis.__dtrDb);
}

export function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
