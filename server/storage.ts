import {
  type Sift,
  type InsertSift,
  type User,
  type SiftListItem,
  type Checkin,
  sifts,
  users,
  checkins,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc, like, or, isNull, asc } from "drizzle-orm";

// DB path is configurable so the production host can mount a persistent volume.
// Fly.io mounts volumes at /data by default — set DB_PATH=/data/sift.db there.
const sqlite = new Database(process.env.DB_PATH || "data.db");
sqlite.pragma("journal_mode = WAL");

// --- Ensure tables (prototype, no migrations) ---
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
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    handle TEXT NOT NULL UNIQUE,
    passphrase_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sift_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    status TEXT NOT NULL,
    note TEXT NOT NULL,
    response TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_checkins_sift ON checkins(sift_id, created_at ASC);
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

// Add user_id column to sifts if it doesn't exist (safe migration for prototype)
const siftCols = sqlite
  .prepare(`PRAGMA table_info(sifts);`)
  .all() as Array<{ name: string }>;
if (!siftCols.some((c) => c.name === "user_id")) {
  sqlite.exec(`ALTER TABLE sifts ADD COLUMN user_id INTEGER;`);
}

// Safe migration: add contact + consent columns to users if missing. Existing
// rows get NULL email/phone and 0 for both consent flags (= never opted in).
const userCols = sqlite
  .prepare(`PRAGMA table_info(users);`)
  .all() as Array<{ name: string }>;
if (!userCols.some((c) => c.name === "email")) {
  sqlite.exec(`ALTER TABLE users ADD COLUMN email TEXT;`);
}
if (!userCols.some((c) => c.name === "phone")) {
  sqlite.exec(`ALTER TABLE users ADD COLUMN phone TEXT;`);
}
if (!userCols.some((c) => c.name === "consent_updates")) {
  sqlite.exec(
    `ALTER TABLE users ADD COLUMN consent_updates INTEGER NOT NULL DEFAULT 0;`
  );
}
if (!userCols.some((c) => c.name === "consent_reflections")) {
  sqlite.exec(
    `ALTER TABLE users ADD COLUMN consent_reflections INTEGER NOT NULL DEFAULT 0;`
  );
}

sqlite.exec(
  `CREATE INDEX IF NOT EXISTS idx_sifts_user_created
     ON sifts(user_id, created_at DESC);`
);

export const db = drizzle(sqlite);

// Expose the raw sqlite handle for non-ORM use cases (session lookups on the
// hot auth path, where a prepared statement is cheaper than Drizzle overhead).
export const rawDb = sqlite;

export interface IStorage {
  // Sifts
  createSift(sift: InsertSift): Promise<Sift>;
  getSift(id: string): Promise<Sift | undefined>;
  listSiftsByUser(userId: number, q?: string): Promise<SiftListItem[]>;
  deleteSift(id: string, userId: number): Promise<boolean>;
  // Users
  createUser(params: CreateUserParams): Promise<User>;
  getUserByHandle(handle: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  updateUserContact(
    userId: number,
    params: UpdateUserContactParams,
  ): Promise<User | undefined>;
  // Checkins
  createCheckin(row: Omit<Checkin, "id" | "createdAt">): Promise<Checkin>;
  listCheckins(siftId: string): Promise<Checkin[]>;
}

export type CreateUserParams = {
  handle: string;
  passphraseHash: string;
  email?: string | null;
  phone?: string | null;
  consentUpdates?: boolean;
  consentReflections?: boolean;
};

export type UpdateUserContactParams = {
  email?: string | null;
  phone?: string | null;
  consentUpdates?: boolean;
  consentReflections?: boolean;
};

export class DatabaseStorage implements IStorage {
  async createSift(insertSift: InsertSift): Promise<Sift> {
    const row = { ...insertSift, createdAt: Date.now() };
    return db.insert(sifts).values(row).returning().get();
  }

  async getSift(id: string): Promise<Sift | undefined> {
    return db.select().from(sifts).where(eq(sifts.id, id)).get();
  }

  async listSiftsByUser(userId: number, q?: string): Promise<SiftListItem[]> {
    const base = db
      .select({
        id: sifts.id,
        createdAt: sifts.createdAt,
        coreIntent: sifts.coreIntent,
        nextStep: sifts.nextStep,
      })
      .from(sifts);

    const where = q && q.trim()
      ? and(
          eq(sifts.userId, userId),
          or(
            like(sifts.coreIntent, `%${q}%`),
            like(sifts.nextStep, `%${q}%`),
            like(sifts.themes, `%${q}%`),
            like(sifts.input, `%${q}%`)
          )
        )
      : eq(sifts.userId, userId);

    return base.where(where).orderBy(desc(sifts.createdAt)).all();
  }

  async deleteSift(id: string, userId: number): Promise<boolean> {
    const res = db
      .delete(sifts)
      .where(and(eq(sifts.id, id), eq(sifts.userId, userId)))
      .run();
    return res.changes > 0;
  }

  async createUser(params: CreateUserParams): Promise<User> {
    return db
      .insert(users)
      .values({
        handle: params.handle,
        passphraseHash: params.passphraseHash,
        email: params.email ?? null,
        phone: params.phone ?? null,
        consentUpdates: params.consentUpdates ? 1 : 0,
        consentReflections: params.consentReflections ? 1 : 0,
        createdAt: Date.now(),
      })
      .returning()
      .get();
  }

  async getUserByHandle(handle: string): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.handle, handle)).get();
  }

  async getUserById(id: number): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  async updateUserContact(
    userId: number,
    params: UpdateUserContactParams,
  ): Promise<User | undefined> {
    // Build the patch only from fields actually provided so we don't clobber
    // an existing email with null when the user is updating phone (or vice
    // versa) on a subsequent call.
    const patch: Partial<typeof users.$inferInsert> = {};
    if (params.email !== undefined) patch.email = params.email;
    if (params.phone !== undefined) patch.phone = params.phone;
    if (params.consentUpdates !== undefined) {
      patch.consentUpdates = params.consentUpdates ? 1 : 0;
    }
    if (params.consentReflections !== undefined) {
      patch.consentReflections = params.consentReflections ? 1 : 0;
    }
    if (Object.keys(patch).length === 0) {
      return this.getUserById(userId);
    }
    return db
      .update(users)
      .set(patch)
      .where(eq(users.id, userId))
      .returning()
      .get();
  }

  async createCheckin(row: Omit<Checkin, "id" | "createdAt">): Promise<Checkin> {
    return db
      .insert(checkins)
      .values({ ...row, createdAt: Date.now() })
      .returning()
      .get();
  }

  async listCheckins(siftId: string): Promise<Checkin[]> {
    return db
      .select()
      .from(checkins)
      .where(eq(checkins.siftId, siftId))
      .orderBy(asc(checkins.createdAt))
      .all();
  }
}

export const storage = new DatabaseStorage();
