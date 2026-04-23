// Crisis screen — a small, deliberately conservative filter that runs on any
// free-form text the user submits (main sift, check-in note, voice transcript)
// BEFORE we persist it or send it to the LLM. If it trips, the route returns
// a CareResponse and the client renders a calm screen with crisis lines.
//
// Design notes:
//   - Moderately strict. We prefer slight over-triggering, paired with a
//     "this wasn't what I meant" escape hatch on the client, over missing a
//     real signal.
//   - Covers self-harm / suicide AND harm-to-others — the same care response
//     (988 + text line + findahelpline) is appropriate for both because those
//     lines handle violent ideation too.
//   - We match on normalized lowercase text with word-boundaries. Substring
//     matches on benign words (e.g. "suicidal thoughts" appearing inside a
//     URL/word) are avoided via \b boundaries.
//   - The phrase list lives server-side only — it is never shipped in the
//     client bundle.

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

// Each pattern is a RegExp that we test against the normalized text.
// Word boundaries (\b) keep benign substrings from tripping the screen.
// Optional wiggle like \s+ lets "kill  myself" / "kill myself" both match.
const PATTERNS: RegExp[] = [
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
  /\bbetter\s+off\s+dead\b/,
  /\bno\s+reason\s+to\s+(?:live|be\s+here)\b/,
  /\bdon'?t\s+want\s+to\s+(?:live|be\s+here|exist|wake\s+up)\b/,
  /\bdon'?t\s+want\s+to\s+be\s+alive\b/,
  /\bwant\s+to\s+disappear\s+forever\b/,
  /\bcan'?t\s+go\s+on\s+(?:like\s+this|anymore)\b/,
  /\bcan'?t\s+do\s+this\s+anymore\b/, // broader; acceptable over-trigger
  /\bi\s+give\s+up\s+on\s+life\b/,
  /\bready\s+to\s+die\b/,

  // --- Method / planning language ---
  /\bhang\s+my ?self\b/,
  /\boverdose\b/,
  /\bjump\s+off\b/,
  /\bshoot\s+my ?self\b/,
  /\bpills\s+to\s+end\b/,
  /\bfinal\s+plan\b/, // softer — covered by the "meant something else" dismiss

  // --- Self-harm ---
  /\bhurt(?:ing)?\s+my ?self\b/,
  /\bharm(?:ing)?\s+my ?self\b/,
  /\bself[-\s]?harm(?:ing)?\b/,
  /\bcut(?:ting)?\s+my ?self\b/,

  // --- Harm to others ---
  /\bkill(?:ing)?\s+(?:him|her|them|someone|everyone|people|my\s+\w+)\b/,
  /\bhurt(?:ing)?\s+(?:him|her|them|someone|everyone|people|my\s+\w+)\b/,
  /\bharm(?:ing)?\s+(?:him|her|them|someone|everyone|people|my\s+\w+)\b/,
  /\bshoot(?:ing)?\s+up\b/, // mass-violence coded phrase
  /\bwant\s+to\s+hurt\s+someone\b/,
  /\bwant\s+to\s+kill\s+someone\b/,
];

export function screenForCrisis(text: string): boolean {
  if (typeof text !== "string") return false;
  const normalized = normalize(text);
  if (!normalized) return false;
  for (const re of PATTERNS) {
    if (re.test(normalized)) return true;
  }
  return false;
}
