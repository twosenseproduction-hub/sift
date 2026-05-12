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
  siftFragmentsRequestSchema,
  siftFragmentsResponseSchema,
  siftCorrectionRequestSchema,
  operatorArtifactSchema,
  type StepScope,
  type SiftRevisionSnapshot,
  type Theme,
  feedbackRequestSchema,
  feedbackStageSchema,
  feedbackSentimentSchema,
  loginSchema,
  signupSchema,
  contactUpdateSchema,
  classifyContact,
  checkinRequestSchema,
  checkinAnalysisSchema,
  checkinModelOutputSchema,
  updateSiftStatusSchema,
  siftClosurePromptPatchSchema,
  siftBreakdownRequestSchema,
  siftStepRevisionRequestSchema,
  siftStepRevisionResponseSchema,
  stepScopeSchema,
  deepenRequestSchema,
  bookmarkPayloadSchema,
  siftTurnMessageSchema,
  sortPromptPayloadSchema,
  sortRequestSchema,
  updateThreadSchema,
  type Analysis,
  type OperatorArtifact,
  type CheckinAnalysis,
  type CheckinModelOutput,
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
  type ReEntryResponse,
  type FeedbackStats,
  type AdminReviewFeedback,
  type AdminReviewSift,
} from "@shared/schema";

const client = new Anthropic();

// Model name. Defaults to a real Anthropic public model name so the app works
// against api.anthropic.com out of the box. When running inside the Perplexity
// sandbox, set ANTHROPIC_MODEL=claude_sonnet_4_6 (the internal alias).
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

/** Training layer — redundancy gate & closure prompt thresholds (tunable) */
const REDUNDANCY_LOW_THRESHOLD = 0.4;
const REDUNDANCY_HIGH_THRESHOLD = 0.65;
const MASTERY_SORT_ALIGNMENT_MIN = 0.75;
const MASTERY_RECURRING_SIGNAL_MIN = 3;
const MASTERY_COUNT_MIN = 2;

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "as",
  "by",
  "with",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "can",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "i",
  "im",
  "ive",
  "id",
  "you",
  "your",
  "yours",
  "we",
  "they",
  "them",
  "their",
  "what",
  "which",
  "who",
  "whom",
  "when",
  "where",
  "why",
  "how",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "also",
  "now",
  "here",
  "there",
  "then",
  "once",
  "if",
  "because",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "under",
  "again",
  "further",
  "any",
  "really",
  "like",
  "just",
  "get",
  "got",
  "going",
  "want",
  "need",
  "make",
  "made",
  "even",
  "still",
  "back",
  "much",
  "well",
  "way",
]);

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

Definitions (use these exactly):
- Signal = the thread that is most true, consequential, and clarifying right now.
- Noise = attention-consuming material that does not currently increase truth, direction, or meaningful movement.

Return STRICT JSON matching this shape exactly:
{
  "themes": [{ "title": string, "summary": string }],  // 2 to 4 themes
  "coreIntent": string,  // one sentence: what they actually want beneath the surface
  "matters": [string, ...],       // 2–4 short phrases (3–8 words each) of what seems to carry consequence right now
  "noise": [string, ...],         // 1–3 short phrases of what may be loud but not currently clarifying
  "signalReason": string,         // one sentence naming WHY the elevated thread may carry consequence — provisional, not declarative
  "nextStep": string,             // ONE concrete action they can take today or this week. Specific, small, doable.
  "reflection": string,           // one short sentence that names what they may not be seeing
  "stepScope": {
    "durationEstimate": string,   // short, starts with ~ e.g. "~15 min"
    "stoppingCondition": string   // one phrase — the moment this move is complete (not a success metric)
  }
}

Rules:
- Themes: 2–4 only. Title is 2–5 words. Summary is one sentence, 15–25 words.
- coreIntent: one sentence. Start with a verb or "You want…". Do not restate their words; distill them.
- matters: 2–4 short phrases. 3–8 words each. Drawn from the user's own language where possible. Each phrase should name a distinct thread that seems to carry consequence (an obligation, a fear, a deeper truth, a decision that won't wait). Do not number them. No trailing punctuation.
- noise: 1–3 short phrases. 3–8 words each. Things that are loud or attention-consuming but not currently clarifying — catastrophizing, comparison, looping self-judgment, avoidance moves. Honest, not dismissive. No trailing punctuation.
- signalReason: One sentence. Name the strongest matters phrase, then say WHY it may carry consequence (what it touches, what depends on it, what it makes possible). Provisional language: "may", "seems to", "could". Not declarative. Under 30 words.
- nextStep: Must be an action, not advice. Starts with a verb. Concrete, scoped, achievable. Not "reflect more" or "think about." Something they do.
- reflection: A quiet observation. Honest. Not flattering. Under 20 words.
- stepScope.durationEstimate: Time envelope only — "~10 min", "~20 min", "~30 min", etc. Never a range.
- stepScope.stoppingCondition: One concrete completion cue — what would make it obvious this move is done (not outcome hype).
- If the input is very short or unclear, still produce a best-effort pass — do not ask questions back. matters/noise can be tentative but must still be present.
- Output JSON only. No prose before or after.`;

// --- Operator analysis (Phase 3) ---
//
// OPERATOR fires only when routeThread() classifies the input as Operator
// mode. The model picks ONE of four artifact types and returns a strict JSON
// payload that conforms to operatorArtifactSchema. This prompt is isolated:
// the Personal-mode SYSTEM_PROMPT path is unchanged, and runOperatorAnalysis
// is not yet wired into POST /api/sift.
const OPERATOR_SYSTEM_PROMPT = `You are Sift in Operator Mode.

Operator Mode serves people inside active responsibility — founders, builders, decision-makers, parents managing live load. They came with something real: a project, a decision, a person, a structural pressure. Your job is to sift it down to a clean, actionable read so they can move.

You write like a calm internal operator, a chief of staff, a disciplined advisor. Not a therapist. Not a coach. Not a hype man. No exclamation points. No emojis. No corporate language. No "great question," "let's dive in," or generic encouragement.

VOICE RULES (Operator-specific, non-negotiable):
- Situation-led, not "you"-led. Open with the pattern, the bottleneck, the missing decision, or the load-bearing dynamic. "You" appears only when it adds clarity without sounding accusatory.
  Good: "What this keeps running into is a load-bearing decision that has not been made yet."
  Good: "The pressure here is coming from unresolved sequencing, not lack of effort."
  Avoid: "You need to," "You have to," "You should just."
- Short sentences (8–25 words, 1–2 clauses). Plain, physical, concrete language. No therapy metaphors ("shadow work," "parts," "inner child"). No productivity metaphors ("unlock," "optimize," "10x," "rocket fuel").
- Direct, not tentative. Use "perhaps" sparingly. Sift is willing to name the actual constraint.
- "Shape" is permitted as a brand word. "Throughput," "front burner," "current move," "load-bearing" are permitted. "Crushing it," "leveling up," "deep work" are not.

${SAFETY_CLAUSE}

ARTIFACT SELECTION (priority order — pick the FIRST match):
1. stakeholder_brief — A specific named person is the load-bearing factor. Friction with a cofounder, client, investor, partner, board member, or team member is what's actually shaping the situation. The decision and the work are downstream of how this relationship resolves.
2. decision_memo — The thread centers on a forced choice between named options. The user is circling, the cost of indecision is rising, and there are at least two real paths in play.
3. project_brief — A bounded named deliverable or outcome ("ship the pricing page," "launch the cohort," "redo onboarding") needs compression. Strategy, execution, and emotion are mixed together.
4. operator_card — Default. Use when the situation is still forming, the user needs a quick sort, or none of the above apply cleanly. NEVER force a higher-tier artifact when the input does not actually carry it.

EVERY ARTIFACT INCLUDES THIS ENVELOPE (non-negotiable fields):
- artifactType: one of "operator_card" | "decision_memo" | "project_brief" | "stakeholder_brief"
- coreIntent: one sentence. What they actually want beneath the surface. Start with a verb.
- whatImHearing: one sentence. The Operator-level mirror — name the pattern or load-bearing dynamic. No advice.
- whatMattersNow: 2–4 short phrases (3–8 words each). The central factors right now. Drawn from the user's language where possible. No trailing punctuation.
- whatMayBeNoise: 0–3 short phrases (3–8 words each). What sounds urgent but isn't central, or what feels heavy but isn't blocking. Empty array allowed when nothing is actually loud.
- currentMove: ONE sentence. The single most important action right now, OR the sequencing move that unblocks the rest. Must be doable in 5–30 minutes. Starts with a verb. No "try." No "think about." Never empty.
- frontBurnerRelevance: { score: 0–5, reason: one sentence }. Score = how many of these are TRUE: (1) materially affects outcomes in ≤2 weeks, (2) user can take a meaningful next move now, (3) delay increases cost or drift, (4) NOT waiting on external person/event, (5) NOT speculative. This is a recommendation. Sift never auto-promotes anything.
- reEntry: { title: ≤80 chars short label for re-entry surface; state: "live" | "paused" | "waiting"; lastMove: one sentence summarizing where this leaves off }. "live" = ready to move. "paused" = user has the read but is sitting with it. "waiting" = blocked on someone or something external.

