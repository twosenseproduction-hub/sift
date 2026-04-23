// Daily prompt selection from the Sift 300-prompt library.
//
// Library structure (see server/data/prompts.json):
//   300 prompts · 10 themes × 30 days each · arranged Day 1–300.
//   Each prompt has: id, day, themeNum, themeName, type, text, outputLength,
//   priorSiftRef (bool), userChoiceLogic (bool), usageNotes.
//
// Selection pipeline (pattern-aware — see SIGNALS below):
//   1. Pick a theme for this call. If the caller provides recent-sift
//      patterns (RecentSiftSignal[]), bias toward themes the user keeps
//      circling. Otherwise use the pure calendar cycle (unchanged behavior).
//   2. Filter by priorSiftRef (unless the caller has prior sifts).
//   3. Filter by time-of-day (morning → forecast/energy, evening → reflection).
//   4. Filter by mood if supplied.
//   5. If the last sift was within 36h and its dominant theme matches the
//      chosen theme, prefer a priorSiftRef follow-up prompt when available.
//   6. Deterministic pick: hash(userKey, cycleDay) % pool. Same user + same
//      day + same signals → same prompt (reroll-resistant).
//
// The anonymous / no-signal code path is unchanged from the original
// implementation: themeForDay(day) is still a pure function of the cycle day.
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

// Moods → compatible prompt types. A mood narrows the candidate pool.
const MOOD_TO_TYPES: Record<string, string[]> = {
  tired: ["Energy scan", "Observation invitation", "Pattern interrupt"],
  heavy: ["Observation invitation", "Energy scan", "Pattern interrupt"],
  anxious: ["Energy scan", "Observation invitation", "Pattern interrupt"],
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
  restless: ["Micro-challenge", "Pattern interrupt", "Forecast/intention-setting"],
  stuck: ["Pattern interrupt", "Choice logic", "User choice logic", "Micro-challenge"],
  curious: [
    "Introspective question",
    "Pattern interrupt",
    "Observation invitation",
  ],
};

// Keyword fingerprints for the 10 library themes. Used to score free-form
// sift text (themes[].title + summary + coreIntent + nextStep) against the
// canonical themes. Keep lists short and high-signal — overfitting a theme
// to a common word (e.g. "time" on Career) pollutes scoring.
const THEME_KEYWORDS: Record<number, string[]> = {
  1: [
    "career",
    "job",
    "work",
    "role",
    "boss",
    "manager",
    "promotion",
    "quit",
    "resign",
    "interview",
    "coworker",
    "colleague",
    "office",
    "salary",
    "raise",
  ],
  2: [
    "relationship",
    "partner",
    "spouse",
    "husband",
    "wife",
    "boyfriend",
    "girlfriend",
    "friend",
    "family",
    "mom",
    "dad",
    "mother",
    "father",
    "sibling",
    "conflict",
    "trust",
    "intimacy",
    "breakup",
  ],
  3: [
    "growth",
    "identity",
    "becoming",
    "version of myself",
    "who i am",
    "values",
    "progress",
    "change",
    "evolve",
    "learning",
    "self",
  ],
  4: [
    "energy",
    "tired",
    "exhausted",
    "sleep",
    "rest",
    "burnt out",
    "burnout",
    "pace",
    "bandwidth",
    "capacity",
    "drained",
    "rhythm",
    "morning",
    "today",
  ],
  5: [
    "creative",
    "creativity",
    "art",
    "write",
    "writing",
    "project",
    "idea",
    "ideas",
    "make",
    "build",
    "expression",
    "inspiration",
    "block",
  ],
  6: [
    "money",
    "finance",
    "financial",
    "spend",
    "spending",
    "save",
    "savings",
    "debt",
    "budget",
    "afford",
    "income",
    "bills",
    "invest",
    "scarcity",
    "abundance",
  ],
  7: [
    "overwhelm",
    "overwhelmed",
    "too much",
    "busy",
    "mental load",
    "to-do",
    "todo",
    "tasks",
    "juggling",
    "scattered",
    "stress",
    "stressed",
    "load",
    "pressure",
  ],
  8: [
    "parent",
    "parenting",
    "kid",
    "kids",
    "child",
    "children",
    "son",
    "daughter",
    "legacy",
    "family line",
    "generation",
    "pass on",
    "raise",
  ],
  9: [
    "shadow",
    "fear",
    "shame",
    "guilt",
    "jealous",
    "jealousy",
    "anger",
    "resent",
    "resentment",
    "avoid",
    "avoidance",
    "hide",
    "hiding",
    "dark",
    "ugly",
  ],
  10: [
    "decide",
    "decision",
    "choice",
    "choose",
    "unclear",
    "uncertain",
    "uncertainty",
    "stuck",
    "direction",
    "clarity",
    "clear",
    "either/or",
    "crossroads",
  ],
};

