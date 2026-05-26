import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import express from "express";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { storage, rawDb } from "./storage";
import { selectDailyPrompt, getPromptById } from "./daily-prompt";
import {
  buildDailyPromptInputForUser,
  countUserSifts,
  currentThemeCycleDay,
  loadRecentSiftSignals,
} from "./daily-prompt-context";
import { isDailyPromptEmailFeatureEnabled } from "./lib/daily-prompt-eligibility";
import { runSendDailyPromptsJob } from "./jobs/send-daily-prompts";
import { screenForCrisis, screenOutputForCrisis } from "./crisis-screen";
import { registerKokoroTtsProxy } from "./kokoro-tts-proxy";
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
  forgotPassphraseSchema,
  resetPassphraseSchema,
  contactUpdateSchema,
  supportProfileSchema,
  supportProfileUpdateSchema,
  memoryPreferencesSchema,
  memoryPreferencesUpdateSchema,
  defaultMemoryPreferences,
  notificationPreferencesSchema,
  notificationPreferencesUpdateSchema,
  defaultNotificationPreferences,
  DAILY_PROMPT_HOUR_MIN,
  DAILY_PROMPT_HOUR_MAX,
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
  siftSummarySchema,
  updateSessionMemorySchema,
  writingSiftArtifactSchema,
  type Analysis,
  type WritingSiftArtifact,
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
  type SiftSummary,
  type ClientTranscriptTurn,
  type ReEntryResponse,
  type FeedbackStats,
  type AdminReviewFeedback,
  type AdminReviewSift,
  type SupportProfile,
  type MemoryPreferences,
  type LibraryResponse,
  type LibraryRecurringTheme,
  type LibrarySiftItem,
  type LibrarySiftDetail,
  type LibrarySiftPreview,
} from "@shared/schema";

type SiftClientAuthMode = "default" | "server-api-key";

const defaultSiftClient = new Anthropic();
let serverApiKeySiftClient: Anthropic | null = null;

function getSiftClient(authMode: SiftClientAuthMode = "default"): Anthropic {
  const serverApiKey = process.env.SIFT_API_KEY;
  if (serverApiKey) {
    serverApiKeySiftClient ??= new Anthropic({ apiKey: serverApiKey });
    return serverApiKeySiftClient;
  }
  return defaultSiftClient;
}

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
- Never repeat a prior question verbatim or near-verbatim. If the user answered it, advance from the answer.
- Short direct replies are valid answers when they respond to your question.
- If the user says you repeated yourself, missed them, or are not listening, acknowledge it briefly and change direction.
- When the user is uncertain or low-detail ("idk", "maybe", "not sure", "just off", "weird", "nothing exactly"), match their plainness: short acknowledgment, one direct question. No metaphors, no "charge", "weight", "underneath", or therapy phrasing. Do not echo their filler words back as insight.

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
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

