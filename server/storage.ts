import { type Sift, type InsertSift, sifts } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, sql } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

// Ensure table exists (no migrations in prototype)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS sifts (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    input TEXT NOT NULL,
    input_mode TEXT NOT NULL,
    themes TEXT NOT NULL,
    core_intent TEXT NOT NULL,
    next_step TEXT NOT NULL,
    reflection TEXT NOT NULL
  );
`);

export const db = drizzle(sqlite);

export interface IStorage {
  createSift(sift: InsertSift): Promise<Sift>;
  getSift(id: string): Promise<Sift | undefined>;
}

export class DatabaseStorage implements IStorage {
  async createSift(insertSift: InsertSift): Promise<Sift> {
    const row = {
      ...insertSift,
      createdAt: Date.now(),
    };
    return db.insert(sifts).values(row).returning().get();
  }

  async getSift(id: string): Promise<Sift | undefined> {
    return db.select().from(sifts).where(eq(sifts.id, id)).get();
  }
}

export const storage = new DatabaseStorage();
