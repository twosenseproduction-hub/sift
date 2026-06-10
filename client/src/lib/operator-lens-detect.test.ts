import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectOperatorLikelihood } from "./operator-lens-detect";

describe("detectOperatorLikelihood", () => {
  it("does not confirm short personal text", () => {
    const r = detectOperatorLikelihood("I feel sad about my partner.");
    assert.equal(r.shouldConfirm, false);
  });

  it("confirms operational launch pressure", () => {
    const r = detectOperatorLikelihood(
      "I'm trying to launch this thing, money is tight, and I keep bouncing between strategy, branding, and client work instead of shipping.",
    );
    assert.equal(r.shouldConfirm, true);
    assert.ok(r.score >= 3);
  });
});
