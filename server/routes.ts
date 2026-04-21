import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import express from "express";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { storage, rawDb } from "./storage";
import {
  analyzeRequestSchema,
  analysisSchema,
  loginSchema,
  signupSchema,
  contactUpdateSchema,
  classifyContact,
  checkinRequestSchema,
  checkinAnalysisSchema,
  type Analysis,
  type CheckinAnalysis,
  type CheckinResult,
  type SiftResult,
  type Me,
  type User,
  type Checkin,
} from "@shared/schema";

const client = new Anthropic();

// Model name. Defaults to a real Anthropic public model name so the app works
// against api.anthropic.com out of the box. When running inside the Perplexity
// sandbox, set ANTHROPIC_MODEL=claude_sonnet_4_6 (the internal alias).
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

const SYSTEM_PROMPT = `You are Sift — a quiet, precise thinking companion.

Someone has just poured out a tangle of thoughts. Your job is to sift through the noise and return clarity.

You write like a calm, thoughtful guide — not a coach, not a therapist, not a hype man. No exclamation points. No emojis. No corporate language. No "great question!" No "let's dive in." Speak plainly, warmly, with weight.

Return STRICT JSON matching this shape exactly:
{
  "themes": [{ "title": string, "summary": string }],  // 2 to 4 themes
  "coreIntent": string,  // one sentence: what they actually want beneath the surface
  "nextStep": string,    // ONE concrete action they can take today or this week. Specific, small, doable.
  "reflection": string   // one short sentence that names what they may not be seeing
}

Rules:
- Themes: 2–4 only. Title is 2–5 words. Summary is one sentence, 15–25 words.
- coreIntent: one sentence. Start with a verb or "You want…". Do not restate their words; distill them.
- nextStep: Must be an action, not advice. Starts with a verb. Concrete, scoped, achievable. Not "reflect more" or "think about." Something they do.
- reflection: A quiet observation. Honest. Not flattering. Under 20 words.
- If the input is very short or unclear, still produce a best-effort pass — do not ask questions back.
- Output JSON only. No prose before or after.`;

const CHECKIN_SYSTEM_PROMPT = `You are Sift in Check-in Mode.

The user is returning to a past sift to report what happened. You already have:
- their original input
- the next step you gave them
- their current status (did_it, did_not, or in_progress)
- optional note about what happened

Your role is to:
1. Interpret what the outcome reveals (not just restate it)
2. Identify what helped, what blocked, or what changed
3. Refine their direction based on this new information
4. Provide one improved, realistic next step

Do NOT:
- Praise the user ("good job", "proud of you")
- Shame or guilt the user for not following through
- Repeat the original advice without adapting it
- Sound like a coach, therapist, or habit tracker

Treat all outcomes as useful data:
- If they did it → extract what changed and build forward
- If they didn't → identify friction and reduce the step
- If they are still working → clarify what remains unclear

Tone: calm, perceptive, grounded, slightly conversational, not overly polished. No exclamation points. No emojis.

Return STRICT JSON matching this shape exactly:
{
  "hearing": string,         // 2–4 sentences identifying the real pattern or shift
  "matters": [string],       // 2–3 bullets — each a short sentence
  "noise": [string],         // 1–2 bullets — each a short sentence
  "nextStep": string         // ONE clear, specific, realistic action — often smaller or more precise than before
}

Rules:
- "hearing": 2–4 sentences. Observe the pattern. Don't just summarize.
- "matters": 2 or 3 bullets. Each is a short, grounded sentence.
- "noise": 1 or 2 bullets. What to let go of or stop tracking.
- "nextStep": ONE action. Starts with a verb. Adjusted based on the outcome — not a restatement.
- Output JSON only. No prose before or after.`;