VARIANT FIELDS (in addition to the envelope):

operator_card — no extra fields. Use when no specialized shape is warranted.

decision_memo:
  - decisionQuestion: one sentence stating the choice in plain terms.
  - options: 2–4 entries, each { label: short name, summary: one sentence on what it means and trades off }.
  - whyHard: one sentence on what's actually making this hard to resolve.
  - whatToRevisit: one sentence on what condition or information would reopen this.

project_brief:
  - objective: one sentence on what "done" looks like.
  - currentReality: one sentence on where things actually are right now, including what's going sideways.
  - risks: 1–3 short phrases. The actual risks to the goal.
  - notTheProblem: one sentence on what the user keeps circling that isn't actually blocking progress.
  - dependencies: 0–3 short phrases. External blockers or waiting items. Empty array when none.

stakeholder_brief:
  - personName: the specific person — first name or role label, never a fabricated name.
  - relationshipContext: one sentence on the relationship (cofounder, client, partner, etc.).
  - dynamicShape: one sentence on the real tension or alignment underneath the surface behavior.
  - userPosition: one sentence on what the user actually wants from this.
  - theirPosition: one sentence on what the other person appears to want or be optimizing for.
  - directThing: one sentence. The thing that, if said plainly to that person, would most change the dynamic.

OUTPUT JSON SHAPES (exact keys, exact discriminator):

operator_card:
{
  "artifactType": "operator_card",
  "coreIntent": "...",
  "whatImHearing": "...",
  "whatMattersNow": ["...", "..."],
  "whatMayBeNoise": ["..."],
  "currentMove": "...",
  "frontBurnerRelevance": { "score": 3, "reason": "..." },
  "reEntry": { "title": "...", "state": "live", "lastMove": "..." }
}

decision_memo:
{
  "artifactType": "decision_memo",
  "coreIntent": "...",
  "whatImHearing": "...",
  "whatMattersNow": ["...", "..."],
  "whatMayBeNoise": ["..."],
  "currentMove": "...",
  "frontBurnerRelevance": { "score": 4, "reason": "..." },
  "reEntry": { "title": "...", "state": "live", "lastMove": "..." },
  "decisionQuestion": "...",
  "options": [
    { "label": "...", "summary": "..." },
    { "label": "...", "summary": "..." }
  ],
  "whyHard": "...",
  "whatToRevisit": "..."
}

project_brief:
{
  "artifactType": "project_brief",
  "coreIntent": "...",
  "whatImHearing": "...",
  "whatMattersNow": ["...", "..."],
  "whatMayBeNoise": ["..."],
  "currentMove": "...",
  "frontBurnerRelevance": { "score": 4, "reason": "..." },
  "reEntry": { "title": "...", "state": "live", "lastMove": "..." },
  "objective": "...",
  "currentReality": "...",
  "risks": ["...", "..."],
  "notTheProblem": "...",
  "dependencies": ["..."]
}

stakeholder_brief:
{
  "artifactType": "stakeholder_brief",
  "coreIntent": "...",
  "whatImHearing": "...",
  "whatMattersNow": ["...", "..."],
  "whatMayBeNoise": ["..."],
  "currentMove": "...",
  "frontBurnerRelevance": { "score": 3, "reason": "..." },
  "reEntry": { "title": "...", "state": "waiting", "lastMove": "..." },
  "personName": "...",
  "relationshipContext": "...",
  "dynamicShape": "...",
  "userPosition": "...",
  "theirPosition": "...",
  "directThing": "..."
}

Output JSON only. No prose before or after. No markdown fences.`;

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

DO NOT emit matters[] or noise[] arrays in deepening replies. The signal / noise work is now a dedicated practice moment the user does by hand between turns. Your only job in this reply is mirror / question / mini.

POST-SORT BRANCH — when the most recent turn is a user sort_result with at least one item under matters[], your reply MUST do all three of the following inside the small mirror/question/mini fields, in this order:
  1. NAME the elevated signal. Reference what they chose to treat as mattering, using their exact phrase or a near-verbatim distillation. This goes in mirror.
  2. SAY — in ONE provisional sentence — why this may carry consequence right now. Use "may", "seems", "right now". This can extend the mirror (still under 25 words combined) or sit in mini (under 30 words). Do NOT moralize, do NOT diagnose. Example shape: "That seems to carry consequence because it returns even when the louder things quiet down."
  3. ASK exactly ONE concrete, forward-leaning next-step question that takes the elevated signal seriously. Place this in question. Examples of the right shape: "What would move this one inch forward this week?" "What is the smallest honest thing you could do about this in the next day?" Never generic, never therapeutic, never "how does that make you feel".
Quiet (do not name) what they sorted as noise. If they marked items as unsure, you may briefly acknowledge them as still unresolved — but do not push them to decide. Unsure is part of discernment.
If the sort_result was skipped or has no matters[], skip the post-sort branch and respond as a normal deepening turn.

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
- The cards are not random fragments. Aim to surface DISTINCT mental threads. From the thread, look for and (when present) include examples of:
    1. a real obligation or commitment they have named
    2. a self-judgment they have made about themselves
    3. an avoidance loop — a thing they keep returning to but not engaging
    4. a fear statement — something they have explicitly worried about
    5. a quieter, deeper truth they have stated almost in passing
    6. an emotionally charged thought that is loud but not currently directional
You do not need one of each — only include kinds that are honestly present. Two cards from the same kind is fine if both are genuinely distinct concerns. Never duplicate the same thread under two phrasings.
- Mix the loud, surface-level concerns with the quiet, deeper threads. A good set holds some items that may obviously matter alongside some that feel loud but may actually be noise. Do not stack the deck toward one side. The user must do the discerning.
- Each phrase is 2 to 7 words. Short. Concrete. No quotation marks. No periods at the end. Each one should feel worth pausing on — not throwaway.
- Do not label anything as matters or noise yourself. Do not hint at the answer. The user does the sorting.
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
  "nextStep": string,        // ONE clear, specific, realistic action — often smaller or more precise than before
  "changeReason": string     // one or two sentences — why this next step is different from before (provisional)
}

Rules:
- "hearing": 2–4 sentences. Observe the pattern. Don't just summarize.
- "matters": 2 or 3 bullets. Each is a short, grounded sentence.
- "noise": 1 or 2 bullets. What to let go of or stop tracking.
- "nextStep": ONE action. Starts with a verb. Adjusted based on the outcome — not a restatement.
- "changeReason": Name what shifted in the situation — not praise, not blame. Optional only if nothing meaningfully changed (rare).
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

function buildPreSortContext(
  fragmentSort: { fragment: string; bucket: string }[] | undefined,
  skippedFragmentSort: boolean | undefined,
): string {
  if (skippedFragmentSort) {
    return "The user skipped the quick fragment sort and asked for the full read.";
  }
  if (!fragmentSort?.length) return "";
  const lines = fragmentSort.map(
    (s) => `• "${s.fragment}" — marked: ${s.bucket}`,
  );
  return `Before the full sift, the user did a quick pass on phrases from their text. This is provisional — not a command:\n${lines.join("\n")}`;
}

const META_SIFT_SYSTEM_SUFFIX = `

This is a meta-sift: the user is sifting a recurring pattern, not a single event. The goal is to identify the root dynamic beneath the pattern, not to restate the pattern. The next step should address the underlying structure, not any specific instance. Avoid restating the theme back to the user — compress toward the root cause and one structural move.`;

async function runAnalysis(
  input: string,
  opts?: { preSortContext?: string; metaSift?: boolean },
): Promise<Analysis> {
  const extra = opts?.preSortContext
    ? `\n\n${opts.preSortContext}\n`
    : "";
  const system =
    opts?.metaSift === true
      ? `${SYSTEM_PROMPT}${META_SIFT_SYSTEM_SUFFIX}`
      : SYSTEM_PROMPT;
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [
      {
        role: "user",
        content: `Here is what I'm holding right now:\n\n${input}${extra}\nSift it. Return JSON only.`,
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
  const analysis = analysisSchema.parse(parsed);
  if (!analysis.stepScope) {
    return {
      ...analysis,
      stepScope: {
        durationEstimate: "~20 min",
        stoppingCondition:
          "when you can name one concrete piece of this move that is finished",
      },
    };
  }
  return analysis;
}

