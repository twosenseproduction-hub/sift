import {
  type Sift,
  type InsertSift,
  type User,
  type SiftListItem,
  type SiftStatus,
  type Checkin,
  type ThreadTurnRow,
  type ThreadBookmarkRow,
  type ThreadTurn,
  type Bookmark,
  type BookmarkPayload,
  type SiftTurnMessage,
  type SortPromptPayload,
  type SortResultPayload,
  type Feedback,
  type FeedbackStage,
  type Project,
  type Decision,
  type Person,
  type ThreadLink,
  type SiftMode,
  type EntrySignal,
  type UpdateThreadRequest,
  projects,
  decisions,
  persons,
  threadLinks,
  siftModeSchema,
  entrySignalSchema,
  type FeedbackSentiment,
  type FeedbackStats,
  type AdminReviewFeedback,
  type AdminReviewSift,
  type Theme,
  sifts,
  users,
  checkins,
  threadTurns,
  threadBookmarks,
  feedback,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc, like, or, isNull, asc, sql } from "drizzle-orm";

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
  CREATE TABLE IF NOT EXISTS thread_turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sift_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    role TEXT NOT NULL,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_thread_turns_sift
    ON thread_turns(sift_id, created_at ASC);
  CREATE TABLE IF NOT EXISTS thread_bookmarks (
    sift_id TEXT PRIMARY KEY,
    updated_at INTEGER NOT NULL,
    payload TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    user_id INTEGER,
    sift_id TEXT,
    stage TEXT NOT NULL,
    sentiment TEXT NOT NULL,
    tag TEXT,
    message TEXT,
    input_snapshot TEXT,
    core_intent_snapshot TEXT,
    resolved INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_feedback_created
    ON feedback(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_feedback_sift
    ON feedback(sift_id);
`);

// Add user_id column to sifts if it doesn't exist (safe migration for prototype)
const siftCols = sqlite
  .prepare(`PRAGMA table_info(sifts);`)
  .all() as Array<{ name: string }>;
if (!siftCols.some((c) => c.name === "user_id")) {
  sqlite.exec(`ALTER TABLE sifts ADD COLUMN user_id INTEGER;`);
}
// Safe migration: add status column + backfill existing rows to 'open'.
if (!siftCols.some((c) => c.name === "status")) {
  sqlite.exec(
    `ALTER TABLE sifts ADD COLUMN status TEXT NOT NULL DEFAULT 'open';`
  );
  sqlite.exec(`UPDATE sifts SET status = 'open' WHERE status IS NULL;`);
}
// Safe migration: add Signal/Noise first-result framing columns. All three
// are nullable so legacy rows continue to load — the GET sift handler
// degrades gracefully when these are NULL.
if (!siftCols.some((c) => c.name === "matters")) {
  sqlite.exec(`ALTER TABLE sifts ADD COLUMN matters TEXT;`);
}
if (!siftCols.some((c) => c.name === "noise")) {
  sqlite.exec(`ALTER TABLE sifts ADD COLUMN noise TEXT;`);
}
if (!siftCols.some((c) => c.name === "signal_reason")) {
  sqlite.exec(`ALTER TABLE sifts ADD COLUMN signal_reason TEXT;`);
}

// Safe migration: add thread/operator columns. All nullable (or with safe
// defaults) so legacy rows continue to load. Added in Phase 1 of the
// Personal/Operator routing work — must be present before POST /api/sift
// can succeed.
if (!siftCols.some((c) => c.name === "mode")) {
  sqlite.exec(`ALTER TABLE sifts ADD COLUMN mode TEXT;`);
}
if (!siftCols.some((c) => c.name === "mode_locked")) {
  sqlite.exec(
    `ALTER TABLE sifts ADD COLUMN mode_locked INTEGER NOT NULL DEFAULT 0;`
  );
}
if (!siftCols.some((c) => c.name === "entry_signal")) {
  sqlite.exec(`ALTER TABLE sifts ADD COLUMN entry_signal TEXT;`);
}
if (!siftCols.some((c) => c.name === "thread_state")) {
  sqlite.exec(
    `ALTER TABLE sifts ADD COLUMN thread_state TEXT NOT NULL DEFAULT 'open';`
  );
  sqlite.exec(`UPDATE sifts SET thread_state = 'open' WHERE thread_state IS NULL;`);
}
if (!siftCols.some((c) => c.name === "front_burner_rank")) {
  sqlite.exec(`ALTER TABLE sifts ADD COLUMN front_burner_rank INTEGER;`);
}
if (!siftCols.some((c) => c.name === "current_move")) {
  sqlite.exec(`ALTER TABLE sifts ADD COLUMN current_move TEXT;`);
}
if (!siftCols.some((c) => c.name === "closure_condition")) {
  sqlite.exec(`ALTER TABLE sifts ADD COLUMN closure_condition TEXT;`);
}
// Phase 3: add artifact_type for Operator artifact discriminated union.
// Nullable; legacy rows and Personal sifts stay NULL.
if (!siftCols.some((c) => c.name === "artifact_type")) {
  sqlite.exec(`ALTER TABLE sifts ADD COLUMN artifact_type TEXT;`);
}

// Phase 4: add operator_artifact for the full Operator artifact payload.
// Nullable; only populated on successful runOperatorAnalysis in Operator
// mode. All existing Personal-compatible columns remain written as normal
// via runAnalysis, so this column is purely additive and backward-safe.
if (!siftCols.some((c) => c.name === "operator_artifact")) {
  sqlite.exec(`ALTER TABLE sifts ADD COLUMN operator_artifact TEXT;`);
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
  updateSiftStatus(
    id: string,
    userId: number,
    status: SiftStatus,
  ): Promise<SiftListItem | undefined>;
  // Users
  createUser(params: CreateUserParams): Promise<User>;
  getUserByHandle(handle: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  updateUserContact(
    userId: number,
    params: UpdateUserContactParams,
  ): Promise<User | undefined>;
  // V1 thread
  updateThread(id: string, userId: number, patch: UpdateThreadRequest): Promise<SiftListItem | undefined>;
  listThreads(userId: number): Promise<SiftListItem[]>;
  getThread(id: string): Promise<Sift | undefined>;
  countFrontBurner(userId: number): Promise<number>;

  // Checkins
  createCheckin(row: Omit<Checkin, "id" | "createdAt">): Promise<Checkin>;
  listCheckins(siftId: string): Promise<Checkin[]>;
  // Thread turns + bookmarks
  listTurns(siftId: string): Promise<ThreadTurn[]>;
  appendTurn(
    input: Omit<ThreadTurnRow, "id" | "createdAt">,
  ): Promise<ThreadTurn>;
  countUserTurns(siftId: string): Promise<number>;
  getBookmark(siftId: string): Promise<Bookmark | undefined>;
  upsertBookmark(siftId: string, payload: BookmarkPayload): Promise<Bookmark>;
  // Feedback
  createFeedback(input: CreateFeedbackParams): Promise<Feedback>;
  listFeedback(filters: ListFeedbackFilters): Promise<Feedback[]>;
  getFeedbackStats(): Promise<FeedbackStats>;
  setFeedbackResolved(id: number, resolved: boolean): Promise<Feedback | undefined>;
  // --- Admin review (privacy-safe) ---
  // These return prompt-redacted DTOs only. Routes serving the admin review
  // surface MUST use these instead of the unfiltered methods above so raw
  // prompt text never reaches the wire.
  listFeedbackForReview(filters: ListFeedbackFilters): Promise<AdminReviewFeedback[]>;
  getFeedbackForReview(id: number): Promise<AdminReviewFeedback | undefined>;
  setFeedbackResolvedForReview(
    id: number,
    resolved: boolean,
  ): Promise<AdminReviewFeedback | undefined>;
  getAdminReviewSift(id: string): Promise<AdminReviewSift | undefined>;
}

export type CreateFeedbackParams = {
  userId: number | null;
  siftId: string | null;
  stage: FeedbackStage;
  sentiment: FeedbackSentiment;
  tag: string | null;
  message: string | null;
  inputSnapshot: string | null;
  coreIntentSnapshot: string | null;
};

export type ListFeedbackFilters = {
  stage?: FeedbackStage;
  sentiment?: FeedbackSentiment;
  tag?: string;
  resolved?: boolean;
  signedInOnly?: boolean;
  anonymousOnly?: boolean;
  limit?: number;
};

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
        status: sifts.status,
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

    const rows = await base.where(where).orderBy(desc(sifts.createdAt)).all();
    // Guard: treat any legacy/null status as 'open' at read time.
    return rows.map((r) => ({
      ...r,
      status: (r.status === "closed" ? "closed" : "open") as SiftStatus,
    }));
  }

  async deleteSift(id: string, userId: number): Promise<boolean> {
    const res = db
      .delete(sifts)
      .where(and(eq(sifts.id, id), eq(sifts.userId, userId)))
      .run();
    return res.changes > 0;
  }

  async updateSiftStatus(
    id: string,
    userId: number,
    status: SiftStatus,
  ): Promise<SiftListItem | undefined> {
    const row = db
      .update(sifts)
      .set({ status })
      .where(and(eq(sifts.id, id), eq(sifts.userId, userId)))
      .returning({
        id: sifts.id,
        createdAt: sifts.createdAt,
        coreIntent: sifts.coreIntent,
        nextStep: sifts.nextStep,
        status: sifts.status,
      })
      .get();
    if (!row) return undefined;
    return {
      ...row,
      status: (row.status === "closed" ? "closed" : "open") as SiftStatus,
    };
  }

  // Phase 4: update currentMove on a sift row. Persists the evolving operator
  // deepening frame across turns so re-entry shows the accurate current move.
  async updateSiftCurrentMove(id: string, currentMove: string): Promise<void> {
    db.update(sifts).set({ currentMove }).where(eq(sifts.id, id)).run();
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

  async listThreads(userId: number): Promise<SiftListItem[]> {
    const rows = db
      .select()
      .from(sifts)
      .where(eq(sifts.userId, userId))
      .orderBy(desc(sifts.createdAt))
      .all();
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      coreIntent: r.coreIntent,
      nextStep: r.nextStep,
      status: ((r.status as string) === "closed" ? "closed" : "open") as SiftStatus,
      mode: (r.mode as SiftMode | null) ?? null,
      threadState: ((r.threadState as string) || "open") as "open"|"closed"|"archived",
      frontBurnerRank: r.frontBurnerRank ?? null,
      currentMove: r.currentMove ?? null,
    }));
  }

  async getThread(id: string): Promise<Sift | undefined> {
    return db.select().from(sifts).where(eq(sifts.id, id)).get();
  }

  async updateThread(id: string, userId: number, patch: UpdateThreadRequest): Promise<SiftListItem | undefined> {
    const set: Record<string, unknown> = {};
    if (patch.threadState !== undefined) set.threadState = patch.threadState;
    if (patch.frontBurnerRank !== undefined) set.frontBurnerRank = patch.frontBurnerRank;
    if (patch.currentMove !== undefined) set.currentMove = patch.currentMove;
    if (patch.closureCondition !== undefined) set.closureCondition = patch.closureCondition;
    if (Object.keys(set).length === 0) return undefined;
    const row = db
      .update(sifts)
      .set(set)
      .where(and(eq(sifts.id, id), eq(sifts.userId, userId)))
      .returning({
        id: sifts.id,
        createdAt: sifts.createdAt,
        coreIntent: sifts.coreIntent,
        nextStep: sifts.nextStep,
        status: sifts.status,
        mode: sifts.mode,
        threadState: sifts.threadState,
        frontBurnerRank: sifts.frontBurnerRank,
        currentMove: sifts.currentMove,
      })
      .get();
    if (!row) return undefined;
    return {
      id: row.id,
      createdAt: row.createdAt,
      coreIntent: row.coreIntent,
      nextStep: row.nextStep,
      status: ((row.status as string) === "closed" ? "closed" : "open") as SiftStatus,
      mode: (row.mode as SiftMode | null) ?? null,
      threadState: ((row.threadState as string) || "open") as "open"|"closed"|"archived",
      frontBurnerRank: row.frontBurnerRank ?? null,
      currentMove: row.currentMove ?? null,
    };
  }

  async countFrontBurner(userId: number): Promise<number> {
    const row = db
      .select({ n: sql<number>`COUNT(*)` })
      .from(sifts)
      .where(and(
        eq(sifts.userId, userId),
        eq(sifts.threadState, "open"),
        sql`front_burner_rank IS NOT NULL`,
      ))
      .get();
    return row?.n ?? 0;
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

  async listTurns(siftId: string): Promise<ThreadTurn[]> {
    const rows = db
      .select()
      .from(threadTurns)
      .where(eq(threadTurns.siftId, siftId))
      .orderBy(asc(threadTurns.createdAt))
      .all();
    return rows.map(rowToThreadTurn).filter((t): t is ThreadTurn => t !== null);
  }

  async appendTurn(
    input: Omit<ThreadTurnRow, "id" | "createdAt">,
  ): Promise<ThreadTurn> {
    const row = db
      .insert(threadTurns)
      .values({ ...input, createdAt: Date.now() })
      .returning()
      .get();
    const parsed = rowToThreadTurn(row);
    if (!parsed) {
      throw new Error("Malformed thread turn payload after insert");
    }
    return parsed;
  }

  async countUserTurns(siftId: string): Promise<number> {
    const row = db
      .select({ n: sql<number>`COUNT(*)` })
      .from(threadTurns)
      .where(
        and(eq(threadTurns.siftId, siftId), eq(threadTurns.role, "user")),
      )
      .get();
    return row?.n ?? 0;
  }

  async getBookmark(siftId: string): Promise<Bookmark | undefined> {
    const row = db
      .select()
      .from(threadBookmarks)
      .where(eq(threadBookmarks.siftId, siftId))
      .get();
    if (!row) return undefined;
    try {
      return {
        updatedAt: row.updatedAt,
        payload: JSON.parse(row.payload) as BookmarkPayload,
      };
    } catch {
      return undefined;
    }
  }

  async createFeedback(input: CreateFeedbackParams): Promise<Feedback> {
    const row = db
      .insert(feedback)
      .values({
        createdAt: Date.now(),
        userId: input.userId,
        siftId: input.siftId,
        stage: input.stage,
        sentiment: input.sentiment,
        tag: input.tag,
        message: input.message,
        inputSnapshot: input.inputSnapshot,
        coreIntentSnapshot: input.coreIntentSnapshot,
        resolved: 0,
      })
      .returning()
      .get();
    // No handle join on insert path — admin views fetch via listFeedback.
    return rowToFeedback(row, null);
  }

  async listFeedback(filters: ListFeedbackFilters): Promise<Feedback[]> {
    const where: string[] = [];
    const params: any[] = [];
    if (filters.stage) {
      where.push("f.stage = ?");
      params.push(filters.stage);
    }
    if (filters.sentiment) {
      where.push("f.sentiment = ?");
      params.push(filters.sentiment);
    }
    if (filters.tag) {
      where.push("f.tag = ?");
      params.push(filters.tag);
    }
    if (filters.resolved !== undefined) {
      where.push("f.resolved = ?");
      params.push(filters.resolved ? 1 : 0);
    }
    if (filters.signedInOnly) {
      where.push("f.user_id IS NOT NULL");
    }
    if (filters.anonymousOnly) {
      where.push("f.user_id IS NULL");
    }
    const limit = Math.min(filters.limit ?? 500, 1000);
    const sql = `SELECT f.id, f.created_at AS createdAt, f.user_id AS userId,
                        u.handle AS userHandle, f.sift_id AS siftId,
                        f.stage, f.sentiment, f.tag, f.message,
                        f.input_snapshot AS inputSnapshot,
                        f.core_intent_snapshot AS coreIntentSnapshot,
                        f.resolved
                 FROM feedback f
                 LEFT JOIN users u ON u.id = f.user_id
                 ${where.length ? "WHERE " + where.join(" AND ") : ""}
                 ORDER BY f.created_at DESC
                 LIMIT ${limit}`;
    const rows = rawDb.prepare(sql).all(...params) as Array<
      Omit<Feedback, "resolved"> & { resolved: number }
    >;
    return rows.map((r) => ({
      ...r,
      stage: r.stage as FeedbackStage,
      sentiment: r.sentiment as FeedbackSentiment,
      resolved: !!r.resolved,
    }));
  }

  async getFeedbackStats(): Promise<FeedbackStats> {
    const totalsRow = rawDb
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN sentiment = 'helpful' THEN 1 ELSE 0 END) AS helpful,
           SUM(CASE WHEN sentiment = 'not_helpful' THEN 1 ELSE 0 END) AS notHelpful,
           SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END) AS unresolved
         FROM feedback`,
      )
      .get() as { total: number; helpful: number | null; notHelpful: number | null; unresolved: number | null };

    // by-stage breakdown
    const stages: FeedbackStage[] = ["result", "deepening", "summary", "closure"];
    const byStage = stages.reduce(
      (acc, s) => {
        acc[s] = { helpful: 0, notHelpful: 0 };
        return acc;
      },
      {} as FeedbackStats["byStage"],
    );
    const stageRows = rawDb
      .prepare(
        `SELECT stage, sentiment, COUNT(*) AS n FROM feedback
         GROUP BY stage, sentiment`,
      )
      .all() as Array<{ stage: string; sentiment: string; n: number }>;
    for (const r of stageRows) {
      const stage = r.stage as FeedbackStage;
      if (!byStage[stage]) continue;
      if (r.sentiment === "helpful") byStage[stage].helpful += r.n;
      else if (r.sentiment === "not_helpful") byStage[stage].notHelpful += r.n;
    }

    // top tags — most-frequent first, capped at 10. We bring back the
    // sentiment alongside so the admin can see at a glance whether a tag is
    // a celebration or a complaint without clicking through.
    const tagRows = rawDb
      .prepare(
        `SELECT tag, sentiment, COUNT(*) AS n FROM feedback
         WHERE tag IS NOT NULL AND tag <> ''
         GROUP BY tag, sentiment
         ORDER BY n DESC
         LIMIT 10`,
      )
      .all() as Array<{ tag: string; sentiment: string; n: number }>;
    const topTags = tagRows.map((r) => ({
      tag: r.tag,
      count: r.n,
      sentiment: r.sentiment as FeedbackSentiment,
    }));

    return {
      total: totalsRow.total ?? 0,
      helpful: totalsRow.helpful ?? 0,
      notHelpful: totalsRow.notHelpful ?? 0,
      unresolved: totalsRow.unresolved ?? 0,
      byStage,
      topTags,
    };
  }

  async setFeedbackResolved(
    id: number,
    resolved: boolean,
  ): Promise<Feedback | undefined> {
    const updated = db
      .update(feedback)
      .set({ resolved: resolved ? 1 : 0 })
      .where(eq(feedback.id, id))
      .returning()
      .get();
    if (!updated) return undefined;
    // Pull the handle separately for consistency with listFeedback.
    let userHandle: string | null = null;
    if (updated.userId !== null) {
      const u = await this.getUserById(updated.userId);
      userHandle = u?.handle ?? null;
    }
    return rowToFeedback(updated, userHandle);
  }

  // --- Admin review (privacy-safe) implementations ---
  //
  // These methods are the ONLY ones the admin feedback review routes should
  // call. They funnel every read through the explicit allowlist serializers
  // (toAdminReviewFeedback, toAdminReviewSift) so raw prompt text — stored
  // intact in the DB — cannot accidentally leak into a response.

  async listFeedbackForReview(
    filters: ListFeedbackFilters,
  ): Promise<AdminReviewFeedback[]> {
    // Reuse the same SQL but project a column set that omits inputSnapshot.
    // Even if the unfiltered listFeedback ever changes, this path stays
    // explicitly allowlisted via toAdminReviewFeedback.
    const where: string[] = [];
    const params: any[] = [];
    if (filters.stage) {
      where.push("f.stage = ?");
      params.push(filters.stage);
    }
    if (filters.sentiment) {
      where.push("f.sentiment = ?");
      params.push(filters.sentiment);
    }
    if (filters.tag) {
      where.push("f.tag = ?");
      params.push(filters.tag);
    }
    if (filters.resolved !== undefined) {
      where.push("f.resolved = ?");
      params.push(filters.resolved ? 1 : 0);
    }
    if (filters.signedInOnly) {
      where.push("f.user_id IS NOT NULL");
    }
    if (filters.anonymousOnly) {
      where.push("f.user_id IS NULL");
    }
    const limit = Math.min(filters.limit ?? 500, 1000);
    // Note: we deliberately project f.input_snapshot here (as inputCharCount)
    // ONLY to derive prompt metadata. The serializer never returns the raw
    // text. We also LEFT JOIN sifts to read the input_mode + true input length
    // when a sift is linked, since the truncated snapshot under-counts long
    // prompts.
    const sql = `SELECT f.id, f.created_at AS createdAt, f.user_id AS userId,
                        u.handle AS userHandle, f.sift_id AS siftId,
                        f.stage, f.sentiment, f.tag, f.message,
                        f.core_intent_snapshot AS coreIntentSnapshot,
                        f.resolved,
                        s.input_mode AS siftInputMode,
                        LENGTH(s.input) AS siftInputLength
                 FROM feedback f
                 LEFT JOIN users u ON u.id = f.user_id
                 LEFT JOIN sifts s ON s.id = f.sift_id
                 ${where.length ? "WHERE " + where.join(" AND ") : ""}
                 ORDER BY f.created_at DESC
                 LIMIT ${limit}`;
    const rows = rawDb.prepare(sql).all(...params) as Array<{
      id: number;
      createdAt: number;
      userId: number | null;
      userHandle: string | null;
      siftId: string | null;
      stage: string;
      sentiment: string;
      tag: string | null;
      message: string | null;
      coreIntentSnapshot: string | null;
      resolved: number;
      siftInputMode: string | null;
      siftInputLength: number | null;
    }>;
    return rows.map((r) =>
      toAdminReviewFeedback({
        id: r.id,
        createdAt: r.createdAt,
        userId: r.userId,
        userHandle: r.userHandle,
        siftId: r.siftId,
        stage: r.stage as FeedbackStage,
        sentiment: r.sentiment as FeedbackSentiment,
        tag: r.tag,
        message: r.message,
        coreIntentSnapshot: r.coreIntentSnapshot,
        resolved: !!r.resolved,
        siftInputMode: (r.siftInputMode as "text" | "voice" | null) ?? null,
        siftInputLength: r.siftInputLength,
      }),
    );
  }

  async getFeedbackForReview(
    id: number,
  ): Promise<AdminReviewFeedback | undefined> {
    const row = rawDb
      .prepare(
        `SELECT f.id, f.created_at AS createdAt, f.user_id AS userId,
                u.handle AS userHandle, f.sift_id AS siftId,
                f.stage, f.sentiment, f.tag, f.message,
                f.core_intent_snapshot AS coreIntentSnapshot,
                f.resolved,
                s.input_mode AS siftInputMode,
                LENGTH(s.input) AS siftInputLength
         FROM feedback f
         LEFT JOIN users u ON u.id = f.user_id
         LEFT JOIN sifts s ON s.id = f.sift_id
         WHERE f.id = ?`,
      )
      .get(id) as
      | {
          id: number;
          createdAt: number;
          userId: number | null;
          userHandle: string | null;
          siftId: string | null;
          stage: string;
          sentiment: string;
          tag: string | null;
          message: string | null;
          coreIntentSnapshot: string | null;
          resolved: number;
          siftInputMode: string | null;
          siftInputLength: number | null;
        }
      | undefined;
    if (!row) return undefined;
    return toAdminReviewFeedback({
      id: row.id,
      createdAt: row.createdAt,
      userId: row.userId,
      userHandle: row.userHandle,
      siftId: row.siftId,
      stage: row.stage as FeedbackStage,
      sentiment: row.sentiment as FeedbackSentiment,
      tag: row.tag,
      message: row.message,
      coreIntentSnapshot: row.coreIntentSnapshot,
      resolved: !!row.resolved,
      siftInputMode: (row.siftInputMode as "text" | "voice" | null) ?? null,
      siftInputLength: row.siftInputLength,
    });
  }

  async setFeedbackResolvedForReview(
    id: number,
    resolved: boolean,
  ): Promise<AdminReviewFeedback | undefined> {
    const updated = await this.setFeedbackResolved(id, resolved);
    if (!updated) return undefined;
    // Re-read through the review path so the response is identical to a
    // GET. Cheaper than rebuilding metadata in two places.
    return this.getFeedbackForReview(id);
  }

  async getAdminReviewSift(
    id: string,
  ): Promise<AdminReviewSift | undefined> {
    const row = await this.getSift(id);
    if (!row) return undefined;
    return toAdminReviewSift(row);
  }

  async upsertBookmark(
    siftId: string,
    payload: BookmarkPayload,
  ): Promise<Bookmark> {
    const updatedAt = Date.now();
    const payloadJson = JSON.stringify(payload);
    // Upsert via raw statement — better-sqlite3 supports ON CONFLICT cleanly.
    rawDb
      .prepare(
        `INSERT INTO thread_bookmarks (sift_id, updated_at, payload)
         VALUES (?, ?, ?)
         ON CONFLICT(sift_id) DO UPDATE SET
           updated_at = excluded.updated_at,
           payload = excluded.payload`,
      )
      .run(siftId, updatedAt, payloadJson);
    return { updatedAt, payload };
  }
}

