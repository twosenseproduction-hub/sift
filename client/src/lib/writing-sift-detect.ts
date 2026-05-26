/**
 * Heuristic detector for creative writing vs problem-to-solve input.
 * Threshold: writingLikelihood >= 3 → shouldConfirm (soft UI before /api/sift).
 */

/** Score at or above this value triggers the writing confirmation UI. */
export const WRITING_SIFT_CONFIRM_THRESHOLD = 3;

const EXPLICIT_CUE_PATTERNS: RegExp[] = [
  /\bhere'?s\s+(?:a\s+)?poem\b/i,
  /\bi\s+wrote\s+this\b/i,
  /\bcan\s+you\s+read\s+this\s+piece\b/i,
  /\bthis\s+is\s+(?:a\s+)?draft\b/i,
  /\bis\s+this\s+poem\s+working\b/i,
  /\bwhat\s+do\s+you\s+think\s+of\s+this\s+writing\b/i,
  /\bread\s+this\s+(?:poem|piece|draft|writing)\b/i,
  /\bwrote\s+(?:a\s+)?(?:poem|piece|draft)\b/i,
];

const WRITING_KEYWORD_PATTERN =
  /\b(?:poem|poetry|verse|stanza|lyric|draft|manuscript|prose|fiction|essay|short\s+story|creative\s+writing)\b/i;

/** Average line length below this (chars) adds +1 to the score. */
export const WRITING_SIFT_MAX_AVG_LINE_CHARS = 60;

export type WritingDetectResult = {
  writingLikelihood: number;
  shouldConfirm: boolean;
  /** Which heuristics fired — useful for tests and tuning. */
  signals: string[];
};

function nonEmptyLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function hasExplicitCue(text: string): boolean {
  if (EXPLICIT_CUE_PATTERNS.some((p) => p.test(text))) return true;
  if (WRITING_KEYWORD_PATTERN.test(text)) {
    const lower = text.toLowerCase();
    if (
      /\b(?:my|this|a|the)\s+(?:poem|piece|draft|writing)\b/i.test(text) ||
      /\b(?:poem|piece|draft|writing)\s+(?:i|about|for)\b/i.test(lower)
    ) {
      return true;
    }
  }
  return false;
}

function lineBreakScore(lines: string[]): { score: number; signal?: string } {
  const breaks = Math.max(0, lines.length - 1);
  if (breaks >= 4) return { score: 1, signal: "line_breaks_4plus" };
  return { score: 0 };
}

function shortLineScore(lines: string[]): { score: number; signal?: string } {
  if (lines.length < 2) return { score: 0 };
  const avg =
    lines.reduce((sum, l) => sum + l.length, 0) / Math.max(lines.length, 1);
  if (avg < WRITING_SIFT_MAX_AVG_LINE_CHARS) {
    return { score: 1, signal: "short_avg_line_length" };
  }
  return { score: 0 };
}

function prosePunctuationScore(lines: string[]): { score: number; signal?: string } {
  if (lines.length < 2) return { score: 0 };
  const withoutEndPunct = lines.filter(
    (l) => !/[.!?]["')\]]*\s*$/.test(l),
  ).length;
  const ratio = withoutEndPunct / lines.length;
  if (ratio >= 0.6) return { score: 1, signal: "low_prose_punctuation" };
  return { score: 0 };
}

/** Few direct questions → more like verse than a help request. */
function lowQuestionDensityScore(text: string, lines: string[]): {
  score: number;
  signal?: string;
} {
  if (lines.length < 2) return { score: 0 };
  const questions = (text.match(/\?/g) ?? []).length;
  const density = questions / lines.length;
  if (density < 0.15) return { score: 1, signal: "low_question_density" };
  return { score: 0 };
}

export function detectWritingLikelihood(input: string): WritingDetectResult {
  const trimmed = input.trim();
  const signals: string[] = [];
  let writingLikelihood = 0;

  if (!trimmed) {
    return { writingLikelihood: 0, shouldConfirm: false, signals };
  }

  if (hasExplicitCue(trimmed)) {
    writingLikelihood += 2;
    signals.push("explicit_cue");
  }

  const lines = nonEmptyLines(trimmed);

  for (const scorer of [
    () => lineBreakScore(lines),
    () => shortLineScore(lines),
    () => prosePunctuationScore(lines),
    () => lowQuestionDensityScore(trimmed, lines),
  ]) {
    const { score, signal } = scorer();
    if (score > 0 && signal) {
      writingLikelihood += score;
      signals.push(signal);
    }
  }

  return {
    writingLikelihood,
    shouldConfirm: writingLikelihood >= WRITING_SIFT_CONFIRM_THRESHOLD,
    signals,
  };
}
