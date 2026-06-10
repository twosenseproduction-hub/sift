import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writingSiftArtifactSchema } from "@shared/schema";

describe("writingSiftArtifactSchema", () => {
  it("parses a complete writing artifact", () => {
    const parsed = writingSiftArtifactSchema.parse({
      mode: "writing",
      whatThisPieceIsCarrying: "Grief held at arm's length.",
      liveImage: "The kettle forgets its whistle.",
      whatLingers: "A thin quiet after the last line.",
      oneInvitation: "Read it aloud once and notice where your breath catches.",
    });
    assert.equal(parsed.lens, "writer");
    assert.match(parsed.oneInvitation, /Read it aloud/);
  });

  it("rejects missing fields", () => {
    assert.throws(() =>
      writingSiftArtifactSchema.parse({
        mode: "writing",
        whatThisPieceIsCarrying: "Only partial",
      }),
    );
  });
});