// --- Admin review allowlist serializers ---
//
// Explicitly enumerated property maps. New fields on Sift / Feedback do NOT
// flow into the admin review surface unless a developer adds them here on
// purpose — which is the whole point. Do not replace these with object
// spreads or `delete` operations. Do not call these from non-admin paths.

export function toAdminReviewSift(row: Sift): AdminReviewSift {
  let themes: Theme[] = [];
  try {
    const parsed = JSON.parse(row.themes);
    if (Array.isArray(parsed)) themes = parsed as Theme[];
  } catch {
    themes = [];
  }
  return {
    id: row.id,
    createdAt: row.createdAt,
    inputMode: (row.inputMode as "text" | "voice") ?? "text",
    promptRedacted: true,
    themes,
    coreIntent: row.coreIntent,
    nextStep: row.nextStep,
    reflection: row.reflection,
    status:
      row.status === "closed" || row.status === "open"
        ? (row.status as SiftStatus)
        : undefined,
    promptMeta: {
      // Length of the stored input string, not a substring of it.
      charCount: typeof row.input === "string" ? row.input.length : 0,
      inputMode: (row.inputMode as "text" | "voice") ?? "text",
    },
  };
}

// Internal join shape used by listFeedbackForReview / getFeedbackForReview.
// Carries only the metadata needed to derive `promptMeta` — not the raw
// snapshot string itself.
type AdminFeedbackJoin = {
  id: number;
  createdAt: number;
  userId: number | null;
  userHandle: string | null;
  siftId: string | null;
  stage: FeedbackStage;
  sentiment: FeedbackSentiment;
  tag: string | null;
  message: string | null;
  coreIntentSnapshot: string | null;
  resolved: boolean;
  siftInputMode: "text" | "voice" | null;
  siftInputLength: number | null;
};