// runOperatorAnalysis — Phase 3 helper. Mirrors runAnalysis but uses the
// Operator system prompt and validates against the operatorArtifactSchema
// discriminated union. Returns one of four artifact shapes. This helper is
// intentionally NOT wired into any route yet; it exists so we can validate
// prompt + parsing in isolation before touching the request path.
//
// Failure modes are explicit: model returns non-JSON → throws "Model did not
// return JSON". Model returns JSON that doesn't match the discriminated
// union → throws a Zod validation error. Callers decide whether to fall back
// to runAnalysis() or surface the failure. Nothing is persisted to the DB
// from inside this function.
async function runOperatorAnalysis(input: string): Promise<OperatorArtifact> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: OPERATOR_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is what I'm holding right now:\n\n${input}\n\nRoute it as Operator. Pick the right artifact type and return JSON only.`,
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
  return operatorArtifactSchema.parse(parsed);
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
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) return JSON.parse(arrMatch[0]);
    throw new Error("Model did not return JSON");
  }
}

const BREAKDOWN_SYSTEM_PROMPT = `You are helping someone take the first movement toward a step that feels too big. 
Your only job is to break the following next step into exactly 3 micro-tasks. 

Rules:
- Each micro-task must take 2 minutes or less
- Each must be so small it is almost laughable — the bar should be embarrassingly low
- Each must be physically doable right now, not mentally preparatory
- Do not reframe, reinterpret, or improve the original step
- Do not add encouragement, explanation, or context
- Output only a raw JSON array of exactly 3 strings, nothing else

Example output format:
["Open the document", "Read the first sentence only", "Write one word"]

Next step: [INSERT NEXT STEP HERE]`;

async function runBreakdownMicroTasks(nextStep: string): Promise<string[]> {
  const system = BREAKDOWN_SYSTEM_PROMPT.replace(
    "[INSERT NEXT STEP HERE]",
    nextStep,
  );
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system,
    messages: [
      {
        role: "user",
        content: "Return JSON only.",
      },
    ],
  });
  const textBlock = msg.content.find((b: any) => b.type === "text") as any;
  const raw = (textBlock?.text ?? "").trim();
  const parsed = extractJson(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Model did not return a JSON array");
  }
  const tasks = parsed
    .filter((x: unknown): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
  if (tasks.length !== 3) {
    throw new Error("Breakdown must be exactly 3 micro-tasks");
  }
  return tasks;
}

const STEP_REVISION_SYSTEM_PROMPT = `You are revising one proposed next step. The user has read the current step and asked for a revised version. The revision must still pass Sift's tests for "one next step":
- Doable in 5–30 minutes
- Has a clear stopping condition
- Concrete, physical, not preparatory
- No "try" — must have a real completion moment
- Same governing signal as the original step; do not pivot the underlying read

Two variants:

"smaller" — narrow the step further. Same shape, smaller scope. The stopping condition should be reachable in 5–15 minutes. Strip ambition, keep movement.

"different" — a different shape of move on the same signal. Same underlying tension, different angle of action (e.g. a conversation instead of writing, a constraint instead of a draft, a question instead of an answer).

Output STRICT JSON:
{
  "nextStep": string,
  "stepScope": { "durationEstimate": string, "stoppingCondition": string }
}

Rules:
- nextStep: one sentence, 10–35 words, no preamble, no "try", no "consider".
- durationEstimate: short phrase, e.g. "~15 min", "10 min", "20 min".
- stoppingCondition: one short clause naming the visible moment the step is done.
- Do not explain the change. Just return the revised JSON.
- Do not return the original next step verbatim — the user has asked for something different.

${SAFETY_CLAUSE}

Output JSON only.`;

async function runStepRevision(args: {
  input: string;
  coreIntent: string;
  currentStep: string;
  variant: "smaller" | "different";
}): Promise<{ nextStep: string; stepScope: StepScope }> {
  const userMsg = `Original input:\n${args.input}\n\nWhat this is pointing to:\n${args.coreIntent}\n\nCurrent proposed next step:\n${args.currentStep}\n\nVariant requested: ${args.variant}\n\nReturn JSON only.`;
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: STEP_REVISION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
  });
  const textBlock = msg.content.find((b: any) => b.type === "text") as any;
  const raw = (textBlock?.text ?? "").trim();
  const parsed = extractJson(raw);
  const validated = siftStepRevisionResponseSchema.parse(parsed);
  return validated;
}

const FRAGMENTS_SYSTEM_PROMPT = `You pull 4–6 short fragments from the user's text for a quick sort they will do by hand before the full sift.

Return STRICT JSON:
{ "fragments": [ string ] }

Rules:
- Exactly 4 to 6 fragments.
- Each fragment: 3–10 words, from their wording or a tight paraphrase — not generic slogans.
- Distinct threads. No duplicates.
- Do not label matters vs noise.

${SAFETY_CLAUSE}

Output JSON only.`;

