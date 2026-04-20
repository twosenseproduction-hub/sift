import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import {
  analyzeRequestSchema,
  analysisSchema,
  type Analysis,
  type SiftResult,
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
  // short, url-friendly id
  const chars = "abcdefghijkmnopqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
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

  // Extract text
  const textBlock = msg.content.find((b: any) => b.type === "text") as any;
  const raw = (textBlock?.text ?? "").trim();

  // Strip any accidental fences
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // Last-ditch: find first { ... } block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Model did not return JSON");
    parsed = JSON.parse(match[0]);
  }

  return analysisSchema.parse(parsed);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Allow larger bodies for transcribed voice notes
  app.use(express.json({ limit: "1mb" }));

  // POST /api/sift — analyze messy thoughts, persist, return full result
  app.post("/api/sift", async (req, res) => {
    const parsed = analyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const { input, inputMode } = parsed.data;

    try {
      const analysis = await runAnalysis(input);

      const id = newId();
      await storage.createSift({
        id,
        input,
        inputMode,
        themes: JSON.stringify(analysis.themes),
        coreIntent: analysis.coreIntent,
        nextStep: analysis.nextStep,
        reflection: analysis.reflection,
      });

      const result: SiftResult = {
        id,
        input,
        inputMode,
        createdAt: Date.now(),
        ...analysis,
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

  // GET /api/sift/:id — fetch a shared sift
  app.get("/api/sift/:id", async (req, res) => {
    const row = await storage.getSift(req.params.id);
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
    };
    return res.json(result);
  });

  return httpServer;
}
