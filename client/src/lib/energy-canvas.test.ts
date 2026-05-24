import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scoreEnergyState } from "./energy-canvas";

describe("scoreEnergyState", () => {
  it("returns blank for empty input", () => {
    assert.equal(scoreEnergyState(""), "blank");
    assert.equal(scoreEnergyState("   "), "blank");
  });

  it("detects anxious language", () => {
    assert.equal(
      scoreEnergyState(
        "I can't stop worrying about tomorrow. What if I fail the test?",
      ),
      "anxious",
    );
  });

  it("detects grief language", () => {
    assert.equal(
      scoreEnergyState("I miss her. The house feels empty and alone."),
      "grief",
    );
  });

  it("falls back to tangled for long ambiguous text", () => {
    assert.equal(
      scoreEnergyState(
        "I don't know if it's the right move but I also don't know if staying is right either.",
      ),
      "tangled",
    );
  });
});