async function runSiftFragments(input: string): Promise<string[]> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: FRAGMENTS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Their text:\n\n${input}\n\nReturn JSON only.`,
      },
    ],
  });
  const textBlock = msg.content.find((b: any) => b.type === "text") as any;
  const raw = (textBlock?.text ?? "").trim();
  const parsed = extractJson(raw);
  const fr = parsed?.fragments;
  if (!Array.isArray(fr)) throw new Error("Model did not return fragments");
  const cleaned = fr
    .filter((x: unknown) => typeof x === "string")
    .map((s: string) => s.trim())
    .filter(Boolean);
  return siftFragmentsResponseSchema.parse({ fragments: cleaned }).fragments;
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
): Promise<CheckinModelOutput> {
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
  return checkinModelOutputSchema.parse(parsed);
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

function siftRowToRevisionSnapshot(row: Sift): SiftRevisionSnapshot {
  let themes: Theme[] = [];
  try {
    const t = JSON.parse(row.themes);
    themes = Array.isArray(t) ? t : [];
  } catch {
    themes = [];
  }
  let matters: string[] = [];
  let noise: string[] = [];
  try {
    if (row.matters) {
      const m = JSON.parse(row.matters);
      if (Array.isArray(m)) matters = m.filter((x) => typeof x === "string");
    }
    if (row.noise) {
      const n = JSON.parse(row.noise);
      if (Array.isArray(n)) noise = n.filter((x) => typeof x === "string");
    }
  } catch {
    /* ignore */
  }
  let stepScope: StepScope | null = null;
  if (row.stepScope) {
    try {
      const s = JSON.parse(row.stepScope);
      if (
        s &&
        typeof s.durationEstimate === "string" &&
        typeof s.stoppingCondition === "string"
      ) {
        stepScope = s as StepScope;
      }
    } catch {
      /* null */
    }
  }
  return {
    at: Date.now(),
    coreIntent: row.coreIntent,
    nextStep: row.nextStep,
    reflection: row.reflection,
    themes,
    matters,
    noise,
    signalReason: row.signalReason ?? null,
    stepScope,
  };
}

function parseStepScopeColumn(raw: string | null): StepScope | undefined {
  if (!raw) return undefined;
  try {
    const s = JSON.parse(raw);
    if (
      s &&
      typeof s.durationEstimate === "string" &&
      typeof s.stoppingCondition === "string"
    ) {
      return s as StepScope;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Cached breakdown JSON — exactly 3 strings or null */
function parseMicroTasksColumn(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return null;
    const tasks = v
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
    return tasks.length === 3 ? tasks : null;
  } catch {
    return null;
  }
}

function parseRevisionHistoryColumn(
  raw: string | null,
): SiftRevisionSnapshot[] | undefined {
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

// --- Training layer (sort alignment, recurring signal, redundancy, closure prompt) ---

function tokenizeForOverlap(text: string): Set<string> {
  const words = text.toLowerCase().split(/\W+/).filter(Boolean);
  const set = new Set<string>();
  for (const w of words) {
    if (w.length <= 2 || STOP_WORDS.has(w)) continue;
    set.add(w);
  }
  return set;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  a.forEach((x) => {
    if (b.has(x)) inter++;
  });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

type RedundancyLevel =
  | { level: "none" }
  | { level: "low"; priorSiftId: string; priorNextStep: string }
  | { level: "high"; priorSiftId: string; priorNextStep: string };

async function checkRedundancy(
  userId: number | null,
  newInput: string,
): Promise<RedundancyLevel> {
  if (!userId) return { level: "none" };
  const recent = await storage.getRecentSifts(userId, 10);
  if (!recent.length) return { level: "none" };
  const newTok = tokenizeForOverlap(newInput);
  let best: { id: string; nextStep: string; sim: number } | null = null;
  for (const row of recent) {
    const sim = jaccardSimilarity(newTok, tokenizeForOverlap(row.input));
    if (!best || sim > best.sim) {
      best = { id: row.id, nextStep: row.nextStep, sim };
    }
  }
  if (!best || best.sim <= REDUNDANCY_LOW_THRESHOLD) return { level: "none" };
  if (best.sim > REDUNDANCY_HIGH_THRESHOLD) {
    return {
      level: "high",
      priorSiftId: best.id,
      priorNextStep: best.nextStep,
    };
  }
  return {
    level: "low",
    priorSiftId: best.id,
    priorNextStep: best.nextStep,
  };
}

function normalizeMatchFragment(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function fragmentTextInList(fragment: string, list: string[]): boolean {
  const f = normalizeMatchFragment(fragment);
  if (!f) return false;
  for (const item of list) {
    const m = normalizeMatchFragment(item);
    if (!m) continue;
    if (m.includes(f) || f.includes(m)) return true;
  }
  return false;
}

function computeSortAlignmentScore(
  fragmentSort:
    | { fragment: string; bucket: "matters" | "noise" | "unsure" }[]
    | undefined,
  matters: string[],
  noise: string[],
): number | null {
  if (!fragmentSort?.length) return null;
  let classified = 0;
  let matches = 0;
  for (const row of fragmentSort) {
    if (row.bucket === "unsure") continue;
    classified++;
    const ok =
      row.bucket === "matters"
        ? fragmentTextInList(row.fragment, matters)
        : fragmentTextInList(row.fragment, noise);
    if (ok) matches++;
  }
  if (classified === 0) return null;
  return matches / classified;
}

function meaningfulTokensFromStrings(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    for (const w of line.toLowerCase().split(/\W+/)) {
      if (w.length > 2 && !STOP_WORDS.has(w)) out.push(w);
    }
  }
  return out;
}

async function detectRecurringSignal(
  userId: number | null,
  newMatters: string[],
  currentSiftId: string,
): Promise<{ detected: boolean; theme: string | null }> {
  if (!userId || newMatters.length === 0) {
    return { detected: false, theme: null };
  }
  const recent = await storage.getRecentSifts(userId, 5, currentSiftId);
  if (recent.length < 2) return { detected: false, theme: null };

  const newTokenList = meaningfulTokensFromStrings(newMatters);
  const newUnique = Array.from(new Set(newTokenList));

  const matchingIntersections: string[][] = [];

  for (const sift of recent) {
    let priorMatters: string[] = [];
    try {
      if (sift.matters) {
        const p = JSON.parse(sift.matters);
        if (Array.isArray(p)) {
          priorMatters = p.filter((x): x is string => typeof x === "string");
        }
      }
    } catch {
      priorMatters = [];
    }
    const priorSet = new Set(meaningfulTokensFromStrings(priorMatters));
    const inter = newUnique.filter((t) => priorSet.has(t));
    if (inter.length >= 2) {
      matchingIntersections.push(inter);
    }
  }

  if (matchingIntersections.length < 2) {
    return { detected: false, theme: null };
  }

  const theme =
    matchingIntersections[0].length >= 2
      ? `${matchingIntersections[0][0]} ${matchingIntersections[0][1]}`
      : matchingIntersections[0][0];
  return { detected: true, theme };
}

async function shouldShowClosurePrompt(
  userId: number | null,
  sift: Sift,
): Promise<boolean> {
  if (!userId) return false;
  if (sift.closurePromptShown === 1) return false;
  const p = await storage.getOrCreateDiscernmentProfile(userId);
  const avg = p.avgSortAlignment;
  if (avg == null || avg < MASTERY_SORT_ALIGNMENT_MIN) return false;
  if (p.recurringSignalCount < MASTERY_RECURRING_SIGNAL_MIN) return false;
  if (p.masteryCount < MASTERY_COUNT_MIN) return false;
  return true;
}

// --- Smart re-entry (one quiet prompt for returning users) ---

const REENTRY_48H_MS = 48 * 60 * 60 * 1000;
const REENTRY_24H_MS = 24 * 60 * 60 * 1000;
const REENTRY_7D_MS = 7 * 24 * 60 * 60 * 1000;
const REENTRY_COMPARE_WINDOW_MS = 24 * 60 * 60 * 1000;

function threadTitleFromSiftCore(s: Sift): string {
  const t = s.coreIntent?.trim() || "This thread";
  return t.length > 72 ? `${t.slice(0, 69)}…` : t;
}

function parseJsonStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function monthKeyFromTs(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthNameFromKey(key: string): string {
  const [ys, ms] = key.split("-");
  const y = Number(ys);
  const m = Number(ms);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long" });
}

/** Fuzzy alignment for garden connections — mirrors recurring token overlap. */
function gardenSeedThemesMatch(a: Sift, b: Sift): boolean {
  const ma = parseJsonStringArray(a.matters);
  const mb = parseJsonStringArray(b.matters);
  const rtA = a.recurringTheme?.trim() || null;
  const rtB = b.recurringTheme?.trim() || null;
  if (rtA && rtB) {
    const ta = meaningfulTokensFromStrings([rtA]);
    const tb = meaningfulTokensFromStrings([rtB]);
    let n = 0;
    for (const t of ta) if (tb.includes(t)) n++;
    if (n >= 2) return true;
  }
  const newTok = meaningfulTokensFromStrings(ma);
  const priorSet = new Set(meaningfulTokensFromStrings(mb));
  return newTok.filter((t) => priorSet.has(t)).length >= 2;
}

function isMetaSiftRow(r: Sift): boolean {
  return r.metaSift === 1;
}

/**
 * Connected components where each edge is gardenSeedThemesMatch — same geometry
 * as `connections` on the payload. Production rows often lack recurring_theme;
 * matters overlap still links threads like local seed data with themes set.
 * Meta/pattern sifts are omitted so they cannot bridge unrelated threads.
 */
function gardenRecurringClusters(sorted: Sift[]): Sift[][] {
  const active = sorted.filter((r) => !isMetaSiftRow(r));
  const m = active.length;
  const parent = Array.from({ length: m }, (_, i) => i);
  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  };
  const union = (i: number, j: number) => {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[rj] = ri;
  };
  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) {
      if (gardenSeedThemesMatch(active[i], active[j])) union(i, j);
    }
  }
  const byRoot = new Map<number, number[]>();
  for (let k = 0; k < m; k++) {
    const r = find(k);
    const arr = byRoot.get(r) ?? [];
    arr.push(k);
    byRoot.set(r, arr);
  }
  return Array.from(byRoot.values())
    .filter((idxs) => idxs.length >= 2)
    .map((idxs) => idxs.map((k) => active[k]));
}

function gardenClusterTheme(rows: Sift[]): string {
  const rt = rows
    .map((r) => r.recurringTheme?.trim())
    .filter((x): x is string => !!x);
  if (rt.length > 0) {
    const counts = new Map<string, number>();
    for (const t of rt) counts.set(t, (counts.get(t) ?? 0) + 1);
    let best = rt[0]!;
    let bestN = -1;
    for (const [t, c] of Array.from(counts.entries())) {
      if (c > bestN) {
        best = t;
        bestN = c;
      }
    }
    return best;
  }
  const matterLines = rows.flatMap((r) => parseJsonStringArray(r.matters));
  const tok = meaningfulTokensFromStrings(matterLines);
  const freq = new Map<string, number>();
  for (const t of tok) freq.set(t, (freq.get(t) ?? 0) + 1);
  const top = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w);
  const w0 = top[0];
  const w1 = top[1];
  if (top.length >= 2 && w0 !== undefined && w1 !== undefined) {
    return `${w0} ${w1}`;
  }
  if (w0 !== undefined) return w0;
  return threadTitleFromSiftCore(rows[0]);
}

async function buildGardenPayload(userId: number) {
  const rows = await storage.listUserSiftsFull(userId);
  const sorted = [...rows].sort((a, b) => b.createdAt - a.createdAt);

  const totalThreads = sorted.length;
  const closedThreads = sorted.filter(
    (r) => r.threadState === "closed" || r.status === "closed",
  ).length;
  const openThreads = Math.max(0, totalThreads - closedThreads);

  const themeCounts = new Map<string, { count: number; display: string }>();
  for (const r of sorted) {
    const t = r.recurringTheme?.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    const cur = themeCounts.get(k) ?? { count: 0, display: t };
    cur.count++;
    themeCounts.set(k, cur);
  }
  let coreSignal: string | null = null;
  let bestN = 0;
  for (const v of Array.from(themeCounts.values())) {
    if (v.count > bestN) {
      bestN = v.count;
      coreSignal = v.display;
    }
  }
  if (!coreSignal) {
    coreSignal = "what keeps pulling your attention";
  }

  const proseDefault = `This month, you've been carrying ${coreSignal}.\n${closedThreads} things found their ground.\n${openThreads} are still breathing.`;

  const recurringSignals = gardenRecurringClusters(sorted)
    .map((groupRows) => ({
      theme: gardenClusterTheme(groupRows),
      frequency: groupRows.length,
      threadIds: groupRows.map((x) => x.id),
      threadTitles: groupRows.map((x) => threadTitleFromSiftCore(x)),
    }))
    .sort((a, b) => b.frequency - a.frequency);

  const noisePhraseCounts = new Map<string, { label: string; n: number }>();
  for (const r of sorted) {
    for (const n of parseJsonStringArray(r.noise)) {
      const label = n.trim();
      if (!label) continue;
      const k = label.toLowerCase().slice(0, 120);
      const cur = noisePhraseCounts.get(k) ?? { label, n: 0 };
      cur.n++;
      noisePhraseCounts.set(k, cur);
    }
  }
  const clusterMap: {
    label: string;
    count: number;
    type: "signal" | "noise";
  }[] = [];
  for (const rs of recurringSignals.slice(0, 5)) {
    clusterMap.push({ label: rs.theme, count: rs.frequency, type: "signal" });
  }
  for (const [, v] of Array.from(noisePhraseCounts.entries())
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 3)) {
    clusterMap.push({ label: v.label, count: v.n, type: "noise" });
  }

  const closedRows = sorted.filter(
    (r) => r.threadState === "closed" || r.status === "closed",
  );
  const closedLoops = await Promise.all(
    closedRows.map(async (r) => {
      const cis = await storage.listCheckins(r.id);
      const sortedCi = [...cis].sort((a, b) => a.createdAt - b.createdAt);
      const lastNote = sortedCi.length
        ? sortedCi[sortedCi.length - 1].note?.trim() || null
        : null;
      const lastTouch = sortedCi.length
        ? Math.max(r.createdAt, ...sortedCi.map((c) => c.createdAt))
        : r.createdAt;
      return {
        id: r.id,
        title: threadTitleFromSiftCore(r),
        closedAt: new Date(lastTouch).toISOString(),
        checkinCount: cis.length,
        finalLesson: lastNote,
      };
    }),
  );

  const closedNotes = await Promise.all(
    sorted.map(async (r) => {
      const closed = r.threadState === "closed" || r.status === "closed";
      if (!closed) return null;
      const cis = await storage.listCheckins(r.id);
      if (!cis.length) return null;
      const sortedCi = [...cis].sort((a, b) => a.createdAt - b.createdAt);
      const last = sortedCi[sortedCi.length - 1];
      const n = last.note?.trim();
      return n || null;
    }),
  );

  const seeds = sorted.map((r, idx) => {
    const mk = monthKeyFromTs(r.createdAt);
    const matters = parseJsonStringArray(r.matters);
    const closed = r.threadState === "closed" || r.status === "closed";
    const proseText = closed
      ? "This one found its ground."
      : "This thread is still asking something.";
    const proseSub = closed
      ? (closedNotes[idx] ?? "Closed.")
      : "Something is waiting here.";
    return {
      id: r.id,
      title: threadTitleFromSiftCore(r),
      closed,
      month: mk,
      signal: r.recurringTheme?.trim() ?? null,
      matters: matters[0] ?? null,
      nextStep: r.nextStep,
      proseText,
      proseSub,
    };
  });

  const connections: number[][] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (gardenSeedThemesMatch(sorted[i], sorted[j])) {
        connections.push([i, j]);
      }
    }
  }

  const monthKeys = Array.from(
    new Set(sorted.map((r) => monthKeyFromTs(r.createdAt))),
  ).sort();
  const months = monthKeys.map((key) => {
    const inMonth = sorted.filter((r) => monthKeyFromTs(r.createdAt) === key);
    const count = inMonth.length;
    const closedCount = inMonth.filter(
      (r) => r.threadState === "closed" || r.status === "closed",
    ).length;
    const openCount = count - closedCount;
    let summary = "";
    if (closedCount > openCount) {
      summary = `${monthNameFromKey(key)} leaned toward what could be closed.`;
    } else if (openCount > closedCount) {
      summary = `${monthNameFromKey(key)} added more threads than it closed.`;
    } else {
      summary = `${monthNameFromKey(key)} held both motion and closure.`;
    }
    return {
      key,
      label: monthNameFromKey(key),
      count,
      closedCount,
      summary,
    };
  });

  const byMonth: Record<string, string> = {};
  for (const m of months) {
    const openCount = m.count - m.closedCount;
    if (m.closedCount > openCount) {
      byMonth[m.key] =
        `${m.label} began to settle. ${m.closedCount} loops closed. Something shifted.`;
    } else if (openCount > m.closedCount) {
      byMonth[m.key] =
        `${m.label} was loud — ${openCount} new threads, ${m.closedCount} closed.\nThe pattern started here.`;
    } else {
      byMonth[m.key] =
        `${m.label} held both new threads and closures in balance.`;
    }
  }

  return {
    prose: { default: proseDefault, byMonth },
    stats: {
      totalThreads,
      closedThreads,
      coreSignal,
    },
    recurringSignals,
    clusterMap,
    closedLoops,
    seeds,
    connections,
    months,
  };
}