function newId(): string {
  const chars = "abcdefghijkmnopqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// --- Passphrase hashing (scrypt) ---
function hashPassphrase(passphrase: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(passphrase, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassphrase(passphrase: string, stored: string): boolean {
  const [salt, derived] = stored.split(":");
  if (!salt || !derived) return false;
  const test = crypto.scryptSync(passphrase, salt, 64).toString("hex");
  const a = Buffer.from(derived, "hex");
  const b = Buffer.from(test, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// --- Bearer-token auth (the deploy proxy strips Set-Cookie, so we can't use cookies) ---
// Tokens map to userIds in SQLite so sessions survive server restarts/redeploys.
// Client keeps the token in localStorage and sends it as `Authorization: Bearer <token>`.
const insertSessionStmt = rawDb.prepare(
  `INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`,
);
const readSessionStmt = rawDb.prepare(
  `SELECT user_id AS userId FROM sessions WHERE token = ?`,
);
const deleteSessionStmt = rawDb.prepare(
  `DELETE FROM sessions WHERE token = ?`,
);

function issueToken(userId: number): string {
  const token = crypto.randomBytes(32).toString("hex");
  insertSessionStmt.run(token, userId, Date.now());
  return token;
}

function readToken(req: Request): number | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  const token = h.slice(7).trim();
  const row = readSessionStmt.get(token) as { userId: number } | undefined;
  return row ? row.userId : null;
}

function revokeToken(token: string): void {
  deleteSessionStmt.run(token);
}

async function runAnalysis(input: string): Promise<Analysis> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is what I'm holding right now:\n\n${input}\n\nSift it. Return JSON only.`,
      },
    ],
  });

  const textBlock = msg.content.find((b: any) => b.type === "text") as any;
  const raw = (textBlock?.text ?? "").trim();
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Model did not return JSON");
    parsed = JSON.parse(match[0]);
  }
  return analysisSchema.parse(parsed);
}

async function runCheckinAnalysis(
  originalInput: string,
  originalNextStep: string,
  status: string,
  note: string
): Promise<CheckinAnalysis> {
  const statusLabel =
    status === "did_it"
      ? "I did it."
      : status === "did_not"
      ? "I didn't do it."
      : "I'm still working on it.";

  const userBlock = `Original sift input:
${originalInput}

Original next step you gave me:
${originalNextStep}

Status: ${statusLabel}${note ? `\n\nWhat actually happened:\n${note}` : ""}

Sift what this outcome reveals. Return JSON only.`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: CHECKIN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userBlock }],
  });

  const textBlock = msg.content.find((b: any) => b.type === "text") as any;
  const raw = (textBlock?.text ?? "").trim();
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Model did not return JSON");
    parsed = JSON.parse(match[0]);
  }
  return checkinAnalysisSchema.parse(parsed);
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = readToken(req);
  if (!userId) {
    return res.status(401).json({ error: "Not signed in" });
  }
  (req as any).userId = userId;
  next();
}

