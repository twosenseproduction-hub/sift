import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import express from "express";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { storage, rawDb } from "./storage";
import { selectDailyPrompt, type RecentSiftSignal } from "./daily-prompt";
import { screenForCrisis, screenOutputForCrisis } from "./crisis-screen";
import {
  analyzeRequestSchema,
  analysisSchema,
  feedbackRequestSchema,
  feedbackStageSchema,
  feedbackSentimentSchema,
  loginSchema,
  signupSchema,
  contactUpdateSchema,
  classifyContact,
  checkinRequestSchema,
  checkinAnalysisSchema,
  updateSiftStatusSchema,
  deepenRequestSchema,
  bookmarkPayloadSchema,
  siftTurnMessageSchema,
  sortPromptPayloadSchema,
  sortRequestSchema,
  type Analysis,
  type CheckinAnalysis,
  type CheckinResult,
  type SiftResult,
  type Me,
  type User,
  type Checkin,
  type ThreadTurn,
  type SiftTurnMessage,
  type BookmarkPayload,
  type DeepenResponse,
  type CloseResponse,
  type SortPromptPayload,
  type SortResultPayload,
  type SortResponse,
  type Bookmark,
  type Sift,
  type FeedbackStats,
  type AdminReviewFeedback,
  type AdminReviewSift,
} from "@shared/schema";

const client = new Anthropic();

// Model name. Defaults to a real Anthropic public model name so the app works
// against api.anthropic.com out of the box. When running inside the Perplexity
// sandbox, set ANTHROPIC_MODEL=claude_sonnet_4_6 (the internal alias).
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

const SAFETY_CLAUSE = `SAFETY — NON-NEGOTIABLE:
- Never suggest, validate, romanticize, instruct on, or propose self-harm, suicide, or violence toward anyone. Not as a next step, not as a reflection, not as a theme, not as an observation, not even hypothetically.
- Do not use the words "suicide", "suicidal", "self-harm", "kill yourself/myself/himself/herself", "hurt yourself/myself", "end your/my life", "overdose", "cut yourself/myself", "better off dead", or any variant of those in your output.
- If the user's input hints at self-harm, harm to others, or despair, a separate safeguard handles it upstream — you will never be called in that case. If you somehow receive such input, respond with valid JSON containing only neutral, grounding language and a next step that is "Reach out to someone you trust today." Do not name methods, do not validate the ideation.
- Next steps must always be safe, legal, pro-life, non-violent actions. Actions directed at another person must be non-harmful (a conversation, a boundary, written reflection).
- No advice to isolate, disappear, quit everything, burn bridges, or "give up on life/living".`;

const SYSTEM_PROMPT = `You are Sift — a quiet, precise thinking companion.

Someone has just poured out a tangle of thoughts. Your job is to sift through the noise and return clarity.

You write like a calm, thoughtful guide — not a coach, not a therapist, not a hype man. No exclamation points. No emojis. No corporate language. No "great question!" No "let's dive in." Speak plainly, warmly, with weight.

${SAFETY_CLAUSE}

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

// --- Deepening (threaded) ---
//
// DEEPEN fires on every user reply. Sift responds conversationally — never
// with a full result card. The shape is a small JSON object; the client
// renders whichever fields are present. Signal / noise phrases MUST be drawn
// verbatim (or near-verbatim) from the user's own words in this thread.
const DEEPEN_SYSTEM_PROMPT = `You are Sift in Deepening Mode.

The person already has an original sift (their opening input and your first response). They are continuing the thread. You will receive:
- The original input they first brought
- Your original coreIntent, themes, and next step
- The full back-and-forth so far (may include user sort_result turns where the user actively sorted thread-derived phrases into matters / noise / unsure)
- Their newest reply

Your job is NOT to regenerate the full card. You are having a short, grounded exchange that deepens the thread. Each reply is small. Treat this like a slow conversation, not a report.

Respond with ONE or TWO of these fields, whichever the moment actually calls for:
- mirror: one short sentence naming what you just heard (not a summary — a distillation). Under 25 words.
- question: one sharper follow-up question that goes a layer deeper than where they currently are. Not leading. Not therapeutic. Under 20 words.
- mini: one short synthesizing sentence, only if the thread just took a real turn. Under 30 words. Omit otherwise.

DO NOT emit matters[] or noise[] arrays in deepening replies. The signal / noise work is now a dedicated practice moment the user does by hand between turns. Your only job in this reply is mirror / question / mini. If the most recent turn is a user sort_result, explicitly take it seriously in your mirror or question — name what they chose to treat as mattering or as noise, and respond to that shift.

Rules:
- Output at most 2 of the 3 fields. Usually 1. Keep it small.
- Never greet, never praise, never validate generically. No "that makes sense". No "I hear you".
- No exclamation points. No emojis. No corporate language.
- If the user seems to be landing or repeating, prefer a short mini or question that names the landing, rather than pushing them further.

${SAFETY_CLAUSE}

Return STRICT JSON. Only the fields you actually chose. Example shapes:
{"mirror": "…"}
{"mirror": "…", "question": "…"}
{"mini": "…"}
Output JSON only. No prose before or after.`;

// SORT_ITEMS fires when the server decides it is time for a Signal/Noise
// practice moment. The model's only job is to distill 6–8 short phrases from
// the actual thread that the user will then sort by hand. The phrases must be
// drawn from the user's language — never generic.
const SORT_ITEMS_SYSTEM_PROMPT = `You are Sift preparing a Signal / Noise practice moment.