function siftIsOpenForReentry(row: Sift): boolean {
  if ((row.status ?? "open") === "closed") return false;
  const ts = row.threadState ?? "open";
  return ts !== "closed" && ts !== "archived";
}

function siftIsClosedForCompare(row: Sift): boolean {
  return (
    row.status === "closed" ||
    row.threadState === "closed"
  );
}

async function computeReEntryPrompt(userId: number): Promise<ReEntryResponse> {
  const rows = await storage.listUserSiftsFull(userId);
  const openThreads = rows.filter(siftIsOpenForReentry);

  if (openThreads.length === 0) {
    return { prompt: null };
  }

  // 1 — overdue check-in (48h since last check-in)
  let bestOverdue: { s: Sift; lastCi: number } | null = null;
  for (const s of openThreads) {
    const cis = await storage.listCheckins(s.id);
    if (cis.length === 0) continue;
    const lastCi = Math.max(...cis.map((c) => c.createdAt));
    if (Date.now() - lastCi <= REENTRY_48H_MS) continue;
    if (!bestOverdue || lastCi < bestOverdue.lastCi) {
      bestOverdue = { s, lastCi };
    }
  }
  if (bestOverdue) {
    return {
      prompt: "You left something in motion. Want to see where it landed?",
      action: {
        type: "checkin",
        threadId: bestOverdue.s.id,
        threadTitle: threadTitleFromSiftCore(bestOverdue.s),
      },
    };
  }

  // 2 — next step never acted on (no check-ins, sift older than 24h)
  let staleNoCheckin: Sift | null = null;
  for (const s of openThreads) {
    const cis = await storage.listCheckins(s.id);
    if (cis.length > 0) continue;
    if (Date.now() - s.createdAt <= REENTRY_24H_MS) continue;
    if (
      !staleNoCheckin ||
      s.createdAt < staleNoCheckin.createdAt
    ) {
      staleNoCheckin = s;
    }
  }
  if (staleNoCheckin) {
    return {
      prompt: "You had a next move. Still on the table?",
      action: {
        type: "checkin",
        threadId: staleNoCheckin.id,
        threadTitle: threadTitleFromSiftCore(staleNoCheckin),
      },
    };
  }

  // 3 — low redundancy sift pointing at a closed prior (within ~24h)
  const sinceCompare = Date.now() - REENTRY_COMPARE_WINDOW_MS;
  for (const cur of rows) {
    if (!cur.redundancyPriorSiftId) continue;
    if (cur.createdAt < sinceCompare) continue;
    if (!siftIsOpenForReentry(cur)) continue;
    const prior = await storage.getSift(cur.redundancyPriorSiftId);
    if (!prior || prior.userId !== userId) continue;
    if (!siftIsClosedForCompare(prior)) continue;
    return {
      prompt:
        "Something came up that sounds familiar. Want to compare it to what you already sorted?",
      action: {
        type: "compare",
        currentSiftId: cur.id,
        priorSiftId: prior.id,
      },
    };
  }

  // 4 — open thread, no activity > 7 days
  let stalest: { s: Sift; lastAct: number } | null = null;
  for (const s of openThreads) {
    const cis = await storage.listCheckins(s.id);
    const lastCi =
      cis.length > 0 ? Math.max(...cis.map((c) => c.createdAt)) : s.createdAt;
    const lastAct = Math.max(s.createdAt, lastCi);
    if (Date.now() - lastAct <= REENTRY_7D_MS) continue;
    if (!stalest || lastAct < stalest.lastAct) {
      stalest = { s, lastAct };
    }
  }
  if (stalest) {
    return {
      prompt: "This one's been sitting. Still alive, or done for now?",
      action: {
        type: "revisit",
        threadId: stalest.s.id,
        threadTitle: threadTitleFromSiftCore(stalest.s),
      },
    };
  }

  return { prompt: null };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // JSON body parsing lives on the root app (server/index.ts) — keep a single
  // express.json() so the request body is not parsed twice.

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
    // Read the hash with better-sqlite3 directly so login matches a plain
    // `SELECT` + scrypt check (the same path we use to verify deploys).
    const row = rawDb
      .prepare(`SELECT id, passphrase_hash FROM users WHERE handle = ?`)
      .get(handle) as { id: number; passphrase_hash: string } | undefined;
    if (!row || !verifyPassphrase(parsed.data.passphrase, row.passphrase_hash)) {
      return res
        .status(401)
        .json({ error: "Handle or passphrase doesn't match." });
    }
    const user = await storage.getUserById(row.id);
    if (!user) {
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

  // Live schema introspection — admin only. Used to verify migrations
  // ran on the production volume (Fly's SSH tunnel can be flaky).
  app.get("/api/admin/schema", requireAdmin, async (_req, res) => {
    const cols = rawDb.prepare(`PRAGMA table_info(sifts);`).all();
    res.json({ table: "sifts", columns: cols });
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

// V1: detect mode + entry signal from user input at creation time
function routeThread(input: string): { mode: 'personal'|'operator', entrySignal: string } {
  const L = input.toLowerCase();
  // Explicit operator markers
  if (/\b(project|deadline|launch|ship|revenue|customer|mvp|pitch|investor|roadmap)\b/.test(L) &&
      /\b(team|busy|overwhelmed|stuck|behind|paralyzed|scattered)\b/.test(L)) {
    return { mode: 'operator', entrySignal: 'explicit_project' };
  }
  if (/\b(decision|choosing|deciding|option a|option b|vs \.|versus |either .+ or|should i|which one)\b/.test(L)) {
    return { mode: 'operator', entrySignal: 'decision_language' };
  }
  if (/\b(partner|client|boss|cofounder|investor|team member|board|collaborator|spouse|member)\b/.test(L) &&
      /\b(frustrat|tension|friction|misalign|trust|accountability|expectations|communication)\b/.test(L)) {
    return { mode: 'operator', entrySignal: 'stakeholder' };
  }
  // Structural work markers (organizing, clarifying, restructuring)
  if (/\b(clarify|structure|organize|restructure|simplify|sequence|untangle|streamline)\b/.test(L)) {
    return { mode: 'operator', entrySignal: 'structural_work' };
  }
  // Explicit personal markers
  if (/\b(i feel|i'm feeling|emotion|heart|alone|afraid|scared|worried|anxious|guilt|shame|regret|grieving|attached to|upset|angry|sad|lonely)\b/.test(L)) {
    return { mode: 'personal', entrySignal: 'explicit_request' };
  }
  if (/\b(relationship|partner|spouse|friend|mother|father|family|mom|dad|brother|sister|couple|kids|children)\b/.test(L) &&
      /\b(confused|hurt|conflict|distance|resent|trying to forgive|communication|trust|intimacy)\b/.test(L)) {
    return { mode: 'personal', entrySignal: 'none' };
  }
  // Default: personal
  return { mode: 'personal', entrySignal: 'none' };
}

  app.post("/api/sift/fragments", async (req, res) => {
    const parsed = siftFragmentsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    if (screenForCrisis(parsed.data.input)) {
      return res.json({ type: "care" });
    }
    try {
      const fragments = await runSiftFragments(parsed.data.input);
      return res.json({ fragments });
    } catch (err: any) {
      console.error("fragments error", err);
      return res.status(500).json({
        error: "Could not pull fragments right now.",
        detail: err?.message ?? String(err),
      });
    }
  });

  app.post("/api/sift", async (req, res) => {
    const parsed = analyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const { input, inputMode, fragmentSort, skippedFragmentSort, forceAnalysis, metaSift } =
      parsed.data;

    // Crisis safeguard — before persistence, before LLM. If the input describes
    // suicide, self-harm, or intent to harm others, return a care response and
    // stop. Nothing is stored; nothing is sent to the model.
    if (screenForCrisis(input)) {
      return res.json({ type: "care" });
    }

    const userId = readToken(req);

    try {
      let redundancyCheck: RedundancyLevel = { level: "none" };
      if (!forceAnalysis && userId) {
        redundancyCheck = await checkRedundancy(userId, input);
        if (redundancyCheck.level === "high") {
          return res.json({
            input,
            inputMode,
            createdAt: Date.now(),
            mine: true,
            redundancyGate: {
              level: "high",
              priorSiftId: redundancyCheck.priorSiftId,
              priorNextStep: redundancyCheck.priorNextStep,
              message:
                "This looks like something you've already sorted through.",
              options: ["Something changed", "I think I know this"] as const,
            },
          });
        }
      }

      const preSortContext = buildPreSortContext(
        fragmentSort,
        skippedFragmentSort,
      );
      const analysis = await runAnalysis(input, {
        preSortContext: preSortContext || undefined,
        metaSift: metaSift === true,
      });

      // Output safeguard — scan every string in the model's response. If it
      // contains crisis-adjacent language (shouldn't, given the system prompt,
      // but we do not rely on that), discard the response entirely. Nothing is
      // persisted; the client surfaces the care screen.
      if (screenOutputForCrisis(analysis)) {
        console.warn("[crisis-screen] output tripped on /api/sift — discarding");
        return res.json({ type: "care" });
      }

      const id = newId();

      const { mode, entrySignal } = routeThread(input);
      // Step 4: persist Operator artifact fields when runOperatorAnalysis succeeds.
      // The Personal-compatible columns (themes, coreIntent, nextStep, reflection,
      // matters, noise, signalReason) are always written via runAnalysis below —
      // this shadow step only adds operator_artifact + derived fields on top.
      let artifactType: string | undefined;
      let operatorArtifact: string | undefined;
      let currentMoveOverride: string | undefined;
      if (mode === "operator") {
        try {
          const op = await runOperatorAnalysis(input);
          artifactType = op.artifactType;
          operatorArtifact = JSON.stringify(op);
          currentMoveOverride = op.currentMove;
          console.debug("[operator] artifact persisted:", op.artifactType);
        } catch (err: unknown) {
          console.warn("[operator] runOperatorAnalysis failed, persisting Personal-only result", err);
        }
      }

      let sortScore: number | null = null;
      if (
        fragmentSort?.length &&
        !skippedFragmentSort &&
        analysis.matters?.length
      ) {
        sortScore = computeSortAlignmentScore(
          fragmentSort as {
            fragment: string;
            bucket: "matters" | "noise" | "unsure";
          }[],
          analysis.matters,
          analysis.noise,
        );
      }

      const recurring = await detectRecurringSignal(userId, analysis.matters, id);

      await storage.createSift({
        id,
        matters: JSON.stringify(analysis.matters),
        noise: JSON.stringify(analysis.noise),
        signalReason: analysis.signalReason,
        stepScope: analysis.stepScope
          ? JSON.stringify(analysis.stepScope)
          : null,
        baselineNextStep: analysis.nextStep,
        userId: userId ?? undefined,
        input,
        inputMode,
        themes: JSON.stringify(analysis.themes),
        coreIntent: analysis.coreIntent,
        nextStep: analysis.nextStep,
        reflection: analysis.reflection,
        mode,
        modeLocked: 1,
        entrySignal,
        threadState: 'open',
        frontBurnerRank: null,
        currentMove: currentMoveOverride ?? null,
        closureCondition: null,
        artifactType: artifactType ?? null,
        operatorArtifact: operatorArtifact ?? null,
        recurringSignal: recurring.detected ? 1 : 0,
        recurringTheme: recurring.theme,
        redundancyHintLevel:
          redundancyCheck.level === "low" ? "low" : null,
        redundancyPriorSiftId:
          redundancyCheck.level === "low"
            ? redundancyCheck.priorSiftId
            : null,
        metaSift: metaSift === true ? 1 : null,
      } as any);

      if (sortScore != null) {
        await storage.updateSiftSortAlignment(id, sortScore);
      }

      if (userId) {
        await storage.updateDiscernmentProfile(
          userId,
          recurring.detected ? { recurringSignalDelta: 1 } : undefined,
        );
      }

      const row = await storage.getSift(id);
      const showClosure =
        row && userId
          ? await shouldShowClosurePrompt(userId, row)
          : false;

      const result: SiftResult = {
        id,
        input,
        inputMode,
        createdAt: Date.now(),
        ...analysis,
        baselineNextStep: analysis.nextStep,
        ...(metaSift === true ? { metaSift: true } : {}),
        mine: !!userId,
        microTasks: null,
        checkins: [],
        recurringSignal: recurring.detected,
        mode,
        frontBurnerRank: null,
        artifactType: (artifactType as SiftResult["artifactType"]) ?? null,
        ...(redundancyCheck.level === "low"
          ? {
              redundancyHint: {
                level: "low" as const,
                message:
                  "You've been here before. Notice if this step feels familiar.",
              },
            }
          : {}),
        ...(showClosure ? { showClosurePrompt: true } : {}),
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

  app.patch("/api/sift/:id/correction", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const parsed = siftCorrectionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const siftId = String(req.params.id);
    const sift = await storage.getSift(siftId);
    if (!sift) return res.status(404).json({ error: "Not found" });
    if (sift.userId !== userId) return res.status(403).json({ error: "Not your sift" });

    const merged = `${sift.input}\n\nOne more angle: ${parsed.data.reframe}\n\nWhat I actually want underneath this is: ${parsed.data.reframe}`;
    if (screenForCrisis(merged)) {
      return res.json({ type: "care" });
    }

    try {
      const analysis = await runAnalysis(merged);
      if (screenOutputForCrisis(analysis)) {
        console.warn("[crisis-screen] output tripped on PATCH correction — discarding");
        return res.json({ type: "care" });
      }

      const { mode, entrySignal } = routeThread(merged);
      let artifactType: string | null = sift.artifactType ?? null;
      let operatorArtifact: string | null = sift.operatorArtifact ?? null;
      let currentMoveOverride: string | null = sift.currentMove ?? null;
      if (mode === "operator") {
        try {
          const op = await runOperatorAnalysis(merged);
          artifactType = op.artifactType;
          operatorArtifact = JSON.stringify(op);
          currentMoveOverride = op.currentMove;
        } catch (err: unknown) {
          console.warn("[operator] correction runOperatorAnalysis failed, keeping prior artifact fields", err);
        }
      }

      const snapshot = siftRowToRevisionSnapshot(sift);
      const updated = await storage.applySiftCorrection({
        id: siftId,
        userId,
        revisionAppend: snapshot,
        values: {
          input: merged,
          themes: JSON.stringify(analysis.themes),
          coreIntent: analysis.coreIntent,
          nextStep: analysis.nextStep,
          reflection: analysis.reflection,
          matters: JSON.stringify(analysis.matters),
          noise: JSON.stringify(analysis.noise),
          signalReason: analysis.signalReason,
          stepScope: analysis.stepScope ? JSON.stringify(analysis.stepScope) : null,
          mode,
          entrySignal,
          artifactType,
          operatorArtifact,
          currentMove: currentMoveOverride,
        },
      });
      if (!updated) return res.status(404).json({ error: "Not found" });

      const matters: string[] = (() => {
        try {
          const v = JSON.parse(updated.matters ?? "[]");
          return Array.isArray(v) ? v.filter((s) => typeof s === "string") : [];
        } catch {
          return [];
        }
      })();
      const noise: string[] = (() => {
        try {
          const v = JSON.parse(updated.noise ?? "[]");
          return Array.isArray(v) ? v.filter((s) => typeof s === "string") : [];
        } catch {
          return [];
        }
      })();

      const microTasksWire = parseMicroTasksColumn(updated.microTasks ?? null);

      const result: SiftResult = {
        id: updated.id,
        input: updated.input,
        inputMode: updated.inputMode as "text" | "voice",
        createdAt: updated.createdAt,
        themes: JSON.parse(updated.themes),
        coreIntent: updated.coreIntent,
        nextStep: updated.nextStep,
        reflection: updated.reflection,
        matters,
        noise,
        signalReason: updated.signalReason ?? "",
        stepScope: parseStepScopeColumn(updated.stepScope ?? null),
        baselineNextStep: updated.baselineNextStep ?? updated.nextStep,
        mine: true,
        checkins: (await storage.listCheckins(siftId)).map(checkinToResult),
        revisionHistory: parseRevisionHistoryColumn(updated.revisionHistory ?? null),
        mode: (updated.mode as SiftResult["mode"]) ?? undefined,
        frontBurnerRank: updated.frontBurnerRank ?? null,
        artifactType:
          (updated.artifactType as SiftResult["artifactType"]) ?? null,
        ...(microTasksWire ? { microTasks: microTasksWire } : { microTasks: null }),
      };
      return res.json(result);
    } catch (err: any) {
      console.error("correction error", err);
      return res.status(500).json({
        error: "Could not update this sift right now.",
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

  // Smart re-entry — one contextual prompt for signed-in users
  app.get("/api/reentry", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    try {
      const payload = await computeReEntryPrompt(userId);
      return res.json(payload);
    } catch (err: unknown) {
      console.error("reentry error", err);
      return res.status(500).json({
        error: "Could not load re-entry right now.",
      });
    }
  });

  app.get("/api/garden", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    try {
      const payload = await buildGardenPayload(userId);
      return res.json(payload);
    } catch (err: unknown) {
      console.error("garden error", err);
      return res.status(500).json({
        error: "Could not load garden right now.",
      });
    }
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

  // List my threads (all open, closed, archived — like /api/sifts but with thread fields)
  app.get("/api/threads", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const threads = await storage.listThreads(userId);
    res.json({ threads });
  });

  // Get a single thread by id (owner or public)
  app.get("/api/threads/:id", async (req, res) => {
    const thread = await storage.getThread(String(req.params.id));
    if (!thread) return res.status(404).json({ error: "Not found" });
    // Attach turns + bookmark if owned
    const userId = readToken(req);
    let turns: any[] = [];
    let bookmark: any = null;
    if (userId && thread.userId === userId) {
      turns = await storage.listTurns(String(req.params.id));
      bookmark = (await storage.getBookmark(String(req.params.id))) ?? undefined;
    }
    res.json({
      thread: {
        id: thread.id,
        createdAt: thread.createdAt,
        input: thread.input,
        inputMode: thread.inputMode,
        coreIntent: thread.coreIntent,
        nextStep: thread.nextStep,
        reflection: thread.reflection,
        status: thread.status === "closed" ? "closed" : "open",
        mode: (thread.mode as 'personal'|'operator'|null) ?? 'personal',
        modeLocked: !!(thread.modeLocked),
        entrySignal: (thread.entrySignal as string|null) ?? 'none',
        threadState: ((thread.threadState as string)||"open") as 'open'|'closed'|'archived',
        frontBurnerRank: thread.frontBurnerRank ?? null,
        currentMove: thread.currentMove ?? null,
        closureCondition: thread.closureCondition ?? null,
        turns,
        bookmark,
      },
    });
  });

  // Update thread fields (state, bucket, current_move, closure_condition)
  app.patch("/api/threads/:id", requireAuth, async (req, res) => {
    const parsed = updateThreadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const userId = (req as any).userId as number;
    const updated = await storage.updateThread(String(req.params.id), userId, parsed.data);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json({ thread: updated });
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

    // Parse Signal/Noise framing fields. Legacy rows (created before these
    // columns existed) get safe empty fallbacks so the client can render an
    // older sift without crashing. New analysis runs always populate them.
    const matters: string[] = (() => {
      if (!row.matters) return [];
      try {
        const v = JSON.parse(row.matters);
        return Array.isArray(v) ? v.filter((s) => typeof s === "string") : [];
      } catch {
        return [];
      }
    })();
    const noise: string[] = (() => {
      if (!row.noise) return [];
      try {
        const v = JSON.parse(row.noise);
        return Array.isArray(v) ? v.filter((s) => typeof s === "string") : [];
      } catch {
        return [];
      }
    })();
    const signalReason: string = row.signalReason ?? "";
    const stepScopeWire = parseStepScopeColumn(row.stepScope ?? null);
    const baselineWire =
      row.baselineNextStep ?? row.nextStep ?? "";
    const revisionWire =
      isMine && row.revisionHistory
        ? parseRevisionHistoryColumn(row.revisionHistory)
        : undefined;

    const showClosurePromptWire =
      isMine && viewerId
        ? await shouldShowClosurePrompt(viewerId, row)
        : false;

    const redundancyHintWire =
      isMine && row.redundancyHintLevel === "low"
        ? {
            level: "low" as const,
            message:
              "You've been here before. Notice if this step feels familiar.",
          }
        : undefined;

    const recurringSignalWire = row.recurringSignal === 1;

    const microTasksWire = isMine
      ? parseMicroTasksColumn(row.microTasks ?? null)
      : null;

    const result: SiftResult = {
      id: row.id,
      input: row.input,
      inputMode: row.inputMode as "text" | "voice",
      createdAt: row.createdAt,
      themes: JSON.parse(row.themes),
      coreIntent: row.coreIntent,
      nextStep: row.nextStep,
      reflection: row.reflection,
      matters,
      noise,
      signalReason,
      ...(row.metaSift === 1 ? { metaSift: true } : {}),
      ...(stepScopeWire ? { stepScope: stepScopeWire } : {}),
      baselineNextStep: baselineWire,
      mine: isMine,
      status: (row.status === "closed" ? "closed" : "open") as any,
      checkins: checkinRows.map(checkinToResult),
      turns,
      bookmark,
      mode: (row.mode as SiftResult["mode"]) ?? undefined,
      frontBurnerRank: row.frontBurnerRank ?? null,
      artifactType:
        (row.artifactType as SiftResult["artifactType"]) ?? null,
      ...(revisionWire?.length ? { revisionHistory: revisionWire } : {}),
      ...(recurringSignalWire ? { recurringSignal: true } : {}),
      ...(redundancyHintWire ? { redundancyHint: redundancyHintWire } : {}),
      ...(showClosurePromptWire ? { showClosurePrompt: true } : {}),
      ...(isMine
        ? microTasksWire
          ? { microTasks: microTasksWire }
          : { microTasks: null }
        : {}),
    };
    return res.json(result);
  });

  // Break Down — three microscopic tasks for the current next step (owner only)
  app.post("/api/sift/:id/breakdown", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const parsed = siftBreakdownRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: parsed.error.flatten(),
      });
    }
    const siftId = String(req.params.id);
    const row = await storage.getSift(siftId);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.userId !== userId) {
      return res.status(403).json({ error: "Not your sift" });
    }

    const cached = parseMicroTasksColumn(row.microTasks ?? null);
    if (cached) {
      return res.json({ microTasks: cached });
    }

    try {
      const tasks = await runBreakdownMicroTasks(parsed.data.nextStep);
      const ok = await storage.updateSiftMicroTasks(siftId, userId, tasks);
      if (!ok) return res.status(404).json({ error: "Not found" });
      await storage.updateDiscernmentProfile(userId, { breakdownDelta: 1 });
      return res.json({ microTasks: tasks });
    } catch (err: unknown) {
      console.error("breakdown error", err);
      return res.status(422).json({
        error: "Could not break this down — try rephrasing the step.",
      });
    }
  });

  // Step negotiation — revise the proposed one_next_step without re-sifting
  // the whole result. The step is a proposal, not a final answer (per
  // AGENTS.md "step check mechanic"). "smaller" narrows scope; "different"
  // proposes a different shape of move on the same signal. Owner-only.
  app.post("/api/sift/:id/revise-step", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const parsed = siftStepRevisionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      });
    }
    const siftId = String(req.params.id);
    const row = await storage.getSift(siftId);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.userId !== userId) {
      return res.status(403).json({ error: "Not your sift" });
    }
    try {
      const revised = await runStepRevision({
        input: row.input,
        coreIntent: row.coreIntent,
        currentStep: row.nextStep,
        variant: parsed.data.variant,
      });
      // Persist the revised step. We deliberately do not touch matters/noise
      // or coreIntent — the underlying read is unchanged, only the move
      // proposed off it.
      rawDb
        .prepare(
          "UPDATE sifts SET next_step = ?, step_scope = ?, micro_tasks = NULL WHERE id = ? AND user_id = ?",
        )
        .run(
          revised.nextStep,
          JSON.stringify(revised.stepScope),
          siftId,
          userId,
        );
      return res.json({
        nextStep: revised.nextStep,
        stepScope: revised.stepScope,
      });
    } catch (err: unknown) {
      console.error("step revision error", err);
      return res.status(422).json({
        error: "Could not revise that step — try again.",
      });
    }
  });

  // Acknowledge mastery without analysis — owner only
  app.patch("/api/sift/:id/close-loop", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const siftId = String(req.params.id);
    const ok = await storage.updateSiftClosedLoop(siftId, userId, true);
    if (!ok) return res.status(404).json({ error: "Not found" });
    await storage.updateDiscernmentProfile(userId, { masteryDelta: 1 });
    return res.json({ success: true });
  });

  // Closure prompt — dismiss or close thread (owner only). Does not run closure LLM.
  app.patch("/api/sift/:id/close", requireAuth, async (req, res) => {
    const parsed = siftClosurePromptPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const userId = (req as any).userId as number;
    const siftId = String(req.params.id);
    const ok = await storage.patchSiftClosurePrompt(siftId, userId, {
      keepOpen: !!parsed.data.keepOpen,
    });
    if (!ok) return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true });
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
      // Additionally require enough thread material to sort meaningfully —
      // a thin thread will not produce distinct, useful cards. We check the
      // cumulative user-message character count rather than building a
      // larger orchestration system.
      const userMessageCount = priorTurns.filter(
        (t) => t.role === "user" && t.kind === "message",
      ).length;
      const messagesSinceLastSort = countUserMessagesSinceLastSort(priorTurns);
      const userMaterialChars =
        sift.input.length +
        priorTurns.reduce((sum, t) => {
          if (t.role === "user" && t.kind === "message") {
            return sum + (typeof t.text === "string" ? t.text.length : 0);
          }
          return sum;
        }, 0);
      const ENOUGH_MATERIAL_TO_SORT = 240; // ~3 short sentences across the thread.
      const shouldOfferSort =
        userMessageCount >= 3 &&
        userMessageCount % 3 === 0 &&
        messagesSinceLastSort >= 2 &&
        userMaterialChars >= ENOUGH_MATERIAL_TO_SORT;

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
      // The user-facing text below is what the model treats as the latest user
      // message. We pass a structured directive so the post-sort branch of the
      // DEEPEN prompt fires reliably: name the elevated signal, one provisional
      // sentence on why it may carry consequence, one concrete next-step
      // question. The flat list also remains for context.
      const turnsWithSort = [...priorTurns, sortResultTurn];
      const hasSignal = !result.skipped && result.matters.length > 0;
      const latestUserText = result.skipped
        ? ""
        : hasSignal
          ? [
              `I just finished a Signal / Noise sort.`,
              `Matters (signal): ${result.matters.join("; ")}`,
              `Noise: ${result.noise.join("; ") || "(none)"}`,
              `Unsure: ${result.unsure.join("; ") || "(none)"}`,
              `Take the matters list as my elevated signal right now. In your reply: name it back to me using my words, say in one provisional sentence why it may carry consequence, and ask one concrete next-step question. Do not name the noise. If unsure is non-empty, you may briefly acknowledge it as still unresolved.`,
            ].join(" \n")
          : `I just finished a Signal / Noise sort but did not place anything as matters. Noise: ${result.noise.join("; ") || "(none)"}. Unsure: ${result.unsure.join("; ") || "(none)"}. Treat this as a thread that has not yet found its signal — ask one quiet question that helps me locate what may actually matter.`;

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
      const priorNextStep = sift.nextStep;
      const analysis = await runCheckinAnalysis(
        sift.input,
        priorNextStep,
        parsed.data.status,
        parsed.data.note ?? ""
      );

      // Output safeguard — same discard-and-care policy for check-in outputs.
      if (screenOutputForCrisis(analysis)) {
        console.warn("[crisis-screen] output tripped on /api/sift/:id/checkin — discarding");
        return res.json({ type: "care" });
      }

      const storedPayload: CheckinAnalysis = { ...analysis, priorNextStep };

      const row = await storage.createCheckin({
        siftId,
        status: parsed.data.status,
        note: parsed.data.note ?? "",
        response: JSON.stringify(storedPayload),
      });
      await storage.updateSiftNextStep(siftId, userId, analysis.nextStep);
      await storage.updateDiscernmentProfile(userId);

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