export function toAdminReviewFeedback(
  r: AdminFeedbackJoin,
): AdminReviewFeedback {
  const inputMode: "text" | "voice" =
    r.siftInputMode === "voice" ? "voice" : "text";
  const promptMeta =
    r.siftId && r.siftInputLength != null
      ? { charCount: r.siftInputLength, inputMode }
      : null;
  return {
    id: r.id,
    createdAt: r.createdAt,
    userId: r.userId,
    userHandle: r.userHandle,
    siftId: r.siftId,
    stage: r.stage,
    sentiment: r.sentiment,
    tag: r.tag,
    message: r.message,
    resolved: r.resolved,
    promptRedacted: true,
    coreIntentSnapshot: r.coreIntentSnapshot,
    promptMeta,
  };
}

function rowToFeedback(
  row: typeof feedback.$inferSelect,
  userHandle: string | null,
): Feedback {
  return {
    id: row.id,
    createdAt: row.createdAt,
    userId: row.userId ?? null,
    userHandle,
    siftId: row.siftId ?? null,
    stage: row.stage as FeedbackStage,
    sentiment: row.sentiment as FeedbackSentiment,
    tag: row.tag ?? null,
    message: row.message ?? null,
    inputSnapshot: row.inputSnapshot ?? null,
    coreIntentSnapshot: row.coreIntentSnapshot ?? null,
    resolved: !!row.resolved,
  };
}