/** Signal from one of the user's recent sifts. Everything optional. */
export type RecentSiftSignal = {
  /** Unix ms when the sift was created. */
  createdAt: number;
  /** AI-generated theme titles attached to the sift (e.g. "Fear of pressure"). */
  themeTitles?: string[];
  /** Freeform text blob we can scan for keywords (coreIntent + nextStep). */
  text?: string;
};

export type DailyPromptInput = {
  /** 0-based day inside the 300-day cycle. Anon callers pass calendar-UTC day. */
  themeCycleDay: number;
  /** Whether the caller has any prior sifts. Gates priorSiftRef prompts. */
  hasPriorSift: boolean;
  /** Optional mood key (see MOOD_TO_TYPES). Unknown values are ignored. */
  mood?: string | null;
  /** Stable per-caller key for deterministic tiebreak. */
  userKey?: string | null;
  /** The user's last ~30 days of sifts, newest first. Optional. */
  recentSifts?: RecentSiftSignal[];
  /** Unix ms "now"; defaults to Date.now(). Override for tests. */
  nowMs?: number;
  /** Caller's local hour 0–23. If omitted, no time-of-day bias applies. */
  localHour?: number | null;
};

export type DailyPromptResult = {
  prompt: Prompt;
  themeNum: number;
  themeName: string;
  themeCycleDay: number;
  /** Transparency trail of which rules fired. */
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

function normalizeCycleDay(day: number): number {
  const n = Number.isFinite(day) ? Math.floor(day) : 0;
  return ((n % TOTAL_DAYS) + TOTAL_DAYS) % TOTAL_DAYS;
}

/** Theme number (1–10) for a given calendar cycle day. */
export function themeForDay(themeCycleDay: number): number {
  const day = normalizeCycleDay(themeCycleDay);
  return Math.floor(day / DAYS_PER_THEME) + 1; // 1-indexed
}

/**
 * Score a single text blob against each of the 10 themes.
 * Returns a { [themeNum]: score } map where score counts keyword hits.
 * Word-boundary matching to avoid e.g. "art" matching "start".
 */
function scoreTextAgainstThemes(text: string): Record<number, number> {
  const scores: Record<number, number> = {};
  if (!text) return scores;
  const lower = text.toLowerCase();
  for (const [numStr, keywords] of Object.entries(THEME_KEYWORDS)) {
    const themeNum = Number(numStr);
    let s = 0;
    for (const kw of keywords) {
      // Word-boundary match. Escape punctuation in multi-word keywords.
      const escaped = kw.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "g");
      const m = lower.match(re);
      if (m) s += m.length;
    }
    if (s > 0) scores[themeNum] = s;
  }
  return scores;
}

/** Aggregate theme weights across a user's recent sifts with time decay. */
function computeThemeWeights(
  sifts: RecentSiftSignal[] | undefined,
  nowMs: number,
): Record<number, number> {
  const weights: Record<number, number> = {};
  if (!sifts || sifts.length === 0) return weights;
  const HALF_LIFE_DAYS = 14;
  const HALF_LIFE_MS = HALF_LIFE_DAYS * 24 * 60 * 60 * 1000;
  for (const s of sifts) {
    const blob = [(s.themeTitles || []).join(" "), s.text || ""]
      .join(" ")
      .trim();
    if (!blob) continue;
    const scores = scoreTextAgainstThemes(blob);
    // Exponential decay: a sift from 14 days ago counts ~half, 28 days ~quarter.
    const ageMs = Math.max(0, nowMs - s.createdAt);
    const decay = Math.pow(0.5, ageMs / HALF_LIFE_MS);
    for (const [k, v] of Object.entries(scores)) {
      weights[Number(k)] = (weights[Number(k)] || 0) + v * decay;
    }
  }
  return weights;
}

/** Return the dominant theme number from a weights map, or null. */
function topTheme(weights: Record<number, number>): number | null {
  let best: number | null = null;
  let bestScore = 0;
  for (const [k, v] of Object.entries(weights)) {
    if (v > bestScore) {
      bestScore = v;
      best = Number(k);
    }
  }
  return best;
}

/**
 * Pick the theme for this call. Pattern-aware but still mostly calendar:
 *   - Always include the calendar theme in the candidate set.
 *   - If the user has strong pattern signals (top theme score ≥ MIN_SIGNAL),
 *     occasionally substitute their dominant theme instead.
 *   - We use a deterministic coin-flip from (userKey, day) so the choice
 *     is stable for the whole day but varies user-to-user and day-to-day.
 */