function checkinToResult(row: Checkin): CheckinResult {
  const parsed = JSON.parse(row.response) as CheckinAnalysis;
  return {
    id: row.id,
    createdAt: row.createdAt,
    status: row.status as CheckinResult["status"],
    note: row.note,
    ...parsed,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(express.json({ limit: "1mb" }));

  // --- Auth ---

  // Normalize a raw contact string into either an email (lowercased) or a
  // phone (digits + optional leading +, non-digits stripped).
  function normalizeContact(
    raw: string,
  ): { email: string | null; phone: string | null } {
    const kind = classifyContact(raw);
    if (kind === "email") {
      return { email: raw.trim().toLowerCase(), phone: null };
    }
    if (kind === "phone") {
      return { email: null, phone: raw.replace(/[\s().\-]/g, "") };
    }
    return { email: null, phone: null };
  }

  // Serialize a User row into the public `Me` shape.
  function toMe(user: User): Me {
    return {
      id: user.id,
      handle: user.handle,
      contactMissing: !user.email && !user.phone,
    };
  }

  app.post("/api/auth/signup", async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const handle = parsed.data.handle.toLowerCase();
    const existing = await storage.getUserByHandle(handle);
    if (existing) {
      return res.status(409).json({ error: "That handle is taken." });
    }
    const { email, phone } = normalizeContact(parsed.data.contact);
    const user = await storage.createUser({
      handle,
      passphraseHash: hashPassphrase(parsed.data.passphrase),
      email,
      phone,
      consentUpdates: parsed.data.consentUpdates,
      consentReflections: parsed.data.consentReflections,
    });
    const token = issueToken(user.id);
    res.json({ me: toMe(user), token });
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const handle = parsed.data.handle.toLowerCase();
    const user = await storage.getUserByHandle(handle);
    if (!user || !verifyPassphrase(parsed.data.passphrase, user.passphraseHash)) {
      return res
        .status(401)
        .json({ error: "Handle or passphrase doesn't match." });
    }
    const token = issueToken(user.id);
    res.json({ me: toMe(user), token });
  });

  app.post("/api/auth/logout", (req, res) => {
    const h = req.headers.authorization;
    if (h?.startsWith("Bearer ")) revokeToken(h.slice(7).trim());
    res.json({ ok: true });
  });

  app.get("/api/auth/me", async (req, res) => {
    const userId = readToken(req);
    if (!userId) return res.json({ me: null });
    const user = await storage.getUserById(userId);
    if (!user) return res.json({ me: null });
    res.json({ me: toMe(user) });
  });

  // Existing users (created before contact capture) can add their email/phone
  // and consent preferences via this endpoint. Also used if a signed-in user
  // wants to update their contact later.
  app.patch("/api/auth/contact", requireAuth, async (req, res) => {
    const parsed = contactUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const userId = (req as any).userId as number;
    const { email, phone } = normalizeContact(parsed.data.contact);
    // Only set whichever channel the user supplied; leave the other one alone.
    const updated = await storage.updateUserContact(userId, {
      ...(email !== null ? { email } : {}),
      ...(phone !== null ? { phone } : {}),
      consentUpdates: parsed.data.consentUpdates,
      consentReflections: parsed.data.consentReflections,
    });
    if (!updated) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json({ me: toMe(updated) });
  });

  // --- Admin ---

  // Allowlist of handles who can view stats. Configure via the ADMIN_HANDLES
  // env var as a comma-separated list (e.g. "twosense,ale"). If unset,
  // defaults to "twosense,ale" — the handles we know belong to the operator —
  // so access works on Fly before the secret is wired.
  const adminHandles = new Set(
    (process.env.ADMIN_HANDLES ?? "twosense,ale")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

  async function requireAdmin(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const userId = readToken(req);
    if (!userId) return res.status(401).json({ error: "Not signed in" });
    const user = await storage.getUserById(userId);
    if (!user || !adminHandles.has(user.handle.toLowerCase())) {
      return res.status(403).json({ error: "Not authorized" });
    }
    (req as any).userId = userId;
    next();
  }

  // Cheap lightweight check so the client can decide whether to render the
  // admin link / page at all without leaking the allowlist itself.
  app.get("/api/admin/access", async (req, res) => {
    const userId = readToken(req);
    if (!userId) return res.json({ allowed: false });
    const user = await storage.getUserById(userId);
    res.json({ allowed: !!user && adminHandles.has(user.handle.toLowerCase()) });
  });

  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    // Build a 7-day window ending today (UTC midnight boundaries). We use
    // epoch ms throughout because that's what all three tables store.
    const now = new Date();
    const todayUtc = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    // Seven buckets, day[0] = six days ago, day[6] = today.
    const buckets: { start: number; end: number; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = todayUtc - i * DAY_MS;
      const end = start + DAY_MS;
      const d = new Date(start);
      const label = `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
        d.getUTCDate(),
      ).padStart(2, "0")}`;
      buckets.push({ start, end, label });
    }

    // Totals (all-time).
    const totalUsers = (
      rawDb.prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number }
    ).n;
    const totalSifts = (
      rawDb.prepare(`SELECT COUNT(*) AS n FROM sifts`).get() as { n: number }
    ).n;
    const totalCheckins = (
      rawDb.prepare(`SELECT COUNT(*) AS n FROM checkins`).get() as { n: number }
    ).n;
    const didItCheckins = (
      rawDb
        .prepare(`SELECT COUNT(*) AS n FROM checkins WHERE status = 'did_it'`)
        .get() as { n: number }
    ).n;
    const checkinCompletionRate = totalCheckins === 0
      ? 0
      : didItCheckins / totalCheckins;

    // Per-day series. One prepared statement per table, three totals per day.
    const countInRange = (table: "users" | "sifts" | "checkins") =>
      rawDb.prepare(
        `SELECT COUNT(*) AS n FROM ${table} WHERE created_at >= ? AND created_at < ?`,
      );
    const didItInRange = rawDb.prepare(
      `SELECT COUNT(*) AS n FROM checkins WHERE status = 'did_it' AND created_at >= ? AND created_at < ?`,
    );
    const usersStmt = countInRange("users");
    const siftsStmt = countInRange("sifts");
    const checkinsStmt = countInRange("checkins");

    const series = buckets.map((b) => {
      const signups = (usersStmt.get(b.start, b.end) as { n: number }).n;
      const sifts = (siftsStmt.get(b.start, b.end) as { n: number }).n;
      const checkins = (checkinsStmt.get(b.start, b.end) as { n: number }).n;
      const didIt = (didItInRange.get(b.start, b.end) as { n: number }).n;
      const rate = checkins === 0 ? null : didIt / checkins;
      return { label: b.label, signups, sifts, checkins, didIt, rate };
    });

    res.json({
      totals: {
        users: totalUsers,
        sifts: totalSifts,
        checkins: totalCheckins,
        didItCheckins,
        checkinCompletionRate,
      },
      series,
    });
  });

  // Per-user admin list. LEFT JOIN so users with zero sifts still show up.
  // Orders by created_at DESC — newest first is the useful default when
  // watching tester engagement. Capped at 500 to keep payloads reasonable;
  // pagination can come later if the list grows.
  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    const rows = rawDb
      .prepare(
        `SELECT u.id, u.handle, u.email, u.phone,
                u.consent_updates AS consentUpdates,
                u.consent_reflections AS consentReflections,
                u.created_at AS createdAt,
                COALESCE(s.sift_count, 0) AS siftCount,
                s.last_sift_at AS lastSiftAt
         FROM users u
         LEFT JOIN (
           SELECT user_id,
                  COUNT(*) AS sift_count,
                  MAX(created_at) AS last_sift_at
           FROM sifts
           WHERE user_id IS NOT NULL
           GROUP BY user_id
         ) s ON s.user_id = u.id
         ORDER BY u.created_at DESC
         LIMIT 500`,
      )
      .all() as Array<{
        id: number;
        handle: string;
        email: string | null;
        phone: string | null;
        consentUpdates: number;
        consentReflections: number;
        createdAt: number;
        siftCount: number;
        lastSiftAt: number | null;
      }>;

    res.json({
      users: rows.map((r) => ({
        id: r.id,
        handle: r.handle,
        email: r.email,
        phone: r.phone,
        consentUpdates: r.consentUpdates === 1,
        consentReflections: r.consentReflections === 1,
        createdAt: r.createdAt,
        siftCount: r.siftCount,
        lastSiftAt: r.lastSiftAt,
      })),
    });
  });

  // --- Sifts ---

  app.post("/api/sift", async (req, res) => {
    const parsed = analyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const { input, inputMode } = parsed.data;
    const userId = readToken(req);

    try {
      const analysis = await runAnalysis(input);
      const id = newId();

      await storage.createSift({
        id,
        userId: userId ?? undefined,
        input,
        inputMode,
        themes: JSON.stringify(analysis.themes),
        coreIntent: analysis.coreIntent,
        nextStep: analysis.nextStep,
        reflection: analysis.reflection,
      } as any);

      const result: SiftResult = {
        id,
        input,
        inputMode,
        createdAt: Date.now(),
        ...analysis,
        mine: !!userId,
        checkins: [],
      };
      return res.json(result);
    } catch (err: any) {
      console.error("sift error", err);
      return res.status(500).json({
        error: "Could not sift that right now.",
        detail: err?.message ?? String(err),
      });
    }
  });

  // List my sifts (optionally with ?q=search)
  app.get("/api/sifts", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const list = await storage.listSiftsByUser(userId, q);
    res.json({ sifts: list });
  });

  // Delete one of my sifts
  app.delete("/api/sift/:id", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const ok = await storage.deleteSift(String(req.params.id), userId);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  });

  // Fetch a shared sift (public-by-link)
  app.get("/api/sift/:id", async (req, res) => {
    const row = await storage.getSift(String(req.params.id));
    if (!row) return res.status(404).json({ error: "Not found" });

    const viewerId = readToken(req);
    const checkinRows = await storage.listCheckins(row.id);

    const result: SiftResult = {
      id: row.id,
      input: row.input,
      inputMode: row.inputMode as "text" | "voice",
      createdAt: row.createdAt,
      themes: JSON.parse(row.themes),
      coreIntent: row.coreIntent,
      nextStep: row.nextStep,
      reflection: row.reflection,
      mine: viewerId != null && row.userId === viewerId,
      checkins: checkinRows.map(checkinToResult),
    };
    return res.json(result);
  });

  // Create a check-in on a sift (owner only)
  app.post("/api/sift/:id/checkin", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const parsed = checkinRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const siftId = String(req.params.id);
    const sift = await storage.getSift(siftId);
    if (!sift) return res.status(404).json({ error: "Not found" });
    if (sift.userId !== userId) return res.status(403).json({ error: "Not your sift" });

    try {
      const analysis = await runCheckinAnalysis(
        sift.input,
        sift.nextStep,
        parsed.data.status,
        parsed.data.note ?? ""
      );
      const row = await storage.createCheckin({
        siftId,
        status: parsed.data.status,
        note: parsed.data.note ?? "",
        response: JSON.stringify(analysis),
      });
      const result: CheckinResult = checkinToResult(row);
      res.json({ checkin: result });
    } catch (err: any) {
      console.error("checkin error", err);
      res.status(500).json({
        error: "Could not process check-in right now.",
        detail: err?.message ?? String(err),
      });
    }
  });

  return httpServer;
}