// --- Row → ThreadTurn adapter ---
// Keeps the route/client typed against the tagged-union ThreadTurn while
// letting the DB store everything as one payload column.
function rowToThreadTurn(row: ThreadTurnRow): ThreadTurn | null {
  let payload: any;
  try {
    payload = JSON.parse(row.payload);
  } catch {
    return null;
  }
  const base = { id: row.id, createdAt: row.createdAt } as const;
  if (row.role === "user" && row.kind === "message") {
    if (typeof payload?.text !== "string") return null;
    return { ...base, role: "user", kind: "message", text: payload.text };
  }
  if (row.role === "sift" && row.kind === "message") {
    return {
      ...base,
      role: "sift",
      kind: "message",
      message: payload as SiftTurnMessage,
    };
  }
  if (row.role === "sift" && row.kind === "checkpoint") {
    return {
      ...base,
      role: "sift",
      kind: "checkpoint",
      checkpoint: payload as BookmarkPayload,
    };
  }
  if (row.role === "sift" && row.kind === "closure") {
    if (typeof payload?.reflection !== "string") return null;
    return {
      ...base,
      role: "sift",
      kind: "closure",
      reflection: payload.reflection,
    };
  }
  if (row.role === "sift" && row.kind === "sort_prompt") {
    if (
      typeof payload?.intro !== "string" ||
      !Array.isArray(payload?.items) ||
      payload.items.some((x: unknown) => typeof x !== "string")
    ) {
      return null;
    }
    return {
      ...base,
      role: "sift",
      kind: "sort_prompt",
      sortPrompt: payload as SortPromptPayload,
    };
  }
  if (row.role === "user" && row.kind === "sort_result") {
    const matters = Array.isArray(payload?.matters) ? payload.matters : [];
    const noise = Array.isArray(payload?.noise) ? payload.noise : [];
    const unsure = Array.isArray(payload?.unsure) ? payload.unsure : [];
    return {
      ...base,
      role: "user",
      kind: "sort_result",
      sortResult: {
        matters,
        noise,
        unsure,
        skipped: Boolean(payload?.skipped),
      } as SortResultPayload,
    };
  }
  return null;
}

export const storage = new DatabaseStorage();