You will receive the original input, the coreIntent, and the full thread so far. Produce 6 to 8 short phrases the user will sort by hand into "what matters most right now" vs "what may be noise right now".

Rules — these are non-negotiable:
- Every phrase must be drawn from the user's own words or a close interpretive distillation of a specific moment in the thread. Do not invent generic words like "fear", "clarity", "chaos", "growth", "balance". Use their language.
- Mix both the loud, surface-level concerns and the quiet, deeper threads you have noticed. A good set includes some items that obviously matter and some that feel loud but may actually be noise. Do not stack the deck toward one side.
- Include phrases that represent distinct concerns — avoid near-duplicates.
- Each phrase is 2 to 7 words. Short. Concrete. No quotation marks. No periods at the end.
- Do not label anything as matters or noise yourself. The user does the sorting.
- Also produce one short intro sentence (under 20 words) that gently invites them into the practice. Calm, not clinical. No greeting. No "let's". No exclamation points.

${SAFETY_CLAUSE}

Return STRICT JSON matching this shape:
{
  "intro": string,
  "items": [string, string, ...]   // 6 to 8 phrases
}
Output JSON only. No prose before or after.`;

// CHECKPOINT fires periodically (every ~4 user turns) to produce a synthesis
// across the whole thread. It IS the six-section bookmark payload. Labels and
// spec copy must match the product labels verbatim on the client.
const CHECKPOINT_SYSTEM_PROMPT = `You are Sift producing a Checkpoint — a short structured synthesis of a threaded conversation so far.

You will receive the original input, the original coreIntent + next step, and the full thread to date. The thread may include user sort_result turns where the user actively sorted phrases into matters / noise / unsure. Treat the most recent sort_result as the authoritative signal for what they currently consider matters vs noise — your matters[] and noise[] in this checkpoint should reflect their sort first, and may add at most one additional observation per column if something important is missing.

Produce a calm recap that someone could re-open later and immediately re-orient from.

Return STRICT JSON matching this shape:
{
  "pointing": string,      // one sentence — what this thread seems to be pointing to now (may differ from the opening coreIntent)
  "unfolded": string,      // 1–2 sentences — how the thread has shifted, in plain terms. No bullet points.
  "matters": [string],     // 2–4 short phrases drawn from the actual thread language. 2–6 words each.
  "noise": [string],       // 1–3 short phrases drawn from the actual thread language. 2–6 words each.
  "lastLanded": string,    // one sentence — where the user just left off in their own words/frame.
  "nextStep": string       // ONE concrete small action they could take this week. Starts with a verb. If nothing is ready, say "No clear step yet — sit with this a little longer."
}

Rules:
- matters/noise phrases MUST be drawn from what the user actually wrote in the thread. Do not invent generic words ("fear", "growth", "chaos"). Use their language.
- Tone: quiet, grounded, precise, warm but not flattering. Non-therapeutic, non-corporate.
- No exclamation points. No emojis.

${SAFETY_CLAUSE}

Output JSON only. No prose before or after.`;

// CLOSE fires when the user explicitly closes the loop. Produces a quiet,
// whole-thread reflection. Not a summary. Not advice.
const CLOSE_SYSTEM_PROMPT = `You are Sift closing a loop.

The user has chosen to close this thread for now. Read the full conversation and return ONE quiet reflection — a single sentence or two — that names what this process seemed to do for them, without flattery, without advice, without prescribing a next step.

Return STRICT JSON matching this shape:
{
  "reflection": string  // 1–2 sentences, under 40 words total. Calm. Observational. No "great work". No exclamation points.
}

${SAFETY_CLAUSE}

