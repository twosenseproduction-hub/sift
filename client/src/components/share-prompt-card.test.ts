import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SHARE_CARD_EXPORT_ASPECT,
  SHARE_CARD_EXPORT_HEIGHT,
  SHARE_CARD_EXPORT_WIDTH,
} from "./share-prompt-card";

describe("SharePromptCard export dimensions", () => {
  it("uses 1080×1920 portrait (9:16) for story shares", () => {
    assert.equal(SHARE_CARD_EXPORT_WIDTH, 1080);
    assert.equal(SHARE_CARD_EXPORT_HEIGHT, 1920);
    assert.equal(SHARE_CARD_EXPORT_ASPECT, "9 / 16");
    assert.equal(
      SHARE_CARD_EXPORT_WIDTH / SHARE_CARD_EXPORT_HEIGHT,
      9 / 16,
    );
  });
});
