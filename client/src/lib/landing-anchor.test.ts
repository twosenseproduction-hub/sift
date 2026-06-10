import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  landingAnchor,
  landingSectionFromPath,
} from "@/pages/landing-shared";

describe("landing section navigation", () => {
  it("builds single-hash route URLs without fragment anchors", () => {
    assert.equal(landingAnchor("preview", "other"), "/#/landing/preview");
    assert.equal(landingAnchor("how", "landing"), "/#/landing/how");
    assert.notEqual(landingAnchor("founder", "other"), "/#/landing#founder");
  });

  it("parses section segment from nested landing routes", () => {
    assert.equal(landingSectionFromPath("/landing/preview"), "preview");
    assert.equal(landingSectionFromPath("/landing/how"), "how");
    assert.equal(landingSectionFromPath("/landing"), null);
    assert.equal(landingSectionFromPath("/pricing"), null);
  });
});
