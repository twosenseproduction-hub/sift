/**
 * Heuristic: operational / work-execution language while Personal lens is active.
 * Threshold: score >= 3 → suggest Operator lens (user must confirm).
 */

export const OPERATOR_LENS_CONFIRM_THRESHOLD = 3;

const OPERATOR_CUE_PATTERNS: RegExp[] = [
  /\b(?:launch|ship|deploy|roadmap|sprint|backlog|okr|stakeholder|runway|revenue|pricing)\b/i,
  /\b(?:founder|startup|cofounder|team|hire|hiring|client|customer|roadmap)\b/i,
  /\b(?:priority|priorities|execution|throughput|bottleneck|blocker|deadline)\b/i,
  /\b(?:strategy|branding|fundraising|investor|board)\b.*\b(?:and|,)\b.*\b(?:client|work|ship)/i,
];

const PERSONAL_OVERRIDE_PATTERNS: RegExp[] = [
  /\b(?:relationship|partner|spouse|parent|grief|anxious|sad|lonely|heart)\b/i,
  /\b(?:feel(?:ing)?|emotion|inner|heart)\b/i,
];

export type OperatorDetectResult = {
  score: number;
  shouldConfirm: boolean;
  signals: string[];
};

export function detectOperatorLikelihood(input: string): OperatorDetectResult {
  const trimmed = input.trim();
  const signals: string[] = [];
  let score = 0;

  if (!trimmed || trimmed.length < 40) {
    return { score: 0, shouldConfirm: false, signals };
  }

  if (PERSONAL_OVERRIDE_PATTERNS.some((p) => p.test(trimmed))) {
    return { score: 0, shouldConfirm: false, signals: ["personal_context"] };
  }

  for (const pattern of OPERATOR_CUE_PATTERNS) {
    if (pattern.test(trimmed)) {
      score += 1;
      signals.push(`cue:${pattern.source.slice(0, 24)}`);
    }
  }

  const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 8);
  if (sentences.length >= 2) {
    const workDensity =
      sentences.filter((s) =>
        /\b(?:work|project|launch|team|client|ship|decision|priority)\b/i.test(s),
      ).length / sentences.length;
    if (workDensity >= 0.5) {
      score += 1;
      signals.push("work_sentence_density");
    }
  }

  if (/\b(?:i need to|we need to|have to)\b/i.test(trimmed) && score > 0) {
    score += 1;
    signals.push("obligation_framing");
  }

  return {
    score,
    shouldConfirm: score >= OPERATOR_LENS_CONFIRM_THRESHOLD,
    signals,
  };
}