function hashPassphrase(passphrase: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(passphrase, salt, 64, SCRYPT_PARAMS);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

function verifyPassphrase(passphrase: string, stored: string): boolean {
  const [saltPart, derivedHex] = stored.split(":");
  if (!saltPart || !derivedHex) return false;
  const expected = Buffer.from(derivedHex, "hex");
  const candidates: Buffer[] = [];
  try {
    candidates.push(
      crypto.scryptSync(passphrase, Buffer.from(saltPart, "hex"), 64, SCRYPT_PARAMS),
    );
  } catch {
    /* ignore */
  }
  try {
    candidates.push(crypto.scryptSync(passphrase, saltPart, 64, SCRYPT_PARAMS));
    candidates.push(crypto.scryptSync(passphrase, saltPart, 64));
  } catch {
    /* ignore */
  }
  return candidates.some(
    (test) =>
      test.length === expected.length && crypto.timingSafeEqual(test, expected),
  );
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

const insertResetTokenStmt = rawDb.prepare(
  `INSERT INTO passphrase_reset_tokens (token, user_id, created_at, expires_at, used_at)
   VALUES (?, ?, ?, ?, NULL)`,
);
const readResetTokenStmt = rawDb.prepare(
  `SELECT user_id AS userId, expires_at AS expiresAt, used_at AS usedAt
   FROM passphrase_reset_tokens WHERE token = ?`,
);
const markResetTokenUsedStmt = rawDb.prepare(
  `UPDATE passphrase_reset_tokens SET used_at = ? WHERE token = ?`,
);
const updateUserPassphraseStmt = rawDb.prepare(
  `UPDATE users SET passphrase_hash = ? WHERE id = ?`,
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

const WARMUP_ANALYSIS_SYSTEM_SUFFIX = `

Bedroom warmup phase:
- For this message, act like a calm, smart friend named Sift.
- The visible "reflection" must feel like a warm companion, not an analyst.
- Write 1–2 short sentences that acknowledge the feeling or situation.
- End with exactly one simple clarifying question.
- If the input is vague, short, or low-context, treat it as a valid opening. Do not say "not enough information" or ask for details generally.
- Good low-context pattern: brief warmth, permission for unsorted expression, one grounding question.
- For uncertain tiny replies ("idk", "maybe", "not sure"), use plain words only — no metaphors like "charge", "weight", or "underneath".
- Do not list "what matters", "noise", or "next step" inside the reflection.
- Still return every required JSON field. Keep matters/noise/nextStep internally useful, but the user will only see the reflection during warmup.`;

const WRITING_SIFT_SYSTEM_PROMPT = `You are Sift meeting a piece of creative writing — a poem, draft, lyric, essay fragment, or other crafted expression.

The user is NOT asking you to solve a life problem. Do not sort their text into "signal" and "noise." Do not assign homework disguised as insight. Do not sound like an English teacher, workshop critic, or cheerleader.

${SAFETY_CLAUSE}

Meet the work on its own terms. Name what the piece is carrying, one image that feels alive in it, what lingers after reading, and one gentle invitation — not a fix, not a rewrite unless they explicitly asked for one.

Return STRICT JSON only:
{
  "mode": "writing",
  "whatThisPieceIsCarrying": string,
  "liveImage": string,
  "whatLingers": string,
  "oneInvitation": string
}

Rules:
- whatThisPieceIsCarrying: 1–2 sentences. Emotional or thematic weight — not plot summary.
- liveImage: 1 sentence naming a concrete image, rhythm, or moment that feels most alive. Specific, not generic.
- whatLingers: 1 sentence on the aftertaste — what stays in the body or attention.
- oneInvitation: 1 sentence. An open door (write toward X, sit with Y, read aloud) — not "you should" or grading language.
- No generic praise ("beautiful", "powerful", "lovely"). No line edits unless asked.
- Output JSON only. No prose before or after.`;

function greetingWarmupAnalysis(input: string): Analysis {
  return {
    themes: [
      {
        title: "Gentle Opening",
        summary: "The user is arriving with a simple greeting.",
      },
    ],
    coreIntent: "The user is opening the conversation.",
    nextStep: "Share what has been loud on your mind when you are ready.",
    reflection:
      "Yeah, we can start there. You don't have to have it sorted.\n\nWhat feels most loud right now?",
    matters: ["the user is arriving", "making the space feel easy"],
    noise: ["pushing for depth too soon"],
    signalReason:
      "A simple greeting calls for warmth and permission, not analysis.",
    stepScope: {
      durationEstimate: "~5 min",
      stoppingCondition: "when something real has been named",
    },
  };
}

function gracefulStructureFallback(input: string): Analysis {
  const compact = input
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  const heard = compact || "something hard to name";
  return {
    themes: [
      {
        title: "A live thread",
        summary: `Sift heard this as real material: ${heard}`,
      },
    ],
    coreIntent: "The user brought something emotionally or operationally real that needs a first handle.",
    nextStep:
      "Write one sentence naming the part of this that feels most load-bearing right now.",
    reflection:
      `One thing I hear is that this is not empty, even if it is not fully sorted yet. One possible signal is the part that keeps pulling attention back.`,
    matters: ["what keeps pulling attention"],
    noise: ["needing the whole shape at once"],
    signalReason:
      "The repeated pull of attention may show where the first real handle is.",
    stepScope: {
      durationEstimate: "~10 min",
      stoppingCondition: "when one load-bearing sentence is written",
    },
  };
}

const WARMUP_DEEPEN_SYSTEM_PROMPT = `You are Sift in Bedroom warmup mode.

Return JSON only matching this shape:
{
  "mirror": "1-2 warm sentences acknowledging what the user just said",
  "question": "one simple clarifying question",
  "matters": ["optional hidden structured signal if the exchange is substantive"]
}

Rules:
- For this message, act like a calm, smart friend named Sift.
- Do not list what matters, what is noise, or a next step.
- Keep it brief and human.
- Ask only one question.
- Treat greetings, one-word feelings, "I don't know", "can you help me", and "something is off" as valid openings.
- For low-context input, avoid premature interpretation. Offer warmth and one grounded question.
- Never repeat the same question already visible in the thread. If the user answers a question, advance from their answer.
- Short direct replies can be real answers. Treat replies like "i hate how it might look" as meaningful, not as non-answers.
- If the user says Sift repeated itself, misunderstood, or is not listening, acknowledge the miss and change direction.
- Only include "matters" when the user's message gives enough substance to name what deserves attention.
- Anchor the mirror and question in the user's newest words. Never reuse old examples or generic themes that are not in this thread.
- Low-information replies ("idk", "maybe", "not sure", "just off", "weird", "nothing exactly"): use simple grounded language only. Example mirror shapes: "That's okay.", "Fair.", "No rush." Example questions: "What feels hardest to name?", "What feels most unclear?", "If you had to guess, what feels closest?" Never say things like "carrying the charge", "holding weight", or interpret their uncertainty as depth.`;

const SUMMARY_SYSTEM_PROMPT = `You are Sift summarizing an active thread.

Return JSON only with this shape:
{
  "summary": "one paragraph tying the conversation together",
  "themes": ["2-4 core themes"],
  "constraints": ["optional realities or limits that matter"],
  "canWait": ["optional things present but not urgent"],
  "options": [
    { "id": "short-kebab-id", "label": "short path name", "description": "optional 1-2 sentence elaboration" }
  ],
  "recommendedNextStep": { "id": "must match one option id", "label": "single recommended path", "description": "optional concrete next move" }
}

Rules:
- The user's visible transcript is authoritative. If an earlier Sift reply seems generic or off-target, do not repeat its language.
- Keep the summary grounded in what the user actually brought, especially the latest user exchange.
- Name the real topic of the exchange in plain words. If the user named a person or relationship, preserve that context.
- Themes are not diagnoses. Use plain, concrete language.
- Avoid generic self-help abstractions like "what choosing closes", "keeping options alive", or "one project" unless the user actually talked about those things.
- Options are distinct paths, not tiny tasks, but each option must be specific to this conversation.
- The recommended next step should be one path Sift would choose right now, grounded in the actual relational, emotional, or operational issue raised.`;

function renderSupportProfileInstructions(profile?: SupportProfile | null): string {
  if (!profile?.mode && !profile?.startingSpace && !profile?.primaryIntent && !profile?.supportStyle) return "";

  const modeMap: Record<NonNullable<SupportProfile["mode"]>, string> = {
    base:
      "The user chose Sift Base. Be more minimal, concise, structured, and utility-forward.",
    companion:
      "The user chose Sift Companion. Be warmer, more relational, more presence-oriented, and companion-led.",
  };
  const intentMap: Record<NonNullable<SupportProfile["primaryIntent"]>, string> = {
    sort_thoughts:
      "The user said what would help most is sorting their thoughts. Structure the reflection, organize signal vs noise, and help untangle the message.",
    calm_noise:
      "The user said what would help most is calming the noise. Lead by reducing overwhelm; keep complexity low and do not crowd the reply.",
    understand_feelings:
      "The user said what would help most is understanding what they are feeling. Emphasize naming, emotional clarity, and inner understanding.",
    find_next_step:
      "The user said what would help most is finding a next step. Move toward action sooner and shorten the path to a concrete recommendation.",
  };

  const styleMap: Record<NonNullable<SupportProfile["supportStyle"]>, string> = {
    gentle:
      "They asked to be supported gently. Use soft phrasing, more reassurance, and slower pacing.",
    clear:
      "They asked to be supported clearly. Use concise, clean language and structured replies.",
    direct:
      "They asked to be supported directly. Name the core issue precisely, use less cushioning, and move faster to the real point.",
    step_by_step:
      "They asked for step-by-step support. Break reflections into smaller moves and reduce cognitive leaps.",
  };

  return [
    "Support profile — use this as active response strategy, not passive metadata:",
    profile.mode ? `- ${modeMap[profile.mode]}` : null,
    profile.startingSpace
      ? `- The user chose ${profile.startingSpace} as their starting space. Treat this mostly as experiential context; lightly match the entry tone without over-explaining it.`
      : null,
    profile.primaryIntent ? `- ${intentMap[profile.primaryIntent]}` : null,
    profile.supportStyle ? `- ${styleMap[profile.supportStyle]}` : null,
    "- Do not mention these preferences unless the user asks. Let them shape tone, pacing, question style, summaries, and next-step recommendations.",
  ]
    .filter(Boolean)
    .join("\n");
}

function parseJsonArrayColumn(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function parseThemesColumn(raw: string | null | undefined): Theme[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Theme =>
          item &&
          typeof item === "object" &&
          typeof (item as Theme).title === "string" &&
          typeof (item as Theme).summary === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function parseSiftSummaryColumn(raw: string | null | undefined): SiftSummary | null {
  if (!raw) return null;
  try {
    return siftSummarySchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function parseSupportProfileColumn(raw: string | null | undefined): SupportProfile | null {
  if (!raw) return null;
  try {
    return supportProfileSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function parseMemoryPreferencesColumn(raw: string | null | undefined): MemoryPreferences {
  if (!raw) return defaultMemoryPreferences;
  try {
    return memoryPreferencesSchema.parse({
      ...defaultMemoryPreferences,
      ...JSON.parse(raw),
    });
  } catch {
    return defaultMemoryPreferences;
  }
}

function normalizedEnvironment(value: string | null | undefined): LibrarySiftItem["environment"] {
  return value === "bedroom" || value === "desk" || value === "rooftop" || value === "library"
    ? value
    : null;
}

function libraryPreviewFor(args: {
  sift: Sift;
  themes: Theme[];
  matters: string[];
  noise: string[];
  bookmark?: Bookmark | null;
  clarity?: SiftSummary | null;
}): LibrarySiftPreview {
  if (args.clarity) {
    const noiseItems = (args.clarity.canWait?.length
      ? args.clarity.canWait
      : args.clarity.constraints ?? []
    ).slice(0, 3);
    return {
      summary: args.clarity.summary,
      matters: args.clarity.themes.slice(0, 4),
      noise: noiseItems,
      nextStep: args.clarity.recommendedNextStep.label,
    };
  }
  if (args.bookmark) {
    return {
      summary: args.bookmark.payload.unfolded || args.bookmark.payload.pointing,
      matters: args.bookmark.payload.matters.slice(0, 4),
      noise: args.bookmark.payload.noise.slice(0, 3),
      nextStep: args.bookmark.payload.nextStep,
    };
  }
  return {
    summary: args.sift.reflection || args.sift.coreIntent,
    matters: args.matters.length ? args.matters.slice(0, 4) : args.themes.map((t) => t.title).slice(0, 4),
    noise: args.noise.slice(0, 3),
    nextStep: args.sift.nextStep,
  };
}

function libraryItemFor(args: {
  sift: Sift;
  bookmark?: Bookmark | null;
}): LibrarySiftItem {
  const themes = parseThemesColumn(args.sift.themes);
  const matters = parseJsonArrayColumn(args.sift.matters);
  const noise = parseJsonArrayColumn(args.sift.noise);
  const clarity = parseSiftSummaryColumn(args.sift.claritySummary);
  const supportProfile = parseSupportProfileColumn(args.sift.supportProfileSnapshot);
  const preview = libraryPreviewFor({
    sift: args.sift,
    themes,
    matters,
    noise,
    bookmark: args.bookmark,
    clarity,
  });
  const title =
    themes[0]?.title ||
    args.sift.coreIntent ||
    preview.summary.split(/[.!?]/)[0]?.trim() ||
    "Untitled sift";
  const tags = Array.from(
    new Set([...themes.map((theme) => theme.title), ...matters].filter(Boolean)),
  ).slice(0, 8);
  const movement = {
    shifted:
      args.bookmark?.payload.unfolded?.trim() ||
      args.sift.signalReason?.trim() ||
      "This started as something worth sorting.",
    recurring: args.sift.recurringTheme?.trim() || null,
    leftOff:
      args.bookmark?.payload.lastLanded?.trim() ||
      preview.nextStep ||
      args.sift.currentMove ||
      "No clear left-off point was captured yet.",
  };

  return {
    id: args.sift.id,
    title,
    createdAt: args.sift.createdAt,
    summary: preview.summary,
    tags,
    hasNextStep: Boolean(preview.nextStep?.trim()),
    pinned: args.sift.pinned === 1,
    memoryMode:
      args.sift.memoryMode === "clarity_only" || args.sift.memoryMode === "do_not_remember"
        ? args.sift.memoryMode
        : "full",
    transcriptExpiresAt: args.sift.transcriptExpiresAt ?? null,
    mode:
      args.sift.uiMode === "base" || args.sift.uiMode === "companion"
        ? args.sift.uiMode
        : ((args.sift.mode as "personal" | "operator" | null) ?? null),
    environment: normalizedEnvironment(args.sift.environment ?? supportProfile?.startingSpace),
    movement,
    preview,
  };
}

function recurringThemesFor(items: LibrarySiftItem[]): LibraryRecurringTheme[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.tags.slice(0, 6)) {
      const label = tag.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({
      label: items.flatMap((item) => item.tags).find((tag) => tag.toLowerCase() === key) ?? key,
      count,
    }))
    .filter((theme) => theme.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

async function runAnalysis(
  input: string,
  opts?: {
    preSortContext?: string;
    metaSift?: boolean;
    authMode?: SiftClientAuthMode;
    phase?: "warmup" | "structured";
    intent?: "warmup-companion" | "greeting-warmup";
    supportProfile?: SupportProfile | null;
  },
): Promise<Analysis> {
  if (opts?.intent === "greeting-warmup") {
    return greetingWarmupAnalysis(input);
  }

  const extra = opts?.preSortContext
    ? `\n\n${opts.preSortContext}\n`
    : "";
  const baseSystem =
    opts?.metaSift === true
      ? `${SYSTEM_PROMPT}${META_SIFT_SYSTEM_SUFFIX}`
      : SYSTEM_PROMPT;
  const system =
    opts?.phase === "warmup"
      ? `${baseSystem}${WARMUP_ANALYSIS_SYSTEM_SUFFIX}`
      : baseSystem;
  const supportProfileContext = renderSupportProfileInstructions(opts?.supportProfile);
  const msg = await getSiftClient(opts?.authMode).messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [
      {
        role: "user",
        content: `Here is what I'm holding right now:\n\n${input}${extra}${supportProfileContext ? `\n\n${supportProfileContext}\n` : ""}\nSift it. Return JSON only.`,
      },
    ],
  });

  const textBlock = msg.content.find((b: any) => b.type === "text") as any;
  const raw = (textBlock?.text ?? "").trim();
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Model did not return JSON");
      parsed = JSON.parse(match[0]);
    }
    const analysis = analysisSchema.parse(parsed);
    const completeAnalysis = analysis.stepScope
      ? analysis
      : {
        ...analysis,
        stepScope: {
          durationEstimate: "~20 min",
          stoppingCondition:
            "when you can name one concrete piece of this move that is finished",
        },
      };
    if (!outputMatchesSource(analysisToText(completeAnalysis), input)) {
      return gracefulStructureFallback(input);
    }
    return completeAnalysis;
  } catch (err) {
    console.warn("[sift] falling back to graceful structure", err);
    return gracefulStructureFallback(input);
  }
}

function gracefulWritingFallback(input: string): WritingSiftArtifact {
  const snippet = input.replace(/\s+/g, " ").trim().slice(0, 120);
  return {
    mode: "writing",
    whatThisPieceIsCarrying:
      "Something is being held here that wants to be met before it is fixed.",
    liveImage: snippet
      ? `A line that still has charge: "${snippet}${input.length > 120 ? "…" : ""}"`
      : "A line or image that still has charge in the middle of the piece.",
    whatLingers: "The piece leaves a specific weight — worth staying with before moving on.",
    oneInvitation:
      "Read it aloud once, slowly, and notice which line your breath wants to return to.",
  };
}

async function runWritingAnalysis(
  input: string,
  opts?: { authMode?: SiftClientAuthMode },
): Promise<WritingSiftArtifact> {
  const msg = await getSiftClient(opts?.authMode).messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: WRITING_SIFT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is a piece of writing:\n\n${input}\n\nMeet it as writing. Return JSON only.`,
      },
    ],
  });

  const textBlock = msg.content.find((b: { type?: string }) => b.type === "text") as
    | { text?: string }
    | undefined;
  const raw = (textBlock?.text ?? "").trim();
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Model did not return JSON");
      parsed = JSON.parse(match[0]);
    }
    return writingSiftArtifactSchema.parse(parsed);
  } catch (err) {
    console.warn("[writing-sift] falling back to graceful writing structure", err);
    return gracefulWritingFallback(input);
  }
}

/** Map a Writing Sift artifact into legacy DB columns for storage compatibility. */
function writingArtifactToAnalysisFields(artifact: WritingSiftArtifact): Analysis {
  const title =
    artifact.whatThisPieceIsCarrying.slice(0, 40).trim() || "Writing";
  return {
    themes: [
      {
        title: "Writing Sift",
        summary: artifact.whatThisPieceIsCarrying,
      },
    ],
    coreIntent: artifact.whatThisPieceIsCarrying,
    reflection: artifact.liveImage,
    nextStep: artifact.oneInvitation,
    matters: [artifact.whatThisPieceIsCarrying.slice(0, 80)],
    noise: [artifact.whatLingers.slice(0, 80)],
    signalReason: artifact.whatLingers,
    stepScope: {
      durationEstimate: "~15 min",
      stoppingCondition: "when the invitation has been tried or sat with",
    },
  };
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
async function runOperatorAnalysis(
  input: string,
  opts?: { authMode?: SiftClientAuthMode },
): Promise<OperatorArtifact> {
  const msg = await getSiftClient(opts?.authMode).messages.create({
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
  const msg = await getSiftClient().messages.create({
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

When the user also supplies a short "what felt off" note about the current step, treat that note as a hard constraint on the new move's shape. Do not invent facts about their life that are not in the original input, the core intent, the current step, or their note. Still return exactly one next step.

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
  feedback?: string;
}): Promise<{ nextStep: string; stepScope: StepScope }> {
  const trimmed = args.feedback?.trim();
  const note = trimmed
    ? `\nWhat felt off about the current step (from the user — honor without inventing new facts):\n${trimmed}\n`
    : "";
  const userMsg = `Original input:\n${args.input}\n\nWhat this is pointing to:\n${args.coreIntent}\n\nCurrent proposed next step:\n${args.currentStep}\n\nVariant requested: ${args.variant}${note}\nReturn JSON only.`;
  const msg = await getSiftClient().messages.create({
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
  const msg = await getSiftClient().messages.create({
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

function visibleSiftTurnText(message: SiftTurnMessage): string {
  return [message.mirror, message.question, message.mini]
    .filter((part): part is string => Boolean(part?.trim()))
    .join("\n\n")
    .trim();
}

function normalizeLoopText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textSimilarity(a: string, b: string): number {
  const aa = normalizeLoopText(a);
  const bb = normalizeLoopText(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 1;
  const aTokens = new Set(aa.split(" ").filter(Boolean));
  const bTokens = new Set(bb.split(" ").filter(Boolean));
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  for (const token of Array.from(aTokens)) if (bTokens.has(token)) overlap++;
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function lastSiftMessage(turns: ThreadTurn[]): SiftTurnMessage | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t.role === "sift" && t.kind === "message") return t.message;
  }
  return null;
}

function previousUserMessage(turns: ThreadTurn[]): string | null {
  let sawLatest = false;
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t.role !== "user" || t.kind !== "message") continue;
    if (!sawLatest) {
      sawLatest = true;
      continue;
    }
    const text = t.text.trim();
    if (text) return text;
  }
  return null;
}

function isRepairModeText(text: string): boolean {
  const t = normalizeLoopText(text);
  if (t === "no") return true;
  return [
    "you already said that",
    "already said that",
    "you asked that",
    "you already asked",
    "that s not what i mean",
    "thats not what i mean",
    "not what i mean",
    "you re not listening",
    "youre not listening",
    "not listening",
  ].some((phrase) => t === phrase || t.includes(phrase));
}

function isPlausibleAnswerToQuestion(text: string, question?: string): boolean {
  const trimmed = text.trim();
  if (!question?.trim() || !trimmed) return false;
  if (isRepairModeText(trimmed)) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  const lower = normalizeLoopText(trimmed);
  const greetingOnly = /^(hi|hey|hello|yo|sup)$/.test(lower);
  if (greetingOnly) return false;
  return trimmed.length >= 10 || words.length >= 3;
}

function answerSignalFromText(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "what the user named";
  return compact.length > 72 ? `${compact.slice(0, 69)}...` : compact;
}

const POETIC_MIRROR_PHRASES = [
  "carrying some of the charge",
  "carrying the charge",
  "carrying the edge",
  "part with weight",
  "holding weight",
  "weight in the room",
  "sitting underneath",
  "humming beneath",
  "beneath that",
  "the charge here",
];

function mirrorSoundsPoetic(mirror?: string): boolean {
  if (!mirror?.trim()) return false;
  const t = normalizeLoopText(mirror);
  return POETIC_MIRROR_PHRASES.some((phrase) => t.includes(phrase));
}

function isLowInformationReply(text: string): boolean {
  const t = normalizeLoopText(text);
  if (!t) return true;
  const exact = new Set([
    "idk",
    "i dont know",
    "i don t know",
    "not sure",
    "unsure",
    "maybe",
    "umm",
    "um",
    "hmm",
    "hm",
    "meh",
    "nothing",
    "nothing really",
    "nothing exactly",
    "no idea",
    "dunno",
    "just off",
    "weird",
    "idk yet",
    "i guess",
    "sort of",
    "kind of",
    "not really",
    "hard to say",
    "hard to tell",
  ]);
  if (exact.has(t)) return true;
  const uncertainFragments = [
    "not sure",
    "dont know",
    "don t know",
    "no clue",
    "who knows",
    "can t tell",
    "cant tell",
    "don t know yet",
  ];
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 4 && uncertainFragments.some((p) => t === p || t.includes(p))) {
    return true;
  }
  return false;
}

function pickPlainFollowUpQuestion(seed: string): string {
  const options = [
    "What feels hardest to name?",
    "What feels most unclear?",
    "What feels most off?",
    "If you had to guess, what feels closest?",
    "Is it more fear, pressure, or confusion?",
    "No rush. What feels most loud?",
    "Fair. What's the part you keep circling?",
  ];
  const idx = Math.abs(seed.split("").reduce((n, c) => n + c.charCodeAt(0), 0)) % options.length;
  return options[idx]!;
}

function plainFollowUpMessage(args: {
  latestUserText: string;
  reason: "low_info" | "repair" | "repeat" | "source_mismatch" | "empty";
}): SiftTurnMessage {
  const question = pickPlainFollowUpQuestion(args.latestUserText);
  if (args.reason === "repair") {
    return {
      mirror: "You're right. Let me say that better.",
      question,
    };
  }
  const mirror =
    args.reason === "repeat"
      ? "Fair."
      : args.reason === "empty" || args.reason === "source_mismatch"
        ? "Okay."
        : "That's okay.";
  return { mirror, question };
}

function plainifyDeepeningTurn(args: {
  message: SiftTurnMessage;
  latestUserText: string;
}): SiftTurnMessage {
  const fallback = plainFollowUpMessage({
    latestUserText: args.latestUserText,
    reason: "low_info",
  });
  const modelQ = args.message.question?.trim();
  const question =
    modelQ &&
    modelQ.length <= 90 &&
    !mirrorSoundsPoetic(modelQ) &&
    !mirrorSoundsPoetic(args.message.mirror ?? "")
      ? modelQ
      : fallback.question;
  const mirror =
    args.message.mirror?.trim() &&
    !mirrorSoundsPoetic(args.message.mirror) &&
    !isLowInformationReply(args.message.mirror)
      ? args.message.mirror
      : fallback.mirror;
  return {
    ...args.message,
    mirror,
    question,
    matters: undefined,
    mini: args.message.mini && mirrorSoundsPoetic(args.message.mini) ? undefined : args.message.mini,
  };
}

function advancingFallbackMessage(args: {
  latestUserText: string;
  turns: ThreadTurn[];
  reason: "repeat" | "repair" | "source_mismatch" | "empty";
}): SiftTurnMessage {
  const priorAnswer = previousUserMessage(args.turns);
  const repair = args.reason === "repair";
  const answer = repair ? priorAnswer || args.latestUserText : args.latestUserText;
  if (isLowInformationReply(answer)) {
    return plainFollowUpMessage({
      latestUserText: answer,
      reason: repair ? "repair" : args.reason === "repeat" ? "repeat" : "low_info",
    });
  }
  const signal = answerSignalFromText(answer);
  return {
    mirror: repair ? "You're right. You did answer." : "Okay.",
    question: repair
      ? "What feels most at risk if it is seen that way?"
      : `What feels most at risk around ${signal}?`,
    matters: [signal],
  };
}

function guardDeepeningMessage(args: {
  message: SiftTurnMessage;
  latestUserText: string;
  turns: ThreadTurn[];
}): SiftTurnMessage {
  const prior = lastSiftMessage(args.turns);
  const priorText = prior ? visibleSiftTurnText(prior) : "";
  const nextText = visibleSiftTurnText(args.message);
  const repeated =
    Boolean(priorText && nextText && textSimilarity(priorText, nextText) >= 0.82) ||
    Boolean(prior?.question && args.message.question && textSimilarity(prior.question, args.message.question) >= 0.82);
  const repair = isRepairModeText(args.latestUserText);
  const answered = isPlausibleAnswerToQuestion(args.latestUserText, prior?.question);

  console.debug("[deepening] answer classification", {
    answered,
    repair,
    repeated,
    latestChars: args.latestUserText.trim().length,
  });

  if (isLowInformationReply(args.latestUserText)) {
    console.debug("[deepening] low-information reply mode");
    if (repair) {
      return plainFollowUpMessage({
        latestUserText: args.latestUserText,
        reason: "repair",
      });
    }
    if (repeated) {
      return plainFollowUpMessage({
        latestUserText: args.latestUserText,
        reason: "repeat",
      });
    }
    return plainifyDeepeningTurn({
      message: args.message,
      latestUserText: args.latestUserText,
    });
  }

  if (mirrorSoundsPoetic(args.message.mirror)) {
    console.debug("[deepening] poetic mirror replaced");
    return plainifyDeepeningTurn({
      message: args.message,
      latestUserText: args.latestUserText,
    });
  }

  if (repair) {
    console.debug("[deepening] repair mode triggered");
    return advancingFallbackMessage({
      latestUserText: args.latestUserText,
      turns: args.turns,
      reason: "repair",
    });
  }

  if (repeated) {
    console.warn("[deepening] repeated assistant prompt blocked", {
      previous: priorText,
      next: nextText,
    });
    return advancingFallbackMessage({
      latestUserText: args.latestUserText,
      turns: args.turns,
      reason: "repeat",
    });
  }

  if (answered && !args.message.matters?.length && !isLowInformationReply(args.latestUserText)) {
    return {
      ...args.message,
      matters: [answerSignalFromText(args.latestUserText)],
    };
  }

  return args.message;
}

function renderClientTranscriptForSummary(args: {
  originalInput: string;
  coreIntent: string;
  firstNextStep: string;
  clientTranscript: ClientTranscriptTurn[];
}): string {
  const lines: string[] = [];
  lines.push(`Original input:\n${args.originalInput}`);
  lines.push("");
  lines.push(`Original coreIntent: ${args.coreIntent}`);
  lines.push(`Original next step: ${args.firstNextStep}`);
  lines.push("");
  lines.push("Visible current-session transcript (authoritative, oldest first):");
  if (args.clientTranscript.length === 0) {
    lines.push("  (no visible turns supplied)");
  } else {
    for (const turn of args.clientTranscript) {
      lines.push(`${turn.role === "user" ? "USER" : "SIFT"}: ${turn.text}`);
    }
  }
  return lines.join("\n");
}

function tokenizeForSpecificity(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .match(/[a-z][a-z'-]{2,}/g)
        ?.map((token) => token.replace(/'/g, ""))
        .filter((token) => token.length >= 4 && !STOP_WORDS.has(token)) ?? [],
    ),
  );
}

function summaryToText(summary: SiftSummary): string {
  return [
    summary.summary,
    ...summary.themes,
    ...(summary.constraints ?? []),
    ...(summary.canWait ?? []),
    ...summary.options.flatMap((option) => [
      option.label,
      option.description ?? "",
    ]),
    summary.recommendedNextStep.label,
    summary.recommendedNextStep.description ?? "",
  ].join(" ");
}

function normalizeSummaryPayload(parsed: unknown, siftId: string): unknown {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return parsed;
  }

  const payload = { ...(parsed as Record<string, unknown>) };
  if (!Array.isArray(payload.options)) return payload;

  const options = payload.options;
  if (options.length <= 3) return payload;

  console.warn("[summary] model returned too many options; trimming", {
    siftId,
    optionCount: options.length,
  });

  const recommended =
    payload.recommendedNextStep &&
    typeof payload.recommendedNextStep === "object" &&
    !Array.isArray(payload.recommendedNextStep)
      ? (payload.recommendedNextStep as Record<string, unknown>)
      : null;
  const recommendedId =
    typeof recommended?.id === "string" ? recommended.id : null;

  const recommendedOption = recommendedId
    ? options.find(
        (option) =>
          option &&
          typeof option === "object" &&
          !Array.isArray(option) &&
          (option as Record<string, unknown>).id === recommendedId,
      )
    : null;
  const ranked = [
    ...(recommendedOption ? [recommendedOption] : []),
    ...options.filter((option) => option !== recommendedOption),
  ];
  const trimmed = ranked.slice(0, 3);

  return {
    ...payload,
    options: trimmed,
    recommendedNextStep:
      recommendedOption && trimmed.includes(recommendedOption)
        ? payload.recommendedNextStep
        : trimmed[0] ?? payload.recommendedNextStep,
  };
}

const STALE_GENERIC_SUMMARY_PHRASES = [
  "what choosing seems to close",
  "keeping every option alive",
  "one real focus",
  "one project",
  "week less scattered",
  "actual motion",
];

function summaryMatchesCurrentSession(summary: SiftSummary, sourceText: string): boolean {
  const normalizedSource = sourceText.toLowerCase();
  const normalizedSummary = summaryToText(summary).toLowerCase();
  for (const phrase of STALE_GENERIC_SUMMARY_PHRASES) {
    if (normalizedSummary.includes(phrase) && !normalizedSource.includes(phrase)) {
      return false;
    }
  }

  const sourceTokens = tokenizeForSpecificity(sourceText);
  if (sourceTokens.length === 0) return true;
  const summaryTokens = new Set(tokenizeForSpecificity(normalizedSummary));
  const overlap = sourceTokens.filter((token) => summaryTokens.has(token));
  return overlap.length >= Math.min(2, sourceTokens.length);
}

function analysisToText(analysis: Analysis): string {
  return [
    analysis.coreIntent,
    analysis.nextStep,
    analysis.reflection,
    analysis.signalReason,
    ...analysis.matters,
    ...analysis.noise,
    ...analysis.themes.flatMap((theme) => [theme.title, theme.summary]),
  ].join(" ");
}

function outputMatchesSource(outputText: string, sourceText: string): boolean {
  const normalizedSource = sourceText.toLowerCase();
  const normalizedOutput = outputText.toLowerCase();
  for (const phrase of STALE_GENERIC_SUMMARY_PHRASES) {
    if (normalizedOutput.includes(phrase) && !normalizedSource.includes(phrase)) {
      return false;
    }
  }

  const sourceTokens = tokenizeForSpecificity(sourceText);
  if (sourceTokens.length < 2) return true;
  const outputTokens = new Set(tokenizeForSpecificity(normalizedOutput));
  const overlap = sourceTokens.filter((token) => outputTokens.has(token));
  return overlap.length >= 2;
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
  const msg = await getSiftClient().messages.create({
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
  authMode?: SiftClientAuthMode;
  phase?: "warmup" | "structured";
  intent?: "warmup-companion" | "greeting-warmup";
  supportProfile?: SupportProfile | null;
}): Promise<SiftTurnMessage> {
  if (args.intent === "greeting-warmup") {
    return {
      mirror:
        "Hey. I'm glad you're here.\n\nWhenever you're ready, tell me what's been loud on your mind.",
    };
  }

  const userBlock =
    renderThreadForModel(args) +
    (renderSupportProfileInstructions(args.supportProfile)
      ? `\n\n${renderSupportProfileInstructions(args.supportProfile)}`
      : "") +
    (args.phase === "warmup"
      ? "\n\nRespond as Sift in Bedroom warmup mode. Return JSON only."
      : "\n\nRespond as Sift in Deepening Mode. Return JSON only.");
  const msg = await getSiftClient(args.authMode).messages.create({
    model: MODEL,
    max_tokens: 512,
    system:
      args.phase === "warmup"
        ? WARMUP_DEEPEN_SYSTEM_PROMPT
        : DEEPEN_SYSTEM_PROMPT,
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
    return guardDeepeningMessage({
      message: advancingFallbackMessage({
        latestUserText: args.latestUserText,
        turns: args.turns,
        reason: "empty",
      }),
      latestUserText: args.latestUserText,
      turns: args.turns,
    });
  }
  const messageText = [
    message.mirror,
    message.question,
    message.mini,
    ...(message.matters ?? []),
    ...(message.noise ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  if (!outputMatchesSource(messageText, `${args.originalInput}\n${args.latestUserText}`)) {
    console.warn("[deepening] source mismatch fallback", {
      latestChars: args.latestUserText.trim().length,
    });
    return guardDeepeningMessage({
      message: advancingFallbackMessage({
        latestUserText: args.latestUserText,
        turns: args.turns,
        reason: "source_mismatch",
      }),
      latestUserText: args.latestUserText,
      turns: args.turns,
    });
  }
  return guardDeepeningMessage({
    message,
    latestUserText: args.latestUserText,
    turns: args.turns,
  });
}

async function runThreadSummary(args: {
  sift: Sift;
  turns: ThreadTurn[];
  clientTranscript?: ClientTranscriptTurn[];
  authMode?: SiftClientAuthMode;
  supportProfile?: SupportProfile | null;
}): Promise<SiftSummary> {
  const authoritativeSource =
    args.clientTranscript && args.clientTranscript.length > 0
      ? args.clientTranscript
          .filter((turn) => turn.role === "user")
          .map((turn) => turn.text)
          .join("\n")
      : [
          args.sift.input,
          ...args.turns
            .filter((turn) => turn.role === "user" && turn.kind === "message")
            .map((turn) => ("text" in turn ? turn.text : "")),
        ].join("\n");

  const baseThread =
    args.clientTranscript && args.clientTranscript.length > 0
      ? renderClientTranscriptForSummary({
          originalInput: args.sift.input,
          coreIntent: args.sift.coreIntent,
          firstNextStep: args.sift.nextStep,
          clientTranscript: args.clientTranscript,
        })
      : renderThreadForModel({
          originalInput: args.sift.input,
          coreIntent: args.sift.coreIntent,
          firstNextStep: args.sift.nextStep,
          turns: args.turns,
        });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const repair =
      attempt === 0
        ? ""
        : "\n\nThe previous summary was too generic or mismatched. Regenerate it. It must name the concrete topic in the USER turns and avoid stale Sift phrasing.";
    const userBlock =
      baseThread +
      (renderSupportProfileInstructions(args.supportProfile)
        ? `\n\n${renderSupportProfileInstructions(args.supportProfile)}`
        : "") +
      "\n\nPull this thread together into the requested summary JSON. USER turns are the source of truth." +
      repair;
    const msg = await getSiftClient(args.authMode).messages.create({
      model: MODEL,
      max_tokens: 900,
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userBlock }],
    });
    const textBlock = msg.content.find((b: any) => b.type === "text") as any;
    const parsed = extractJson((textBlock?.text ?? "").trim());
    const normalized = normalizeSummaryPayload(parsed, args.sift.id);
    const parsedMeta =
      typeof normalized === "object" && normalized && "meta" in normalized
        ? (normalized as { meta?: Record<string, unknown> }).meta
        : undefined;
    const summary = siftSummarySchema.parse({
      ...(normalized as Record<string, unknown>),
      meta: {
        ...parsedMeta,
        generatedAt: new Date().toISOString(),
        model: MODEL,
      },
    });
    if (summaryMatchesCurrentSession(summary, authoritativeSource)) {
      return summary;
    }
  }

  throw new Error("Generated summary did not match the current session closely enough.");
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
  const msg = await getSiftClient().messages.create({
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
  const msg = await getSiftClient().messages.create({
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

  const msg = await getSiftClient().messages.create({
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

function allowAnonymousSiftRequests(): boolean {
  return process.env.ALLOW_ANON_SIFT !== "false";
}

function hasAuthHeader(req: Request): boolean {
  return Boolean(req.headers.authorization || req.headers["x-api-key"]);
}

function readGuestSessionId(req: Request): string | null {
  const raw = req.headers["x-sift-guest-session-id"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^[a-zA-Z0-9_-]{12,80}$/.test(trimmed) ? trimmed : null;
}

function resolveSiftAuth(req: Request): { userId: number | null; anonymous: boolean; guestSessionId: string | null } | null {
  const userId = readToken(req);
  if (userId) return { userId, anonymous: false, guestSessionId: readGuestSessionId(req) };
  if (allowAnonymousSiftRequests() && !hasAuthHeader(req)) {
    return { userId: null, anonymous: true, guestSessionId: readGuestSessionId(req) };
  }
  return null;
}

const ANONYMOUS_SIFT_LIMIT = Number(process.env.ANON_SIFT_LIMIT ?? 3);
const anonymousSiftWindowMs = 24 * 60 * 60 * 1000;

function clientIpKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw?.split(",")[0]?.trim() || req.ip || "unknown").slice(0, 80);
}

function anonymousCountSince(guestSessionId: string | null, ipKey: string, since: number): number {
  if (guestSessionId) {
    const row = rawDb
      .prepare(
        `SELECT COUNT(*) AS n
           FROM sifts
          WHERE user_id IS NULL
            AND guest_session_id = ?
            AND created_at >= ?`,
      )
      .get(guestSessionId, since) as { n: number } | undefined;
    return row?.n ?? 0;
  }

  const row = rawDb
    .prepare(
      `SELECT COUNT(*) AS n
         FROM sifts
        WHERE user_id IS NULL
          AND guest_session_id = ?
          AND created_at >= ?`,
    )
    .get(`ip:${ipKey}`, since) as { n: number } | undefined;
  return row?.n ?? 0;
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

  // 1 — active deepening lane. If the user was mid-thread, resume that before
  // asking about an older next step.
  let inProgress: {
    s: Sift;
    lastActivity: number;
    bookmark?: Bookmark | null;
    openSort?: boolean;
  } | null = null;
  for (const s of openThreads) {
    const turns = await storage.listTurns(s.id);
    if (!turns.length) continue;
    const lastActivity = Math.max(s.createdAt, ...turns.map((t) => t.createdAt));
    const latestTurn = turns[turns.length - 1];
    const hasRecentUserLane =
      latestTurn?.role === "user" ||
      latestTurn?.kind === "sort_prompt" ||
      Date.now() - lastActivity <= REENTRY_48H_MS;
    if (!hasRecentUserLane) continue;
    const bookmark = await storage.getBookmark(s.id);
    const openSort = Boolean(findOpenSortPrompt(turns));
    if (!inProgress || lastActivity > inProgress.lastActivity) {
      inProgress = { s, lastActivity, bookmark, openSort };
    }
  }
  if (inProgress) {
    const leftOff = inProgress.bookmark?.payload.lastLanded?.trim();
    return {
      prompt: inProgress.openSort
        ? "You were sorting signal from noise. Pick that thread back up?"
        : leftOff
          ? `You were mid-thread. Last place: ${leftOff}`
          : "You were mid-thread. Want to keep going from where it left off?",
      action: {
        type: "revisit",
        threadId: inProgress.s.id,
        threadTitle: threadTitleFromSiftCore(inProgress.s),
      },
    };
  }

  // 2 — overdue check-in (48h since last check-in)
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

  // 3 — next step never acted on (no check-ins, sift older than 24h)
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

  // 4 — low redundancy sift pointing at a closed prior (within ~24h)
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

  // 5 — open thread, no activity > 7 days
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

  // Wakes the app on Fly when auto-stopped; also usable if Supercronic is not running.
  app.post("/api/internal/jobs/daily-prompts", async (req, res) => {
    const secret = process.env.CRON_SECRET?.trim();
    const header = req.headers["x-cron-secret"];
    const provided = typeof header === "string" ? header : "";
    if (!secret || provided !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await runSendDailyPromptsJob();
    res.json(result);
  });

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

  function normalizeSupportProfile(input?: {
    mode?: SupportProfile["mode"] | null;
    startingSpace?: SupportProfile["startingSpace"] | null;
    theme?: SupportProfile["theme"] | null;
    primaryIntent?: SupportProfile["primaryIntent"] | null;
    supportStyle?: SupportProfile["supportStyle"] | null;
    completedAt?: string | null;
  } | null): SupportProfile | null {
    if (!input?.mode && !input?.startingSpace && !input?.theme && !input?.primaryIntent && !input?.supportStyle) return null;
    return supportProfileSchema.parse({
      mode: input.mode ?? undefined,
      startingSpace: input.startingSpace ?? undefined,
      theme: input.theme ?? undefined,
      primaryIntent: input.primaryIntent ?? undefined,
      supportStyle: input.supportStyle ?? undefined,
      completedAt: input.completedAt ?? new Date().toISOString(),
    });
  }

  function parseSupportProfile(raw: string | null): SupportProfile | null {
    if (!raw) return null;
    try {
      return supportProfileSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  // Serialize a User row into the public `Me` shape.
  function toMe(user: User): Me {
    return {
      id: user.id,
      handle: user.handle,
      email: user.email,
      phone: user.phone,
      contactMissing: !user.email && !user.phone,
      supportProfile: parseSupportProfile(user.supportProfile),
      memoryPreferences: parseMemoryPreferencesColumn(user.memoryPreferences),
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
      supportProfile: normalizeSupportProfile(parsed.data.supportProfile),
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

  app.post("/api/auth/forgot-passphrase", async (req, res) => {
    const parsed = forgotPassphraseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const handle = parsed.data.handle.toLowerCase();
    const user = await storage.getUserByHandle(handle);
    const message =
      "If that handle has an email on file, a reset link was issued.";
    if (!user?.email?.trim()) {
      console.info("[auth] forgot-passphrase skipped — no email on file", {
        handle,
      });
      return res.json({ ok: true, message });
    }
    const token = crypto.randomBytes(32).toString("hex");
    const now = Date.now();
    insertResetTokenStmt.run(token, user.id, now, now + 60 * 60 * 1000);
    const host = req.get("host") ?? "localhost:5173";
    const proto = req.protocol === "https" ? "https" : "http";
    const resetUrl = `${proto}://${host}/#/reset-passphrase?token=${token}`;
    console.info("[auth] passphrase reset link", { handle, resetUrl });
    const payload: { ok: true; message: string; devResetUrl?: string } = {
      ok: true,
      message,
    };
    if (process.env.NODE_ENV === "development") {
      payload.devResetUrl = resetUrl;
    }
    return res.json(payload);
  });

  app.post("/api/auth/reset-passphrase", async (req, res) => {
    const parsed = resetPassphraseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const row = readResetTokenStmt.get(parsed.data.token) as
      | { userId: number; expiresAt: number; usedAt: number | null }
      | undefined;
    if (!row || row.usedAt != null || row.expiresAt < Date.now()) {
      return res.status(400).json({ error: "This reset link is no longer valid." });
    }
    const hash = hashPassphrase(parsed.data.passphrase);
    updateUserPassphraseStmt.run(hash, row.userId);
    markResetTokenUsedStmt.run(Date.now(), parsed.data.token);
    return res.json({ ok: true });
  });

  app.post("/api/auth/logout", (req, res) => {
    const h = req.headers.authorization;
    if (h?.startsWith("Bearer ")) revokeToken(h.slice(7).trim());
    res.json({ ok: true });
  });

  app.delete("/api/auth/account", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const rows = rawDb
      .prepare(`SELECT id FROM sifts WHERE user_id = ?`)
      .all(userId) as Array<{ id: string }>;
    const ids = rows.map((row) => row.id);

    const tx = rawDb.transaction(() => {
      for (const id of ids) {
        rawDb.prepare(`DELETE FROM thread_turns WHERE sift_id = ?`).run(id);
        rawDb.prepare(`DELETE FROM thread_bookmarks WHERE sift_id = ?`).run(id);
        rawDb.prepare(`DELETE FROM checkins WHERE sift_id = ?`).run(id);
      }
      rawDb.prepare(`DELETE FROM feedback WHERE user_id = ?`).run(userId);
      rawDb.prepare(`DELETE FROM discernment_profiles WHERE user_id = ?`).run(userId);
      rawDb.prepare(`DELETE FROM sifts WHERE user_id = ?`).run(userId);
      rawDb.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
      rawDb.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
    });
    tx();
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

  app.post("/api/guest/claim", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const guestSessionId = readGuestSessionId(req);
    if (!guestSessionId) return res.json({ claimed: 0 });

    const result = rawDb
      .prepare(
        `UPDATE sifts
            SET user_id = ?
          WHERE user_id IS NULL
            AND guest_session_id = ?`,
      )
      .run(userId, guestSessionId);

    res.json({ claimed: result.changes ?? 0 });
  });

  app.patch("/api/auth/support-profile", requireAuth, async (req, res) => {
    const parsed = supportProfileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const userId = (req as any).userId as number;
    const updated = await storage.updateUserSupportProfile(userId, {
      supportProfile: normalizeSupportProfile(parsed.data),
    });
    if (!updated) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json({ me: toMe(updated) });
  });

  app.patch("/api/auth/memory-preferences", requireAuth, async (req, res) => {
    const parsed = memoryPreferencesUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const userId = (req as any).userId as number;
    const user = await storage.getUserById(userId);
    if (!user) return res.status(404).json({ error: "Account not found" });
    const current = parseMemoryPreferencesColumn(user.memoryPreferences);
    const next = memoryPreferencesSchema.parse({ ...current, ...parsed.data });
    const updated = await storage.updateUserMemoryPreferences(userId, next);
    if (!updated) return res.status(404).json({ error: "Account not found" });
    res.json({ me: toMe(updated) });
  });

  app.get("/api/me/notifications", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const user = await storage.getUserById(userId);
    if (!user) return res.status(404).json({ error: "Account not found" });
    const preferences = await storage.getNotificationPreferences(userId);
    res.json({
      preferences,
      featureEnabled: isDailyPromptEmailFeatureEnabled(),
      hourRange: { min: DAILY_PROMPT_HOUR_MIN, max: DAILY_PROMPT_HOUR_MAX },
      hasEmail: Boolean(user.email?.trim()),
    });
  });

  app.patch("/api/me/notifications", requireAuth, async (req, res) => {
    const parsed = notificationPreferencesUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const userId = (req as any).userId as number;
    const user = await storage.getUserById(userId);
    if (!user) return res.status(404).json({ error: "Account not found" });

    const current = await storage.getNotificationPreferences(userId);
    const patch: Partial<typeof current> = {};

    if (parsed.data.dailyPromptEmailEnabled !== undefined) {
      if (parsed.data.dailyPromptEmailEnabled && !user.email?.trim()) {
        return res.status(400).json({
          error: "Add an email to your profile before turning on daily prompt emails.",
        });
      }
      if (
        parsed.data.dailyPromptEmailEnabled &&
        !isDailyPromptEmailFeatureEnabled()
      ) {
        return res.status(503).json({
          error: "Daily prompt emails are not enabled on this server yet.",
        });
      }
      patch.dailyPromptEmailEnabled = parsed.data.dailyPromptEmailEnabled;
    }

    if (parsed.data.dailyPromptLocalHour !== undefined) {
      patch.dailyPromptLocalHour = parsed.data.dailyPromptLocalHour;
    }

    if (parsed.data.dailyPromptTimezone !== undefined) {
      patch.dailyPromptTimezone = parsed.data.dailyPromptTimezone;
    }

    if (parsed.data.pauseForDays === 7) {
      patch.dailyPromptPausedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
    }

    const enabling =
      patch.dailyPromptEmailEnabled === true ||
      (patch.dailyPromptEmailEnabled === undefined &&
        current.dailyPromptEmailEnabled);

    if (enabling && patch.dailyPromptEmailEnabled !== false) {
      const hour =
        patch.dailyPromptLocalHour ??
        current.dailyPromptLocalHour ??
        8;
      const tz =
        patch.dailyPromptTimezone ??
        current.dailyPromptTimezone;
      if (tz == null) {
        return res.status(400).json({
          error: "Choose a timezone before enabling daily prompt emails.",
        });
      }
      patch.dailyPromptLocalHour = hour;
      patch.dailyPromptTimezone = tz;
    }

    const preferences = await storage.upsertNotificationPreferences(userId, patch);
    res.json({
      preferences,
      featureEnabled: isDailyPromptEmailFeatureEnabled(),
      hourRange: { min: DAILY_PROMPT_HOUR_MIN, max: DAILY_PROMPT_HOUR_MAX },
      hasEmail: Boolean(user.email?.trim()),
    });
  });

  app.get("/api/auth/export", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const user = await storage.getUserById(userId);
    if (!user) return res.status(404).json({ error: "Account not found" });
    const sifts = await storage.listUserSiftsFull(userId);
    const sessions = await Promise.all(
      sifts.map(async (sift) => ({
        sift,
        bookmark: await storage.getBookmark(sift.id),
        turns: await storage.listTurns(sift.id),
        checkins: await storage.listCheckins(sift.id),
      })),
    );
    res.json({
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        handle: user.handle,
        email: user.email,
        phone: user.phone,
        supportProfile: parseSupportProfile(user.supportProfile),
        memoryPreferences: parseMemoryPreferencesColumn(user.memoryPreferences),
      },
      sessions,
    });
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
  app.get("/api/daily-prompt", async (req, res) => {
    const mood =
      typeof req.query.mood === "string" ? req.query.mood : undefined;

    const rawHour =
      typeof req.query.hour === "string" ? Number(req.query.hour) : NaN;
    const localHour =
      Number.isFinite(rawHour) && rawHour >= 0 && rawHour <= 23
        ? Math.floor(rawHour)
        : null;

    const rawPromptId =
      typeof req.query.promptId === "string"
        ? Number(req.query.promptId)
        : NaN;

    const userId = readToken(req);
    const themeCycleDay = currentThemeCycleDay();
    let hasPriorSift = false;
    let userKey: string;
    let recentSifts: ReturnType<typeof loadRecentSiftSignals> | undefined;

    if (userId) {
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(401).json({ error: "Session expired" });
      }
      hasPriorSift = countUserSifts(userId) > 0;
      userKey = `u:${userId}`;

      if (hasPriorSift) {
        recentSifts = loadRecentSiftSignals(userId);
      }
    } else {
      hasPriorSift = false;
      userKey = "anon";
    }

    if (Number.isFinite(rawPromptId)) {
      const fixed = getPromptById(Math.floor(rawPromptId));
      if (fixed) {
        return res.json({
          prompt: {
            id: fixed.id,
            text: fixed.text,
            type: fixed.type,
            outputLength: fixed.outputLength,
            requiresPriorSift: fixed.priorSiftRef,
            hasChoiceLogic: fixed.userChoiceLogic,
            usageNotes: fixed.usageNotes,
          },
          theme: { num: fixed.themeNum, name: fixed.themeName },
          themeCycleDay,
          hasPriorSift,
          appliedFilters: ["promptIdOverride"],
        });
      }
      return res.status(404).json({ error: "Prompt not found" });
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

async function persistOperatorArtifactForSift(
  siftId: string,
  input: string,
  authMode: SiftClientAuthMode | undefined,
) {
  try {
    const op = await runOperatorAnalysis(input, { authMode });
    rawDb
      .prepare(
        `UPDATE sifts
            SET artifact_type = ?,
                operator_artifact = ?,
                current_move = ?
          WHERE id = ?`,
      )
      .run(op.artifactType, JSON.stringify(op), op.currentMove ?? null, siftId);
    console.debug("[operator] artifact persisted:", op.artifactType);
  } catch (err: unknown) {
    console.warn("[operator] background runOperatorAnalysis failed", err);
  }
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
    const {
      input,
      inputMode,
      phase,
      intent,
      fragmentSort,
      skippedFragmentSort,
      forceAnalysis,
      metaSift,
      flowMode,
    } = parsed.data;

    // Crisis safeguard — before persistence, before LLM. If the input describes
    // suicide, self-harm, or intent to harm others, return a care response and
    // stop. Nothing is stored; nothing is sent to the model.
    if (screenForCrisis(input)) {
      return res.json({ type: "care" });
    }

    const auth = resolveSiftAuth(req);
    if (!auth) {
      return res.status(401).json({ error: "Not signed in" });
    }
    const userId = auth.userId;
    const guestSessionId = auth.guestSessionId;
    const guestSessionIdForStore = guestSessionId ?? `ip:${clientIpKey(req)}`;
    if (auth.anonymous) {
      const used = anonymousCountSince(
        guestSessionId,
        clientIpKey(req),
        Date.now() - anonymousSiftWindowMs,
      );
      if (used >= ANONYMOUS_SIFT_LIMIT) {
        return res.status(429).json({
          error: "Create a free space to keep going with Sift.",
          reason: "guest_limit",
        });
      }
    }
    const siftAuthMode: SiftClientAuthMode | undefined = auth.anonymous
      ? "server-api-key"
      : undefined;
    const userForMemory = userId ? await storage.getUserById(userId) : undefined;
    const memoryPreferences = parseMemoryPreferencesColumn(userForMemory?.memoryPreferences);
    const storedSupportProfile =
      userId && memoryPreferences.rememberTonePreferences
        ? parseSupportProfile(userForMemory?.supportProfile ?? null)
        : null;
    const supportProfile =
      storedSupportProfile ?? normalizeSupportProfile(parsed.data.supportProfile);

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

      const isWritingFlow = flowMode === "writing";
      const preSortContext = buildPreSortContext(
        fragmentSort,
        skippedFragmentSort,
      );
      let analysis: Analysis;
      let writingArtifact: WritingSiftArtifact | undefined;
      if (isWritingFlow) {
        writingArtifact = await runWritingAnalysis(input, {
          authMode: siftAuthMode,
        });
        analysis = writingArtifactToAnalysisFields(writingArtifact);
      } else {
        analysis = await runAnalysis(input, {
          preSortContext: preSortContext || undefined,
          metaSift: metaSift === true,
          authMode: siftAuthMode,
          phase,
          intent,
          supportProfile,
        });
      }

      // Output safeguard — scan every string in the model's response. If it
      // contains crisis-adjacent language (shouldn't, given the system prompt,
      // but we do not rely on that), discard the response entirely. Nothing is
      // persisted; the client surfaces the care screen.
      if (screenOutputForCrisis(analysis)) {
        console.warn("[crisis-screen] output tripped on /api/sift — discarding");
        return res.json({ type: "care" });
      }
      if (writingArtifact && screenOutputForCrisis(writingArtifact)) {
        console.warn("[crisis-screen] output tripped on writing sift — discarding");
        return res.json({ type: "care" });
      }

      const id = newId();

      const { mode, entrySignal } = isWritingFlow
        ? { mode: "personal" as const, entrySignal: "none" as const }
        : routeThread(input);
      // Operator artifact generation is additive. Keep it off the first-response
      // path so the user receives the primary Sift as soon as it is ready.
      const shouldPersistOperatorArtifact = mode === "operator";

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
        guestSessionId: auth.anonymous ? guestSessionIdForStore : guestSessionId,
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
        currentMove: null,
        closureCondition: null,
        artifactType: isWritingFlow ? "writing_sift" : null,
        operatorArtifact: isWritingFlow
          ? JSON.stringify(writingArtifact)
          : null,
        recurringSignal: recurring.detected ? 1 : 0,
        recurringTheme: recurring.theme,
        redundancyHintLevel:
          redundancyCheck.level === "low" ? "low" : null,
        redundancyPriorSiftId:
          redundancyCheck.level === "low"
            ? redundancyCheck.priorSiftId
            : null,
        metaSift: metaSift === true ? 1 : null,
        uiMode: supportProfile?.mode ?? null,
        environment: supportProfile?.startingSpace ?? null,
        supportProfileSnapshot: supportProfile ? JSON.stringify(supportProfile) : null,
        claritySummary: null,
        memoryMode: memoryPreferences.clarityOnly || !memoryPreferences.storeRawTranscript ? "clarity_only" : "full",
        pinned: 0,
        transcriptExpiresAt: null,
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

      if (shouldPersistOperatorArtifact) {
        void persistOperatorArtifactForSift(id, input, siftAuthMode);
      }

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
        artifactType: isWritingFlow ? "writing_sift" : null,
        ...(isWritingFlow && writingArtifact
          ? { flowMode: "writing" as const, writingArtifact }
          : {}),
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

  app.get("/api/library", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const user = await storage.getUserById(userId);
    if (!user) return res.status(404).json({ error: "Account not found" });
    const memoryPreferences = parseMemoryPreferencesColumn(user.memoryPreferences);
    const rows = await storage.listUserSiftsFull(userId);
    const items: LibrarySiftItem[] = [];
    for (const sift of rows) {
      const bookmark = await storage.getBookmark(sift.id);
      items.push(libraryItemFor({ sift, bookmark }));
    }
    const recurringThemes = memoryPreferences.rememberThemes
      ? recurringThemesFor(items)
      : [];
    const payload: LibraryResponse = { items, recurringThemes, memoryPreferences };
    res.json(payload);
  });

  app.get("/api/library/:id", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const siftId = String(req.params.id);
    const sift = await storage.getSift(siftId);
    if (!sift) return res.status(404).json({ error: "Not found" });
    if (sift.userId !== userId) {
      return res.status(403).json({ error: "Not your sift" });
    }

    if (sift.transcriptExpiresAt && sift.transcriptExpiresAt <= Date.now()) {
      await storage.updateSessionMemory(siftId, userId, { memoryMode: "clarity_only" });
    }
    const currentSift = (await storage.getSift(siftId)) ?? sift;
    const user = await storage.getUserById(userId);
    const memoryPreferences = parseMemoryPreferencesColumn(user?.memoryPreferences);
    const [bookmark, turns, allSifts] = await Promise.all([
      storage.getBookmark(siftId),
      currentSift.memoryMode === "clarity_only" ? Promise.resolve([]) : storage.listTurns(siftId),
      storage.listUserSiftsFull(userId),
    ]);
    const item = libraryItemFor({ sift: currentSift, bookmark });
    const themes = parseThemesColumn(currentSift.themes);
    const tagSet = new Set(item.tags.map((tag) => tag.toLowerCase()));
    const related: LibrarySiftItem[] = [];
    if (memoryPreferences.allowRelatedSuggestions) {
      for (const other of allSifts) {
        if (other.id === currentSift.id) continue;
        const otherBookmark = await storage.getBookmark(other.id);
        const otherItem = libraryItemFor({ sift: other, bookmark: otherBookmark });
        if (otherItem.tags.some((tag) => tagSet.has(tag.toLowerCase()))) {
          related.push(otherItem);
        }
        if (related.length >= 3) break;
      }
    }

    const detail: LibrarySiftDetail = {
      ...item,
      input: currentSift.memoryMode === "clarity_only" ? "Raw opening input was not retained for this session." : currentSift.input,
      themes,
      reflection: currentSift.reflection,
      transcript: turns,
      related,
    };
    res.json({ item: detail });
  });

  app.patch("/api/library/:id/memory", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    const parsed = updateSessionMemorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const siftId = String(req.params.id);
    if (parsed.data.memoryMode === "do_not_remember") {
      const ok = await storage.deleteSift(siftId, userId);
      if (!ok) return res.status(404).json({ error: "Not found" });
      return res.json({ deleted: true });
    }
    const updated = await storage.updateSessionMemory(siftId, userId, parsed.data);
    if (!updated) return res.status(404).json({ error: "Not found" });
    const bookmark = await storage.getBookmark(siftId);
    return res.json({ item: libraryItemFor({ sift: updated, bookmark }) });
  });

  app.delete("/api/library", requireAuth, async (req, res) => {
    const userId = (req as any).userId as number;
    await storage.deleteAllHistory(userId);
    res.json({ ok: true });
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
      ...(row.artifactType === "writing_sift" && row.operatorArtifact
        ? (() => {
            try {
              const wa = writingSiftArtifactSchema.parse(
                JSON.parse(row.operatorArtifact),
              );
              return {
                flowMode: "writing" as const,
                writingArtifact: wa,
              };
            } catch {
              return {};
            }
          })()
        : {}),
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
      const feedbackRaw =
        typeof parsed.data.feedback === "string"
          ? parsed.data.feedback.trim()
          : "";
      if (feedbackRaw) {
        const merged = `${row.input}\n\nStep feedback:\n${feedbackRaw}`;
        if (screenForCrisis(merged)) {
          return res.json({ type: "care" });
        }
      }
      const revised = await runStepRevision({
        input: row.input,
        coreIntent: row.coreIntent,
        currentStep: row.nextStep,
        variant: parsed.data.variant,
        feedback: feedbackRaw || undefined,
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
  app.post("/api/sift/:id/deepen", async (req, res) => {
    const parsed = deepenRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      });
    }
    const auth = resolveSiftAuth(req);
    if (!auth) {
      return res.status(401).json({ error: "Not signed in" });
    }
    const userId = auth.userId;
    const siftAuthMode: SiftClientAuthMode | undefined = auth.anonymous
      ? "server-api-key"
      : undefined;
    const userForMemory = userId ? await storage.getUserById(userId) : undefined;
    const memoryPreferences = parseMemoryPreferencesColumn(userForMemory?.memoryPreferences);
    const storedSupportProfile =
      userId && memoryPreferences.rememberTonePreferences
        ? parseSupportProfile(userForMemory?.supportProfile ?? null)
        : null;
    const supportProfile =
      storedSupportProfile ?? normalizeSupportProfile(parsed.data.supportProfile);
    const siftId = String(req.params.id);
    const sift = await storage.getSift(siftId);
    if (!sift) return res.status(404).json({ error: "Not found" });
    if (sift.userId != null && sift.userId !== userId) {
      return res.status(403).json({ error: "Not your sift" });
    }
    if (
      sift.userId == null &&
      sift.guestSessionId &&
      sift.guestSessionId !== (auth.guestSessionId ?? `ip:${clientIpKey(req)}`)
    ) {
      return res.status(403).json({ error: "Not your guest session" });
    }

    if (parsed.data.mode === "summary") {
      try {
        const turns = await storage.listTurns(siftId);
        const summary = await runThreadSummary({
          sift,
          turns,
          clientTranscript: parsed.data.clientTranscript,
          authMode: siftAuthMode,
          supportProfile,
        });
        if (screenOutputForCrisis(summary)) {
          console.warn(
            "[crisis-screen] output tripped on /api/sift/:id/deepen summary — discarding",
          );
          return res.json({ type: "care" });
        }
        await storage.updateSiftClaritySummary(siftId, JSON.stringify(summary));
        const payload: DeepenResponse = { type: "summary", summary };
        return res.json(payload);
      } catch (err: any) {
        console.error("summary error", err);
        return res.status(500).json({
          error: "Could not summarize that right now.",
        });
      }
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
    if (screenForCrisis(parsed.data.text!)) {
      const payload: DeepenResponse = { type: "care" };
      return res.json(payload);
    }

    try {
      // Append the user turn first so it survives even if the LLM call fails.
      const userTurn = await storage.appendTurn({
        siftId,
        role: "user",
        kind: "message",
        payload: JSON.stringify({ text: parsed.data.text! }),
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
        parsed.data.phase !== "warmup" &&
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
        latestUserText: parsed.data.text!,
        authMode: siftAuthMode,
        phase: parsed.data.phase,
        intent: parsed.data.intent,
        supportProfile,
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

  registerKokoroTtsProxy(app, requireAuth);

  return httpServer;
}
