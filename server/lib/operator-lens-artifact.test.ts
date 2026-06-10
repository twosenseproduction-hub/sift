import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { operatorLensArtifactSchema } from "@shared/schema";

describe("operatorLensArtifactSchema", () => {
  it("parses a complete operator lens artifact", () => {
    const parsed = operatorLensArtifactSchema.parse({
      lens: "operator",
      coreIssue: "Too many live threads without a governing constraint.",
      drag: "Context-switching between branding and client work.",
      bottleneck: "No chosen sequence for the launch week.",
      nextDecisiveMove: "Write the one task that unlocks the launch path.",
    });
    assert.equal(parsed.lens, "operator");
    assert.match(parsed.nextDecisiveMove, /unlock/);
  });
});