function pickTheme(
  cycleDay: number,
  weights: Record<number, number>,
  userKey: string,
  applied: string[],
): number {
  const calendarTheme = themeForDay(cycleDay);
  const top = topTheme(weights);
  const topScore = top != null ? weights[top] : 0;
  const MIN_SIGNAL = 2; // need at least 2 weighted keyword hits to bias

  if (top == null || topScore < MIN_SIGNAL) {
    applied.push(`theme:${calendarTheme}:calendar`);
    return calendarTheme;
  }
  if (top === calendarTheme) {
    // Calendar and pattern agree — reinforce.
    applied.push(`theme:${calendarTheme}:patternAligned`);
    return calendarTheme;
  }

  // Deterministic 50/50 split between calendar and pattern theme, keyed off
  // (userKey, day). Users with stronger patterns still get variety — half
  // the time they see their pattern theme, half the time the calendar
  // theme keeps them from fixating.
  const coin = hashKey(`theme|${userKey}|${cycleDay}`) % 2;
  if (coin === 0) {
    applied.push(`theme:${top}:pattern`);
    return top;
  }
  applied.push(`theme:${calendarTheme}:calendarOverPattern`);
  return calendarTheme;
}

/**
 * Time-of-day bias — soft filter, falls back if it empties the pool.
 *   Morning (5–11): forecast, energy scan, intention
 *   Evening (18–23): reflection, observation, introspection
 *   Midday (12–17): anything (no filter)
 *   Late night (0–4): gentler, reflective
 */
function applyTimeOfDay(
  pool: Prompt[],
  localHour: number | null | undefined,
  applied: string[],
): Prompt[] {
  if (localHour == null || !Number.isFinite(localHour)) return pool;
  const h = Math.floor(localHour) % 24;
  let preferred: string[] | null = null;
  let tag = "";
  if (h >= 5 && h < 12) {
    preferred = ["Forecast/intention-setting", "Energy scan", "Micro-challenge"];
    tag = "morning";
  } else if (h >= 18 && h < 24) {
    preferred = [
      "Introspective question",
      "Observation invitation",
      "Pattern interrupt",
    ];
    tag = "evening";
  } else if (h >= 0 && h < 5) {
    preferred = ["Observation invitation", "Introspective question"];
    tag = "lateNight";
  }
  if (!preferred) return pool;
  const filtered = pool.filter((p) => preferred!.includes(p.type));
  if (filtered.length > 0) {
    applied.push(`time:${tag}`);
    return filtered;
  }
  applied.push(`time:${tag}:fallback`);
  return pool;
}

export function selectDailyPrompt(input: DailyPromptInput): DailyPromptResult {
  const day = normalizeCycleDay(input.themeCycleDay);
  const userKey = (input.userKey ?? "anon").toString();
  const nowMs = input.nowMs ?? Date.now();
  const applied: string[] = [];

  // ---- 1. Theme (calendar, possibly biased by pattern) ----
  const weights = computeThemeWeights(input.recentSifts, nowMs);
  const themeNum = pickTheme(day, weights, userKey, applied);
  const themePool = BY_THEME[themeNum] ?? [];
  let pool = themePool;

  // ---- 2. Prior-sift gate ----
  if (!input.hasPriorSift) {
    const filtered = pool.filter((p) => !p.priorSiftRef);
    if (filtered.length > 0 && filtered.length !== pool.length) {
      applied.push("excludedPriorSiftRefs");
    }
    pool = filtered.length > 0 ? filtered : pool;
  }

  // ---- 3. Follow-up bias: if last sift was recent and shares this theme,
  //         and we DO have prior sifts, nudge toward a priorSiftRef prompt. ----
  if (
    input.hasPriorSift &&
    input.recentSifts &&
    input.recentSifts.length > 0
  ) {
    const last = input.recentSifts[0];
    const ageH = (nowMs - last.createdAt) / (60 * 60 * 1000);
    if (ageH >= 0 && ageH <= 36) {
      const lastText = [(last.themeTitles || []).join(" "), last.text || ""]
        .join(" ")
        .trim();
      const lastScores = scoreTextAgainstThemes(lastText);
      const lastTop = topTheme(lastScores);
      if (lastTop === themeNum) {
        const followUps = pool.filter((p) => p.priorSiftRef);
        if (followUps.length > 0) {
          pool = followUps;
          applied.push("followUpAfterLastSift");
        }
      }
    }
  }

  // ---- 4. Time-of-day bias ----
  pool = applyTimeOfDay(pool, input.localHour, applied);

  // ---- 5. Mood filter (soft) ----
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

  // ---- 6. Safety net ----
  if (pool.length === 0) {
    pool = themePool.length ? themePool : PROMPTS;
    applied.push("emptyPoolFallback");
  }

  // ---- 7. Deterministic pick ----
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

export const __internal = {
  PROMPTS,
  DAYS_PER_THEME,
  TOTAL_DAYS,
  TOTAL_THEMES,
  MOOD_TO_TYPES,
  THEME_KEYWORDS,
  hashKey,
  scoreTextAgainstThemes,
  computeThemeWeights,
  topTheme,
};
