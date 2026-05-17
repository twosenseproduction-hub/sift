/**
 * Pure training-layer helpers: redundancy gate, recurring signal detection.
 * Shared between server persistence and local-first client journal so
 * behavior matches when journal text never touches the database.
 */

export const REDUNDANCY_LOW_THRESHOLD = 0.4;
export const REDUNDANCY_HIGH_THRESHOLD = 0.65;

export const STOP_WORDS = new Set([
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

export function tokenizeForOverlap(text: string): Set<string> {
  const words = text.toLowerCase().split(/\W+/).filter(Boolean);
  const set = new Set<string>();
  for (const w of words) {
    if (w.length <= 2 || STOP_WORDS.has(w)) continue;
    set.add(w);
  }
  return set;
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  a.forEach((x) => {
    if (b.has(x)) inter++;
  });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export type RedundancyLevel =
  | { level: "none" }
  | { level: "low"; priorSiftId: string; priorNextStep: string }
  | { level: "high"; priorSiftId: string; priorNextStep: string };

export function checkRedundancyLevel(
  newInput: string,
  recent: Array<{ id: string; input: string; nextStep: string }>,
): RedundancyLevel {
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

export function meaningfulTokensFromStrings(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    for (const w of line.toLowerCase().split(/\W+/)) {
      if (w.length > 2 && !STOP_WORDS.has(w)) out.push(w);
    }
  }
  return out;
}

export function detectRecurringFromMatters(
  newMatters: string[],
  priorMattersRows: string[][],
): { detected: boolean; theme: string | null } {
  if (newMatters.length === 0) {
    return { detected: false, theme: null };
  }
  if (priorMattersRows.length < 2) {
    return { detected: false, theme: null };
  }

  const newTokenList = meaningfulTokensFromStrings(newMatters);
  const newUnique = Array.from(new Set(newTokenList));

  const matchingIntersections: string[][] = [];

  for (const priorMatters of priorMattersRows) {
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
