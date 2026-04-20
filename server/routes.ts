import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import express from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import {
  analyzeRequestSchema,
  analysisSchema,
  authSchema,
  type Analysis,
  type SiftResult,
  type Me,
} from "@shared/schema";

const client = new Anthropic();

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

// --- Session augmentation ---
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

async function runAnalysis(input: string): Promise<Analysis> {
  const msg = await client.messages.create({
    model: "claude_sonnet_4_6",
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

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not signed in" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(express.json({ limit: "1mb" }));

  const MemoryStore = createMemoryStore(session);
  app.set("trust proxy", 1);
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "sift-prototype-secret-change-me",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({ checkPeriod: 1000 * 60 * 60 * 12 }),
      cookie: {
        httpOnly: true,
        // In prod the app may be served inside a cross-origin iframe proxy,
        // so cookies must be SameSite=None; Secure to be sent with requests.
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      },
    })
  );

  // --- Auth ---
  app.post("/api/auth/signup", async (req, res) => {
    const parsed = authSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const handle = parsed.data.handle.toLowerCase();
    const existing = await storage.getUserByHandle(handle);
    if (existing) {
      return res.status(409).json({ error: "That handle is taken." });
    }
    const user = await storage.createUser(handle, hashPassphrase(parsed.data.passphrase));
    req.session.userId = user.id;
    const me: Me = { id: user.id, handle: user.handle };
    res.json({ me });
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = authSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const handle = parsed.data.handle.toLowerCase();
    const user = await storage.getUserByHandle(handle);
    if (!user || !verifyPassphrase(parsed.data.passphrase, user.passphraseHash)) {
      return res.status(401).json({ error: "Handle or passphrase doesn't match." });
    }
    req.session.userId = user.id;
    const me: Me = { id: user.id, handle: user.handle };
    res.json({ me });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) return res.json({ me: null });
    const user = await storage.getUserById(req.session.userId);
    if (!user) return res.json({ me: null });
    const me: Me = { id: user.id, handle: user.handle };
    res.json({ me });
  });

  // --- Sifts ---

  app.post("/api/sift", async (req, res) => {
    const parsed = analyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const { input, inputMode } = parsed.data;

    try {
      const analysis = await runAnalysis(input);
      const id = newId();
      const userId = req.session.userId ?? null;

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
    const userId = req.session.userId!;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const list = await storage.listSiftsByUser(userId, q);
    res.json({ sifts: list });
  });

  // Delete one of my sifts
  app.delete("/api/sift/:id", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const ok = await storage.deleteSift(String(req.params.id), userId);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  });

  // Fetch a shared sift (public-by-link)
  app.get("/api/sift/:id", async (req, res) => {
    const row = await storage.getSift(String(req.params.id));
    if (!row) return res.status(404).json({ error: "Not found" });

    const result: SiftResult = {
      id: row.id,
      input: row.input,
      inputMode: row.inputMode as "text" | "voice",
      createdAt: row.createdAt,
      themes: JSON.parse(row.themes),
      coreIntent: row.coreIntent,
      nextStep: row.nextStep,
      reflection: row.reflection,
      mine: req.session.userId != null && row.userId === req.session.userId,
    };
    return res.json(result);
  });

  return httpServer;
}
