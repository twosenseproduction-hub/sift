import { describe, it } from "node:test";
import assert from "node:assert/strict";

/** Mirrors HashQueryRedirect target resolution for email deep links. */
function dailySiftRedirectTarget(hash: string): string | null {
  const normalized = hash.replace(/^#/, "");
  const qIndex = normalized.indexOf("?");
  if (qIndex === -1) return null;
  const params = new URLSearchParams(normalized.slice(qIndex));
  const promptId = params.get("promptId");
  if (params.get("dailyPrompt") === "1" && promptId && /^\d+$/.test(promptId)) {
    return `/daily-sift/${promptId}`;
  }
  return null;
}

describe("hash daily prompt redirect", () => {
  it("maps legacy sift query links to daily-sift route", () => {
    assert.equal(
      dailySiftRedirectTarget("#/sift?dailyPrompt=1&promptId=12"),
      "/daily-sift/12",
    );
    assert.equal(
      dailySiftRedirectTarget("#/?dailyPrompt=1&promptId=99"),
      "/daily-sift/99",
    );
  });

  it("ignores links without prompt id", () => {
    assert.equal(dailySiftRedirectTarget("#/sift?dailyPrompt=1"), null);
    assert.equal(dailySiftRedirectTarget("#/sift"), null);
  });
});
