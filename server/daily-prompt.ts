// Daily prompt selection from the Sift 300-prompt library.
//
// Library structure (see server/data/prompts.json):
//   300 prompts · 10 themes × 30 days each · arranged Day 1–300.
//   Each prompt has: id, day, themeNum, themeName, type, text, outputLength,
//   priorSiftRef (bool), userChoiceLogic (bool), usageNotes.
//
// Selection rules (smallest possible implementation):
//   1. Pick the theme from the user's theme-cycle day (each theme = 30 days,
//      cycle length = 300 days, rotates forever).
//   2. Within that theme, filter by:
//        - if !hasPriorSift: drop prompts where priorSiftRef === true
//          (those assume a callback to earlier reflection).
//        - optional mood: soft filter to compatible prompt types. If the
//          filter empties the pool, fall back to the unfiltered theme pool.
//   3. Deterministic pick: stable hash of (userKey, themeCycleDay) % pool.
//      Same user + same day -> same prompt, reroll-resistant.
import rawPrompts from "./data/prompts.json";

export type Prompt = {
  id: number;
  day: number;
  themeNum: number;
  themeName: string;
  type: string;
  text: string;
  outputLength: "SHORT" | "MEDIUM" | "LONG";
  priorSiftRef: boolean;
  userChoiceLogic: boolean;
  usageNotes: string | null;
};

const PROMPTS = rawPrompts as Prompt[];

const DAYS_PER_THEME = 30;
const TOTAL_DAYS = 300;
const TOTAL_THEMES = 10;

// Group prompts by themeNum once at load time.
const BY_THEME: Record<number, Prompt[]> = {};
for (const p of PROMPTS) {
  (BY_THEME[p.themeNum] ||= []).push(p);
}

// Moods map to compatible prompt types. A mood narrows the candidate pool
// to types that match the user's current register. The map is intentionally
// small and forgiving; unknown moods are ignored.
const MOOD_TO_TYPES: Record<string, string[]> = {
  // Low-energy / reflective → shorter, gentler entry points.
  tired: ["Energy scan", "Observation invitation", "Pattern interrupt"],
  heavy: ["Observation invitation", "Energy scan", "Pattern interrupt"],
  anxious: ["Energy scan", "Observation invitation", "Pattern interrupt"],
  // Centered / awake → deeper introspection.
  calm: [
    "Introspective question",
    "Observation invitation",
    "Forecast/intention-setting",
  ],
  clear: [
    "Introspective question",
    "Forecast/intention-setting",
    "Choice logic",
    "User choice logic",
  ],
  // Forward-leaning → action / decision prompts.
  restless: ["Micro-challenge", "Pattern interrupt", "Forecast/intention-setting"],
  stuck: ["Pattern interrupt", "Choice logic", "User choice logic", "Micro-challenge"],
  curious: [
    "Introspective question",
    "Pattern interrupt",
    "Observation invitation",
  ],
};

export type DailyPromptInput = {
  /** 0-based day inside the 300-day cycle. Anonymous users should pass UTC day-of-year or similar. */
  themeCycleDay: number;
  /** Whether the caller has any prior sifts on record. When false, Prior-Sift-Ref prompts are excluded. */
  hasPriorSift: boolean;
  /** Optional mood key (see MOOD_TO_TYPES). Unknown values are ignored. */
  mood?: string | null;
  /** Stable per-caller key for deterministic tiebreak (e.g., userId or anon-session key). */
  userKey?: string | null;
};

export type DailyPromptResult = {
  prompt: Prompt;
  themeNum: number;
  themeName: string;
  themeCycleDay: number;
  /** Human-readable list of filters that were applied to get here. */
  appliedFilters: string[];
};

/** Small, stable string hash. Deterministic across Node versions. */
function hashKey(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Normalize day input into [0, TOTAL_DAYS). */
function normalizeCycleDay(day: number): number {
  const n = Number.isFinite(day) ? Math.floor(day) : 0;
  const mod = ((n % TOTAL_DAYS) + TOTAL_DAYS) % TOTAL_DAYS;
  return mod;
}

/** Theme number (1–10) for a given cycle day. */
export function themeForDay(themeCycleDay: number): number {
  const day = normalizeCycleDay(themeCycleDay);
  return Math.floor(day / DAYS_PER_THEME) + 1; // 1-indexed
}

export function selectDailyPrompt(input: DailyPromptInput): DailyPromptResult {
  const day = normalizeCycleDay(input.themeCycleDay);
  const themeNum = themeForDay(day);
  const themePool = BY_THEME[themeNum] ?? [];
  const applied: string[] = [`theme:${themeNum}`];

  // 1. Prior-sift gate. Without prior sifts, callbacks make no sense.
  let pool = input.hasPriorSift
    ? themePool
    : themePool.filter((p) => !p.priorSiftRef);
  if (!input.hasPriorSift && pool.length !== themePool.length) {
    applied.push("excludedPriorSiftRefs");
  }

  // 2. Optional mood filter. Soft — fall back if it empties the pool.
  const mood = (input.mood || "").trim().toLowerCase();
  const moodTypes = mood ? MOOD_TO_TYPES[mood] : undefined;
  if (moodTypes && moodTypes.length) {
    const moodPool = pool.filter((p) => moodTypes.includes(p.type));
    if (moodPool.length > 0) {
      pool = moodPool;
      applied.push(`mood:${mood}`);
    } else {
      applied.push(`mood:${mood}:fallback`);
    }
  }

  // 3. Deterministic pick.
  // Safety net: if the pool is somehow empty, fall back to the theme's first day.
  if (pool.length === 0) {
    pool = themePool.length ? themePool : PROMPTS;
    applied.push("emptyPoolFallback");
  }

  const userKey = (input.userKey ?? "anon").toString();
  const hash = hashKey(`${userKey}|${day}`);
  const prompt = pool[hash % pool.length];

  return {
    prompt,
    themeNum,
    themeName: prompt.themeName,
    themeCycleDay: day,
    appliedFilters: applied,
  };
}

/** Exposed for tests / debugging. */
export const __internal = {
  PROMPTS,
  DAYS_PER_THEME,
  TOTAL_DAYS,
  TOTAL_THEMES,
  MOOD_TO_TYPES,
  hashKey,
};
