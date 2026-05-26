import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  WRITING_SIFT_CONFIRM_THRESHOLD,
  detectWritingLikelihood,
} from "./writing-sift-detect.ts";

describe("detectWritingLikelihood", () => {
  it("does not confirm plain problem text", () => {
    const r = detectWritingLikelihood(
      "I have too many options at work and every choice feels like it closes something else. What should I focus on first?",
    );
    assert.equal(r.shouldConfirm, false);
    assert.ok(r.writingLikelihood < WRITING_SIFT_CONFIRM_THRESHOLD);
  });

  it("confirms when explicit cue plus verse-like layout", () => {
    const poem = `Here's a poem I wrote

Ash on the sill
the kettle forgets its whistle
morning keeps its distance

Does this land?`;
    const r = detectWritingLikelihood(poem);
    assert.ok(r.signals.includes("explicit_cue"));
    assert.equal(r.shouldConfirm, true);
    assert.ok(r.writingLikelihood >= WRITING_SIFT_CONFIRM_THRESHOLD);
  });

  it("scores line breaks and short lines without explicit cue", () => {
    const verse = `first line short
second line here
third line now
fourth line still
fifth line end`;
    const r = detectWritingLikelihood(verse);
    assert.ok(r.signals.includes("line_breaks_4plus"));
    assert.ok(r.signals.includes("short_avg_line_length"));
    assert.equal(r.shouldConfirm, true);
  });

  it("returns zero for empty input", () => {
    const r = detectWritingLikelihood("   ");
    assert.equal(r.writingLikelihood, 0);
    assert.equal(r.shouldConfirm, false);
  });
});
