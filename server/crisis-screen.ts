// Crisis screen — a conservative but wide-cast filter on two surfaces:
//
//   1. INPUT  (screenForCrisis)  — every piece of free-form text the user
//      submits (main sift, check-in note, voice transcript). Runs BEFORE
//      persistence and BEFORE the LLM call. If it trips, the server returns
//      a care response; nothing is stored, nothing is sent to the model.
//
//   2. OUTPUT (screenOutputForCrisis) — every piece of text the LLM returns
//      before it is persisted or shown to the user. If the model ever emits
//      crisis-adjacent language (suggesting self-harm, romanticizing death,
//      validating suicidal ideation, proposing violent actions), we discard
//      the entire response and surface the care screen instead.
//
// Policy: zero tolerance for nudging anyone toward self-harm or harm-to-others.
// We prefer false positives (paired with a gentle "this wasn't what I meant"
// escape hatch on the client) over any false negative that puts the user in
// harm's way.
//
// The phrase list lives server-side only — it is never shipped in the client
// bundle.

// Normalize: lowercase, collapse whitespace, strip common punctuation that
// sits between words ("kill-myself", "kill_myself", "kill.myself"). Leaves
// apostrophes alone so "i'm" / "don't" still match.
function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[._\-/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// --- INPUT patterns ---
// Word boundaries (\b) keep benign substrings from tripping the screen.
// Optional wiggle like \s+ lets "kill  myself" / "kill myself" both match.
// Moderately strict — some over-triggering is acceptable.
const INPUT_PATTERNS: RegExp[] = [
  // --- Direct suicidal ideation ---
  /\bkill(?:ing)?\s+my ?self\b/,
  /\bkys\b/,
  /\bk\s*m\s*s\b/, // "k m s" sometimes typed as an evasion
  /\bend(?:ing)?\s+my\s+life\b/,
  /\bend(?:ing)?\s+it\s+all\b/,
  /\btake\s+my\s+own\s+life\b/,
  /\btaking\s+my\s+own\s+life\b/,
  /\bcommit(?:ting)?\s+suicide\b/,
  /\bsuicide\b/,
  /\bsuicidal\b/,
  /\bwant(?:ing)?\s+to\s+die\b/,
  /\bwish(?:ing)?\s+(?:i\s+(?:was|were)|i'?d\s+be)\s+dead\b/,
  /\bwish\s+i\s+(?:was|were)\s+dead\b/,
  /\bwish\s+i\s+didn'?t\s+exist\b/,
  /\bwish\s+i\s+was\s+never\s+born\b/,
  /\bbetter\s+off\s+(?:dead|without\s+me)\b/,
  /\bworld\s+(?:is|would\s+be)\s+better\s+without\s+me\b/,
  /\bno\s+(?:reason|point)\s+to\s+(?:live|be\s+here|go\s+on)\b/,
  /\bdon'?t\s+want\s+to\s+(?:live|be\s+here|exist|wake\s+up|be\s+alive)\b/,
  /\bdon'?t\s+see\s+the\s+point\s+(?:of|in)\s+(?:living|life|being\s+here)\b/,
  /\bwant\s+to\s+disappear\s+forever\b/,
  /\bwant\s+to\s+vanish\s+forever\b/,
  /\bcan'?t\s+go\s+on\s+(?:like\s+this|anymore)\b/,
  /\bcan'?t\s+do\s+this\s+anymore\b/, // broader; acceptable over-trigger
  /\bi\s+give\s+up\s+on\s+(?:life|living)\b/,
  /\bready\s+to\s+die\b/,
  /\btired\s+of\s+(?:living|being\s+alive)\b/,
  /\blife\s+(?:is|isn'?t)\s+worth\s+(?:it|living)\b/,
  /\bnot\s+worth\s+living\b/,

  // --- Method / planning language ---
  /\bhang\s+my ?self\b/,
  /\boverdose\b/,
  /\bjump\s+off\b/,
  /\bshoot\s+my ?self\b/,
  /\bpills\s+to\s+(?:end|kill|die)\b/,
  /\bfinal\s+plan\b/,
  /\bsuicide\s+(?:note|plan|pact)\b/,
  /\bgoodbye\s+note\b/,
  /\bleave\s+a\s+note\b/,

  // --- Self-harm ---
  /\bhurt(?:ing)?\s+my ?self\b/,
  /\bharm(?:ing)?\s+my ?self\b/,
  /\bself[-\s]?harm(?:ing)?\b/,
  /\bcut(?:ting)?\s+my ?self\b/,
  /\bburn(?:ing)?\s+my ?self\b/,
  /\bstarve\s+my ?self\b/,
  /\bpunish\s+my ?self\s+(?:by|with)\b/,

  // --- Harm to others ---
  /\bkill(?:ing)?\s+(?:him|her|them|someone|everyone|people|my\s+\w+)\b/,
  /\bhurt(?:ing)?\s+(?:him|her|them|someone|everyone|people|my\s+\w+)\b/,
  /\bharm(?:ing)?\s+(?:him|her|them|someone|everyone|people|my\s+\w+)\b/,
  /\bshoot(?:ing)?\s+up\b/, // mass-violence coded phrase
  /\bwant\s+to\s+hurt\s+(?:someone|them|him|her|people)\b/,
  /\bwant\s+to\s+kill\s+(?:someone|them|him|her|people)\b/,
  /\bgoing\s+to\s+(?:hurt|kill)\s+(?:someone|them|him|her|people|everyone)\b/,
  /\bmake\s+them\s+pay\s+with\s+(?:blood|their\s+life|violence)\b/,
];

export function screenForCrisis(text: string): boolean {
  if (typeof text !== "string") return false;
  const normalized = normalize(text);
  if (!normalized) return false;
  for (const re of INPUT_PATTERNS) {
    if (re.test(normalized)) return true;
  }
  return false;
}

// --- OUTPUT patterns ---
// Applied to anything the LLM returns before it reaches persistence or the
// user. These are intentionally broader and stricter than the input screen:
// the LLM must NEVER suggest, validate, romanticize, or propose self-harm,
// suicide, or violence toward others — even as a "next step", a "reflection",
// or an observation. We also catch generic "next step" actions that involve
// hurting/killing/ending.
const OUTPUT_PATTERNS: RegExp[] = [
  // Any explicit self-harm / suicide verbs tied to self
  /\bkill(?:ing)?\s+(?:your ?self|my ?self|themselves?|him ?self|her ?self|one ?self)\b/,
  /\bhurt(?:ing)?\s+(?:your ?self|my ?self|themselves?|him ?self|her ?self|one ?self)\b/,
  /\bharm(?:ing)?\s+(?:your ?self|my ?self|themselves?|him ?self|her ?self|one ?self)\b/,
  /\bend(?:ing)?\s+(?:your|their|his|her|one'?s)\s+life\b/,
  /\btake\s+(?:your|their|his|her|one'?s)\s+(?:own\s+)?life\b/,
  /\bcommit(?:ting)?\s+suicide\b/,
  /\bsuicide\b/,
  /\bsuicidal\b/,
  /\bself[-\s]?harm(?:ing)?\b/,
  /\bcut(?:ting)?\s+(?:your ?self|my ?self)\b/,
  /\bstarv(?:e|ing)\s+(?:your ?self|my ?self)\b/,
  /\bhang(?:ing)?\s+(?:your ?self|my ?self)\b/,
  /\boverdose\b/,

  // Romanticizing / validating death
  /\bbetter\s+off\s+dead\b/,
  /\bworld\s+(?:is|would\s+be)\s+better\s+without\s+you\b/,
  /\bno\s+(?:reason|point)\s+to\s+(?:live|be\s+here|go\s+on)\b/,
  /\bnot\s+worth\s+living\b/,
  /\blife\s+(?:isn'?t|is\s+not)\s+worth\b/,
  /\bgive\s+up\s+on\s+(?:life|living)\b/,

  // Violence toward others
  /\bkill(?:ing)?\s+(?:him|her|them|someone|everyone|people)\b/,
  /\bhurt(?:ing)?\s+(?:him|her|them|someone|everyone|people)\b/,
  /\bharm(?:ing)?\s+(?:him|her|them|someone|everyone|people)\b/,
  /\bshoot(?:ing)?\s+up\b/,
  /\bget\s+revenge\s+(?:by|with)\s+(?:violence|hurting|killing)\b/,

  // Planning language in outputs (shouldn't happen, but belt-and-suspenders)
  /\bsuicide\s+(?:note|plan|pact|method)\b/,
  /\bhow\s+to\s+(?:end|kill|hurt)\s+(?:your ?self|my ?self)\b/,
];

/**
 * Returns true if the LLM output contains any language the app will not ship.
 * Checks all string fields in the provided object (flattens recursively).
 */
export function screenOutputForCrisis(value: unknown): boolean {
  const texts: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      texts.push(v);
    } else if (Array.isArray(v)) {
      for (const item of v) walk(item);
    } else if (v && typeof v === "object") {
      for (const k of Object.keys(v as Record<string, unknown>)) {
        walk((v as Record<string, unknown>)[k]);
      }
    }
  };
  walk(value);
  if (texts.length === 0) return false;
  const combined = normalize(texts.join(" "));
  if (!combined) return false;
  for (const re of OUTPUT_PATTERNS) {
    if (re.test(combined)) return true;
  }
  return false;
}