Output JSON only.`;

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

${SAFETY_CLAUSE}

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

// --- Deepening helpers ---

// Compact JSON extractor used by all three LLM modes below.
function extractJson(raw: string): any {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Model did not return JSON");
    return JSON.parse(m[0]);
  }
}

// Render the full thread into a compact user-role transcript for the model.
function renderThreadForModel(args: {
  originalInput: string;
  coreIntent: string;
  firstNextStep: string;
  turns: ThreadTurn[];
  latestUserText?: string;
}): string {
  const lines: string[] = [];
  lines.push(`Original input:\n${args.originalInput}`);
  lines.push("");
  lines.push(`Original coreIntent: ${args.coreIntent}`);
  lines.push(`Original next step: ${args.firstNextStep}`);
  lines.push("");
  lines.push("Thread so far (oldest first):");
  if (args.turns.length === 0) {
    lines.push("  (no turns yet)");
  } else {
    for (const t of args.turns) {
      if (t.role === "user" && t.kind === "message") {
        lines.push(`USER: ${t.text}`);
      } else if (t.role === "sift" && t.kind === "message") {
        const m = t.message;
        const parts: string[] = [];
        if (m.mirror) parts.push(`mirror=${m.mirror}`);
        if (m.question) parts.push(`question=${m.question}`);
        if (m.matters?.length) parts.push(`matters=[${m.matters.join(" | ")}]`);
        if (m.noise?.length) parts.push(`noise=[${m.noise.join(" | ")}]`);
        if (m.mini) parts.push(`mini=${m.mini}`);
        lines.push(`SIFT: ${parts.join("; ")}`);
      } else if (t.role === "sift" && t.kind === "checkpoint") {
        const c = t.checkpoint;
        lines.push(
          `SIFT (checkpoint): pointing=${c.pointing}; matters=[${c.matters.join(
            " | ",
          )}]; noise=[${c.noise.join(
            " | ",
          )}]; lastLanded=${c.lastLanded}; nextStep=${c.nextStep}`,
        );
      } else if (t.role === "sift" && t.kind === "closure") {
        lines.push(`SIFT (closure): ${t.reflection}`);
      } else if (t.role === "sift" && t.kind === "sort_prompt") {
        lines.push(
          `SIFT (sort_prompt): offered phrases for sorting: [${t.sortPrompt.items.join(
            " | ",
          )}]`,
        );
      } else if (t.role === "user" && t.kind === "sort_result") {
        if (t.sortResult.skipped) {
          lines.push(`USER (sort_result): skipped the sort.`);
        } else {
          lines.push(
            `USER (sort_result): matters=[${t.sortResult.matters.join(
              " | ",
            )}]; noise=[${t.sortResult.noise.join(
              " | ",
            )}]; unsure=[${t.sortResult.unsure.join(" | ")}]`,
          );
        }
      }
    }
  }
  if (args.latestUserText) {
    lines.push("");
    lines.push(`Latest user reply:\n${args.latestUserText}`);
  }
  return lines.join("\n");
}

// Generate the 6–8 thread-derived phrases for the sort activity. Items are
// deduplicated post-hoc and capped to 8. We fall back to a minimal set only
// if the model returns something unusable — never to generic words.
async function runSortItems(args: {
  originalInput: string;
  coreIntent: string;
  firstNextStep: string;
  turns: ThreadTurn[];
}): Promise<SortPromptPayload> {
  const userBlock =
    renderThreadForModel(args) +
    "\n\nProduce the Signal / Noise practice items. Return JSON only.";
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SORT_ITEMS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userBlock }],
  });
  const textBlock = msg.content.find((b: any) => b.type === "text") as any;
  const parsed = extractJson((textBlock?.text ?? "").trim());
  const validated = sortPromptPayloadSchema.parse(parsed);
  // Dedupe and trim to keep the practice pane visually calm.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of validated.items) {
    const item = raw.trim().replace(/[.“”"]+$/g, "");
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= 8) break;
  }
  return {
    intro: validated.intro.trim(),
    items: unique.length >= 4 ? unique : validated.items,
  };
}

// Output screen on the sort prompt. Runs the same crisis output screen over
// the flattened intro + items text for defense in depth.
function screenSortPromptForCrisis(p: SortPromptPayload): boolean {
  return screenOutputForCrisis({ intro: p.intro, items: p.items });
}

async function runDeepening(args: {
  originalInput: string;
  coreIntent: string;
  firstNextStep: string;
  turns: ThreadTurn[];
  latestUserText: string;
}): Promise<SiftTurnMessage> {
  const userBlock =
    renderThreadForModel(args) +
    "\n\nRespond as Sift in Deepening Mode. Return JSON only.";
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: DEEPEN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userBlock }],
  });
  const textBlock = msg.content.find((b: any) => b.type === "text") as any;
  const parsed = extractJson((textBlock?.text ?? "").trim());
  const message = siftTurnMessageSchema.parse(parsed);
  // Ensure at least one field was populated; if the model returned {} coerce
  // into a gentle fallback rather than crashing the route.
  if (
    !message.mirror &&
    !message.question &&
    !message.matters?.length &&
    !message.noise?.length &&
    !message.mini
  ) {
    return { question: "Say a little more about that." };
  }
  return message;
}

async function runCheckpoint(args: {
  originalInput: string;
  coreIntent: string;
  firstNextStep: string;
  turns: ThreadTurn[];
}): Promise<BookmarkPayload> {
  const userBlock =
    renderThreadForModel(args) +
    "\n\nProduce a Checkpoint. Return JSON only.";
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: CHECKPOINT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userBlock }],
  });
  const textBlock = msg.content.find((b: any) => b.type === "text") as any;
  const parsed = extractJson((textBlock?.text ?? "").trim());
  return bookmarkPayloadSchema.parse(parsed);
}

async function runClosure(args: {
  originalInput: string;
  coreIntent: string;
  firstNextStep: string;
  turns: ThreadTurn[];
}): Promise<string> {
  const userBlock =
    renderThreadForModel(args) +
    "\n\nClose the loop. Return JSON only.";
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: CLOSE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userBlock }],
  });
  const textBlock = msg.content.find((b: any) => b.type === "text") as any;
  const parsed = extractJson((textBlock?.text ?? "").trim());
  const reflection = typeof parsed?.reflection === "string" ? parsed.reflection.trim() : "";
  if (!reflection) return "You stayed with something long enough to notice where it wanted to rest.";
  return reflection;
}

// Convergence: does the newest checkpoint repeat the previous one? We take a
// small token-set intersection over matters + nextStep normalized to words of
// length >= 3. If the Jaccard ratio is high, we flag the thread as converged.
function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3),
  );
}
function detectConvergence(
  prev: BookmarkPayload | undefined,
  next: BookmarkPayload,
): boolean {
  if (!prev) return false;
  const prevBag = tokenize(
    [...prev.matters, prev.nextStep, prev.lastLanded].join(" "),
  );
  const nextBag = tokenize(
    [...next.matters, next.nextStep, next.lastLanded].join(" "),
  );
  if (prevBag.size === 0 || nextBag.size === 0) return false;
  let overlap = 0;
  nextBag.forEach((w) => {
    if (prevBag.has(w)) overlap++;
  });
  // Union size = prev + next - overlap (avoids spreading a Set into an array).
  const union = prevBag.size + nextBag.size - overlap;
  if (union === 0) return false;
  const jaccard = overlap / union;
  return jaccard >= 0.55;
}

// --- Sort cadence helpers ---
//
// A sort is "open" when the most recent sort turn is a sort_prompt with no
// sort_result that follows it. We look backward through the thread so the
// lookup is O(turns).
function findOpenSortPrompt(
  turns: ThreadTurn[],
): Extract<ThreadTurn, { role: "sift"; kind: "sort_prompt" }> | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t.role === "user" && t.kind === "sort_result") return null;
    if (t.role === "sift" && t.kind === "sort_prompt") return t;
  }
  return null;
}

// How many user message turns have happened since the last sort_result. Used
// so two sort pauses don't stack inside the same few turns.
function countUserMessagesSinceLastSort(turns: ThreadTurn[]): number {
  let count = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t.role === "user" && t.kind === "sort_result") return count;
    if (t.role === "user" && t.kind === "message") count++;
  }
  // No prior sort at all — treat everything as "since last sort".
  return count;
}

// Merge the user's sort into an existing bookmark column. Priority:
//   1. Everything the user placed into THIS column — in their order.
//   2. Prior entries that were NOT moved to the opposite column by the user.
//      (If they put a phrase into noise, don't keep it in matters.)
function mergePreservingUserSort(
  prior: string[],
  userThisColumn: string[],
  userOtherColumn: string[],
  cap: number,
): string[] {
  const lower = (s: string) => s.trim().toLowerCase();
  const opposed = new Set(userOtherColumn.map(lower));
  const chosen = new Set(userThisColumn.map(lower));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of userThisColumn) {
    const k = lower(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  for (const item of prior) {
    const k = lower(item);
    if (seen.has(k)) continue;
    if (opposed.has(k)) continue; // user moved it to the other side
    if (chosen.has(k)) continue; // already covered
    seen.add(k);
    out.push(item);
  }
  return out.slice(0, cap);
}

// Shared checkpoint emitter — used by both /deepen and /sort. Appends the
// checkpoint turn into `newTurns` on success, upserts the bookmark, and
// returns the bookmark + convergence flag. On error or crisis trip, returns
// null (caller proceeds without a checkpoint).
async function tryEmitCheckpoint(args: {
  sift: Sift;
  turnsForModel: ThreadTurn[];
  newTurns: ThreadTurn[];
}): Promise<{ bookmark: Bookmark; converged: boolean } | null> {
  try {
    const checkpointPayload = await runCheckpoint({
      originalInput: args.sift.input,
      coreIntent: args.sift.coreIntent,
      firstNextStep: args.sift.nextStep,
      turns: args.turnsForModel,
    });
    if (
      screenOutputForCrisis({
        pointing: checkpointPayload.pointing,
        unfolded: checkpointPayload.unfolded,
        matters: checkpointPayload.matters,
        noise: checkpointPayload.noise,
        lastLanded: checkpointPayload.lastLanded,
        nextStep: checkpointPayload.nextStep,
      })
    ) {
      console.warn("[crisis-screen] checkpoint output tripped — discarding");
      return null;
    }
    const prev = await storage.getBookmark(args.sift.id);
    const converged = detectConvergence(prev?.payload, checkpointPayload);
    const bm = await storage.upsertBookmark(args.sift.id, checkpointPayload);
    const checkpointTurn = await storage.appendTurn({
      siftId: args.sift.id,
      role: "sift",
      kind: "checkpoint",
      payload: JSON.stringify(checkpointPayload),
    });
    args.newTurns.push(checkpointTurn);
    return { bookmark: bm, converged };
  } catch (err) {
    console.warn("[deepen] checkpoint failed:", err);
    return null;
  }
}

// Signal screen over a deepening message — a targeted subset of the stored
// analysis screen. We stringify the message payload and run the same output
// screener against it for defense in depth.
function screenDeepenForCrisis(m: SiftTurnMessage): boolean {
  return screenOutputForCrisis({
    mirror: m.mirror ?? "",
    question: m.question ?? "",
    mini: m.mini ?? "",
    matters: m.matters ?? [],
    noise: m.noise ?? [],
  });
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

  // --- Feedback ---
  //
  // POST /api/feedback creates a feedback row. Open to both signed-in and
  // anonymous users (anonymous = userId null). The client supplies stage,
  // sentiment, optional tag, optional message, and an optional siftId. If a
  // siftId is given we hydrate the input + coreIntent snapshots server-side
  // so the admin can see context without an extra fetch.
  app.post("/api/feedback", async (req, res) => {
    const parsed = feedbackRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid feedback",
      });
    }
    const userId = readToken(req); // null = anonymous
    const { siftId, stage, sentiment } = parsed.data;
    const tag = (parsed.data.tag ?? null)?.toString().slice(0, 64) || null;
    const messageRaw = parsed.data.message ?? null;
    const message = messageRaw && messageRaw.trim()
      ? messageRaw.trim().slice(0, 2000)
      : null;

    let inputSnapshot: string | null = null;
    let coreIntentSnapshot: string | null = null;
    if (siftId) {
      const sift = await storage.getSift(siftId);
      if (sift) {
        // Truncate the input snapshot — we only need a hint of context, not
        // the entire raw dump. 600 chars is enough to recognize the sift
        // without bloating the feedback table.
        inputSnapshot = sift.input.slice(0, 600);
        coreIntentSnapshot = sift.coreIntent;
      }
    }

    const created = await storage.createFeedback({
      userId,
      siftId: siftId ?? null,
      stage,
      sentiment,
      tag,
      message,
      inputSnapshot,
      coreIntentSnapshot,
    });
    res.json({ feedback: created });
  });

  // --- Admin feedback review (privacy-safe) ---
  //
  // The admin reviewer needs to assess Sift quality — themes, coreIntent,
  // nextStep, reflection, and basic metadata — without ever seeing the raw
  // user prompt. Routes below return ONLY review-safe DTOs (AdminReviewFeedback
  // / AdminReviewSift) built via explicit allowlist serializers in storage.ts.
  // The unfiltered listFeedback / setFeedbackResolved methods are deliberately
  // not used here so a future schema addition can't accidentally leak prompt
  // text through this surface. The DB still stores everything intact for
  // normal product behavior.

  app.get("/api/admin/feedback", requireAdmin, async (req, res) => {
    // Lightweight query-string parsing. All filters optional; invalid values
    // are ignored rather than returning a 400, since the admin UI may glue
    // together filters loosely.
    const stageRaw = req.query.stage as string | undefined;
    const sentimentRaw = req.query.sentiment as string | undefined;
    const stage = stageRaw && feedbackStageSchema.safeParse(stageRaw).success
      ? (stageRaw as AdminReviewFeedback["stage"])
      : undefined;
    const sentiment = sentimentRaw && feedbackSentimentSchema.safeParse(sentimentRaw).success
      ? (sentimentRaw as AdminReviewFeedback["sentiment"])
      : undefined;
    const tag = typeof req.query.tag === "string" && req.query.tag
      ? (req.query.tag as string).slice(0, 64)
      : undefined;
    let resolved: boolean | undefined;
    if (req.query.resolved === "true") resolved = true;
    else if (req.query.resolved === "false") resolved = false;
    const audience = typeof req.query.audience === "string" ? req.query.audience : undefined;
    const items: AdminReviewFeedback[] = await storage.listFeedbackForReview({
      stage,
      sentiment,
      tag,
      resolved,
      signedInOnly: audience === "signed_in",
      anonymousOnly: audience === "anonymous",
      limit: 500,
    });
    res.json({ feedback: items });
  });

  app.get("/api/admin/feedback/stats", requireAdmin, async (_req, res) => {
    const stats: FeedbackStats = await storage.getFeedbackStats();
    res.json(stats);
  });

  // Single-feedback detail with the linked sift's structured output (themes,
  // coreIntent, nextStep, reflection) for review. The sift comes through the
  // allowlist serializer toAdminReviewSift — no `input` field, ever.
  app.get("/api/admin/feedback/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid feedback id" });
    }
    const item: AdminReviewFeedback | undefined =
      await storage.getFeedbackForReview(id);
    if (!item) return res.status(404).json({ error: "Not found" });
    let sift: AdminReviewSift | null = null;
    if (item.siftId) {
      sift = (await storage.getAdminReviewSift(item.siftId)) ?? null;
    }
    res.json({ feedback: item, sift });
  });

  app.patch("/api/admin/feedback/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid feedback id" });
    }
    const resolved = req.body?.resolved;
    if (typeof resolved !== "boolean") {
      return res.status(400).json({ error: "resolved must be boolean" });
    }
    const updated: AdminReviewFeedback | undefined =
      await storage.setFeedbackResolvedForReview(id, resolved);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json({ feedback: updated });
  });

  // --- Daily prompt (reads the 300-prompt library) ---
  //
  // GET /api/daily-prompt?mood=calm
  //   Cycle day is a shared UTC calendar day counted from a fixed epoch
  //   (Jan 1 2026 UTC). It ticks over at midnight UTC, same for everyone.
  //
  //   - Authed users: userKey = u:<id>. hasPriorSift = sift count > 0.
  //   - Anon users:   userKey = "anon". hasPriorSift always false.
  //
  //   Selection is deterministic for the same (userKey, cycleDay) pair, so
  //   the same user sees the same prompt all day and a new one at UTC
  //   midnight.
  const DAY_MS = 24 * 60 * 60 * 1000;
  // Shared epoch so theme rotation is stable across users, devices, and
  // sessions. Cycle day ticks over at UTC midnight, not at the user's
  // signup time. Jan 1 2026 UTC = day 0.
  const CYCLE_EPOCH_MS = Date.UTC(2026, 0, 1);
  const currentCycleDay = () =>
    Math.floor((Date.now() - CYCLE_EPOCH_MS) / DAY_MS);
  const countSiftsForUserStmt = rawDb.prepare(
    `SELECT COUNT(*) AS n FROM sifts WHERE user_id = ?`
  );
  // Recent sifts feeding the pattern-aware prompt selector.
  // 30 day lookback, newest first, capped at 40 to bound CPU/memory.
  const recentSiftsStmt = rawDb.prepare(
    `SELECT created_at, themes, core_intent, next_step
       FROM sifts
      WHERE user_id = ? AND created_at >= ?
      ORDER BY created_at DESC
      LIMIT 40`
  );

  app.get("/api/daily-prompt", async (req, res) => {
    const mood =
      typeof req.query.mood === "string" ? req.query.mood : undefined;

    // Optional client-supplied local hour for time-of-day bias (0–23).
    // Anonymous callers can pass ?hour=14 to get a morning/evening-appropriate
    // prompt; authed callers can do the same. Invalid values are ignored.
    const rawHour =
      typeof req.query.hour === "string" ? Number(req.query.hour) : NaN;
    const localHour =
      Number.isFinite(rawHour) && rawHour >= 0 && rawHour <= 23
        ? Math.floor(rawHour)
        : null;

    const userId = readToken(req);
    // Cycle day is calendar-UTC and shared by everyone. It ticks over at
    // UTC midnight. Authed users still get a deterministic-but-distinct
    // prompt via their userKey tiebreak, so two users on the same day
    // don't necessarily see the same prompt.
    const themeCycleDay = currentCycleDay();
    let hasPriorSift = false;
    let userKey: string;
    let recentSifts: RecentSiftSignal[] | undefined;

    if (userId) {
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(401).json({ error: "Session expired" });
      }
      const { n } = countSiftsForUserStmt.get(userId) as { n: number };
      hasPriorSift = n > 0;
      userKey = `u:${userId}`;

      // Load the last ~30 days of sifts for pattern signals.
      if (hasPriorSift) {
        const since = Date.now() - 30 * DAY_MS;
        const rows = recentSiftsStmt.all(userId, since) as Array<{
          created_at: number;
          themes: string;
          core_intent: string | null;
          next_step: string | null;
        }>;
        recentSifts = rows.map((r) => {
          // themes is stored as JSON string of [{title, summary}]. Extract titles.
          let titles: string[] = [];
          try {
            const parsed = JSON.parse(r.themes);
            if (Array.isArray(parsed)) {
              titles = parsed
                .map((t) => (t && typeof t.title === "string" ? t.title : ""))
                .filter(Boolean);
            }
          } catch {
            // Malformed JSON — ignore titles for this row.
          }
          return {
            createdAt: r.created_at,
            themeTitles: titles,
            text: [r.core_intent || "", r.next_step || ""].join(" ").trim(),
          };
        });
      }
    } else {
      hasPriorSift = false;
      userKey = "anon";
    }

    const result = selectDailyPrompt({
      themeCycleDay,
      hasPriorSift,
      mood: mood ?? null,
      userKey,
      recentSifts,
      localHour,
    });

    res.json({
      prompt: {
        id: result.prompt.id,
        text: result.prompt.text,
        type: result.prompt.type,
        outputLength: result.prompt.outputLength,
        requiresPriorSift: result.prompt.priorSiftRef,
        hasChoiceLogic: result.prompt.userChoiceLogic,
        usageNotes: result.prompt.usageNotes,
      },
      theme: {
        num: result.themeNum,
        name: result.themeName,
      },
      themeCycleDay: result.themeCycleDay,
      hasPriorSift,
      appliedFilters: result.appliedFilters,
    });
  });

  // --- Sifts ---

  app.post("/api/sift", async (req, res) => {
    const parsed = analyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const { input, inputMode } = parsed.data;

    // Crisis safeguard — before persistence, before LLM. If the input describes
    // suicide, self-harm, or intent to harm others, return a care response and
    // stop. Nothing is stored; nothing is sent to the model.
    if (screenForCrisis(input)) {
      return res.json({ type: "care" });
    }

    const userId = readToken(req);

    try {
      const analysis = await runAnalysis(input);

      // Output safeguard — scan every string in the model's response. If it
      // contains crisis-adjacent language (shouldn't, given the system prompt,
      // but we do not rely on that), discard the response entirely. Nothing is
      // persisted; the client surfaces the care screen.
      if (screenOutputForCrisis(analysis)) {
        console.warn("[crisis-screen] output tripped on /api/sift — discarding");
        return res.json({ type: "care" });
      }

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

  // Update thread status on one of my sifts (open | closed)
  app.patch("/api/sift/:id/status", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const parsed = updateSiftStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const updated = await storage.updateSiftStatus(
      String(req.params.id),
      userId,
      parsed.data.status,
    );
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json({ sift: updated });
  });

  // Fetch a shared sift (public-by-link)
  app.get("/api/sift/:id", async (req, res) => {
    const row = await storage.getSift(String(req.params.id));
    if (!row) return res.status(404).json({ error: "Not found" });

    const viewerId = readToken(req);
    const isMine = viewerId != null && row.userId === viewerId;
    const checkinRows = await storage.listCheckins(row.id);
    // Thread state is only returned to the owner — readers of a shared link
    // see the original sift only, not the private deepening thread.
    const turns = isMine ? await storage.listTurns(row.id) : [];
    const bookmark = isMine ? await storage.getBookmark(row.id) : undefined;

    const result: SiftResult = {
      id: row.id,
      input: row.input,
      inputMode: row.inputMode as "text" | "voice",
      createdAt: row.createdAt,
      themes: JSON.parse(row.themes),
      coreIntent: row.coreIntent,
      nextStep: row.nextStep,
      reflection: row.reflection,
      mine: isMine,
      status: (row.status === "closed" ? "closed" : "open") as any,
      checkins: checkinRows.map(checkinToResult),
      turns,
      bookmark,
    };
    return res.json(result);
  });

  // --- Deepening thread (owner only) ---
  //
  // POST /api/sift/:id/deepen — append a user turn + run Sift in deepening
  // mode. Every 3rd user message turn we instead emit a Signal / Noise sort
  // practice pane (sort_prompt) for the user to complete by hand. Every 4th
  // user message turn we also run a synthesis checkpoint and upsert the thread
  // bookmark. Returns the newly appended turns plus (if fresh) the updated
  // bookmark + convergence hint. If a sort_prompt is still unanswered, the
  // route returns 409 — the client must call /sort first.
  app.post("/api/sift/:id/deepen", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const parsed = deepenRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      });
    }
    const siftId = String(req.params.id);
    const sift = await storage.getSift(siftId);
    if (!sift) return res.status(404).json({ error: "Not found" });
    if (sift.userId !== userId) {
      return res.status(403).json({ error: "Not your sift" });
    }

    // Block new user messages if a sort is still open. The client should be
    // rendering the practice pane; this guards against race conditions.
    {
      const existing = await storage.listTurns(siftId);
      const openSort = findOpenSortPrompt(existing);
      if (openSort) {
        return res.status(409).json({
          error: "There is still a sort in progress. Complete it first.",
          awaitingSortTurnId: openSort.id,
        });
      }
    }

    // Crisis safeguard on the new user reply — before persistence, before LLM.
    if (screenForCrisis(parsed.data.text)) {
      const payload: DeepenResponse = { type: "care" };
      return res.json(payload);
    }

    try {
      // Append the user turn first so it survives even if the LLM call fails.
      const userTurn = await storage.appendTurn({
        siftId,
        role: "user",
        kind: "message",
        payload: JSON.stringify({ text: parsed.data.text }),
      });

      const priorTurns = await storage.listTurns(siftId);

      // --- Signal / Noise practice cadence ---
      // Trigger a sort pane every 3rd user message turn (messages only, not
      // sort_results). Require at least 2 user messages since the last sort
      // so we don't stack them.
      const userMessageCount = priorTurns.filter(
        (t) => t.role === "user" && t.kind === "message",
      ).length;
      const messagesSinceLastSort = countUserMessagesSinceLastSort(priorTurns);
      const shouldOfferSort =
        userMessageCount >= 3 &&
        userMessageCount % 3 === 0 &&
        messagesSinceLastSort >= 2;

      if (shouldOfferSort) {
        try {
          const sortPayload = await runSortItems({
            originalInput: sift.input,
            coreIntent: sift.coreIntent,
            firstNextStep: sift.nextStep,
            turns: priorTurns,
          });
          if (!screenSortPromptForCrisis(sortPayload)) {
            const sortTurn = await storage.appendTurn({
              siftId,
              role: "sift",
              kind: "sort_prompt",
              payload: JSON.stringify(sortPayload),
            });
            const payload: DeepenResponse = {
              type: "turns",
              turns: [userTurn, sortTurn],
              awaitingSort: true,
            };
            return res.json(payload);
          } else {
            console.warn(
              "[crisis-screen] sort_prompt output tripped — falling through to normal deepen",
            );
          }
        } catch (err) {
          // Sort generation failure should never block the main deepening
          // reply — fall through to the normal message turn.
          console.warn("[deepen] sort_items failed, falling through:", err);
        }
      }

      // --- Normal deepening message turn ---
      const deepenArgs = {
        originalInput: sift.input,
        coreIntent: sift.coreIntent,
        firstNextStep: sift.nextStep,
        turns: priorTurns,
        latestUserText: parsed.data.text,
      };

      const message = await runDeepening(deepenArgs);
      if (screenDeepenForCrisis(message)) {
        console.warn(
          "[crisis-screen] output tripped on /api/sift/:id/deepen — discarding",
        );
        return res.json({ type: "care" });
      }

      const siftTurn = await storage.appendTurn({
        siftId,
        role: "sift",
        kind: "message",
        payload: JSON.stringify(message),
      });

      // Every 4th user message turn, run a synthesis checkpoint + upsert the
      // bookmark.
      const newTurns: ThreadTurn[] = [userTurn, siftTurn];
      let bookmark: { updatedAt: number; payload: BookmarkPayload } | undefined;
      let converged = false;

      if (userMessageCount > 0 && userMessageCount % 4 === 0) {
        const bookmarkResult = await tryEmitCheckpoint({
          sift,
          turnsForModel: [...priorTurns, siftTurn],
          newTurns,
        });
        if (bookmarkResult) {
          bookmark = bookmarkResult.bookmark;
          converged = bookmarkResult.converged;
        }
      }

      const payload: DeepenResponse = {
        type: "turns",
        turns: newTurns,
        ...(bookmark ? { bookmark } : {}),
        ...(converged ? { converged: true } : {}),
      };
      return res.json(payload);
    } catch (err: any) {
      console.error("deepen error", err);
      return res.status(500).json({
        error: "Could not deepen that right now.",
        detail: err?.message ?? String(err),
      });
    }
  });

  // POST /api/sift/:id/sort — the user has finished (or skipped) the
  // Signal / Noise practice pane. Persists their sort_result, merges their
  // choices into the bookmark so the recap reflects THEIR sort first, then
  // generates the next deepening reply that responds to the sort.
  app.post("/api/sift/:id/sort", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const parsed = sortRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      });
    }
    const siftId = String(req.params.id);
    const sift = await storage.getSift(siftId);
    if (!sift) return res.status(404).json({ error: "Not found" });
    if (sift.userId !== userId) {
      return res.status(403).json({ error: "Not your sift" });
    }

    try {
      const priorTurns = await storage.listTurns(siftId);
      const openSort = findOpenSortPrompt(priorTurns);
      if (!openSort) {
        return res.status(409).json({ error: "No open sort to submit." });
      }

      // Constrain the user's arrays to the items that were offered — anything
      // else is discarded. Prevents the client from smuggling in arbitrary
      // phrases. Comparisons are case-insensitive after trim.
      const offered = new Set(
        openSort.sortPrompt.items.map((s) => s.trim().toLowerCase()),
      );
      const filter = (arr: string[]) =>
        arr
          .map((s) => s.trim())
          .filter((s) => s && offered.has(s.toLowerCase()));

      const result: SortResultPayload = parsed.data.skipped
        ? { matters: [], noise: [], unsure: [], skipped: true }
        : {
            matters: filter(parsed.data.matters),
            noise: filter(parsed.data.noise),
            unsure: filter(parsed.data.unsure),
          };

      const sortResultTurn = await storage.appendTurn({
        siftId,
        role: "user",
        kind: "sort_result",
        payload: JSON.stringify(result),
      });

      // Merge the user's sort into the bookmark. If there's no bookmark yet,
      // we do nothing here — the next checkpoint will build one from scratch
      // and will already have the user's sort in its context.
      let bookmark: Bookmark | undefined;
      if (!result.skipped) {
        const prev = await storage.getBookmark(siftId);
        if (prev) {
          const merged: BookmarkPayload = {
            ...prev.payload,
            matters: mergePreservingUserSort(
              prev.payload.matters,
              result.matters,
              result.noise,
              4,
            ),
            noise: mergePreservingUserSort(
              prev.payload.noise,
              result.noise,
              result.matters,
              3,
            ),
          };
          // Bookmark schema requires min(1) for matters and noise — pad with
          // the prior entries rather than letting it drop below.
          if (merged.matters.length === 0) merged.matters = prev.payload.matters;
          if (merged.noise.length === 0) merged.noise = prev.payload.noise;
          bookmark = await storage.upsertBookmark(siftId, merged);
        }
      }

      // Generate the next Sift reply with the sort_result now in the thread.
      const turnsWithSort = [...priorTurns, sortResultTurn];
      const latestUserText = result.skipped
        ? ""
        : `I sorted these as matters: ${result.matters.join("; ") || "(none)"}. Noise: ${result.noise.join("; ") || "(none)"}. Unsure: ${result.unsure.join("; ") || "(none)"}.`;

      const message = await runDeepening({
        originalInput: sift.input,
        coreIntent: sift.coreIntent,
        firstNextStep: sift.nextStep,
        turns: turnsWithSort,
        latestUserText,
      });
      if (screenDeepenForCrisis(message)) {
        console.warn(
          "[crisis-screen] output tripped on /api/sift/:id/sort — discarding",
        );
        return res.json({ type: "care" });
      }
      const siftTurn = await storage.appendTurn({
        siftId,
        role: "sift",
        kind: "message",
        payload: JSON.stringify(message),
      });

      const newTurns: ThreadTurn[] = [sortResultTurn, siftTurn];

      // Sort completion counts toward the checkpoint cadence too — if the
      // current user-message count is a multiple of 4, run a checkpoint. This
      // ensures the bookmark catches up after the sort has reshaped matters
      // and noise.
      const userMessageCount = turnsWithSort.filter(
        (t) => t.role === "user" && t.kind === "message",
      ).length;
      let converged = false;
      if (userMessageCount > 0 && userMessageCount % 4 === 0) {
        const bookmarkResult = await tryEmitCheckpoint({
          sift,
          turnsForModel: [...turnsWithSort, siftTurn],
          newTurns,
        });
        if (bookmarkResult) {
          bookmark = bookmarkResult.bookmark;
          converged = bookmarkResult.converged;
        }
      }

      const payload: SortResponse = {
        type: "turns",
        turns: newTurns,
        ...(bookmark ? { bookmark } : {}),
        ...(converged ? { converged: true } : {}),
      };
      return res.json(payload);
    } catch (err: any) {
      console.error("sort error", err);
      return res.status(500).json({
        error: "Could not finish the sort right now.",
        detail: err?.message ?? String(err),
      });
    }
  });

  // GET /api/sift/:id/bookmark — owner only. Returns the latest bookmark.
  app.get("/api/sift/:id/bookmark", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const siftId = String(req.params.id);
    const sift = await storage.getSift(siftId);
    if (!sift) return res.status(404).json({ error: "Not found" });
    if (sift.userId !== userId) {
      return res.status(403).json({ error: "Not your sift" });
    }
    const bookmark = await storage.getBookmark(siftId);
    return res.json({ bookmark: bookmark ?? null });
  });

  // POST /api/sift/:id/close — owner only. Runs whole-thread closure
  // reflection, appends a closure turn, marks the sift closed.
  app.post("/api/sift/:id/close", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const siftId = String(req.params.id);
    const sift = await storage.getSift(siftId);
    if (!sift) return res.status(404).json({ error: "Not found" });
    if (sift.userId !== userId) {
      return res.status(403).json({ error: "Not your sift" });
    }
    try {
      const turns = await storage.listTurns(siftId);
      const reflection = await runClosure({
        originalInput: sift.input,
        coreIntent: sift.coreIntent,
        firstNextStep: sift.nextStep,
        turns,
      });
      // Output screen on the closure sentence.
      if (screenOutputForCrisis({ reflection })) {
        console.warn("[crisis-screen] closure tripped — discarding");
        const payload: CloseResponse = { type: "care" };
        return res.json(payload);
      }
      const turn = await storage.appendTurn({
        siftId,
        role: "sift",
        kind: "closure",
        payload: JSON.stringify({ reflection }),
      });
      await storage.updateSiftStatus(siftId, userId, "closed");
      const payload: CloseResponse = { type: "closed", reflection, turn };
      return res.json(payload);
    } catch (err: any) {
      console.error("close error", err);
      return res.status(500).json({
        error: "Could not close this right now.",
        detail: err?.message ?? String(err),
      });
    }
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

    // Crisis safeguard — screen the note before persisting or calling the LLM.
    if (screenForCrisis(parsed.data.note ?? "")) {
      return res.json({ type: "care" });
    }

    try {
      const analysis = await runCheckinAnalysis(
        sift.input,
        sift.nextStep,
        parsed.data.status,
        parsed.data.note ?? ""
      );

      // Output safeguard — same discard-and-care policy for check-in outputs.
      if (screenOutputForCrisis(analysis)) {
        console.warn("[crisis-screen] output tripped on /api/sift/:id/checkin — discarding");
        return res.json({ type: "care" });
      }

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
