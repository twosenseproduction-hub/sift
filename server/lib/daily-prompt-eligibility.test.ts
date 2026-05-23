import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateDailyPromptEligibility,
  localDateKeyForMs,
} from "./daily-prompt-eligibility.ts";

describe("evaluateDailyPromptEligibility", () => {
  const tz = "America/Los_Angeles";

  it("skips when paused", () => {
    const nowMs = Date.parse("2026-05-23T15:00:00.000Z");
    const result = evaluateDailyPromptEligibility({
      nowMs,
      timezone: tz,
      targetLocalHour: 8,
      lastSentAt: null,
      pausedUntil: nowMs + 60_000,
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "paused");
  });

  it("skips when already sent today in user timezone", () => {
    const lastSentAt = Date.parse("2026-05-23T15:05:00.000Z");
    const nowMs = Date.parse("2026-05-23T16:00:00.000Z");
    const result = evaluateDailyPromptEligibility({
      nowMs,
      timezone: tz,
      targetLocalHour: 9,
      lastSentAt,
      pausedUntil: null,
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "already_sent_today");
  });

  it("skips outside target hour", () => {
    const nowMs = Date.parse("2026-05-23T16:00:00.000Z"); // 9am PT
    const result = evaluateDailyPromptEligibility({
      nowMs,
      timezone: tz,
      targetLocalHour: 8,
      lastSentAt: null,
      pausedUntil: null,
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "wrong_hour");
  });

  it("allows first window of target hour", () => {
    const nowMs = Date.parse("2026-05-23T15:05:00.000Z"); // 8:05am PT
    const result = evaluateDailyPromptEligibility({
      nowMs,
      timezone: tz,
      targetLocalHour: 8,
      lastSentAt: null,
      pausedUntil: null,
    });
    assert.equal(result.eligible, true);
    assert.equal(result.reason, "ready");
  });

  it("skips after first 15 minutes of the hour", () => {
    const nowMs = Date.parse("2026-05-23T15:20:00.000Z"); // 8:20am PT
    const result = evaluateDailyPromptEligibility({
      nowMs,
      timezone: tz,
      targetLocalHour: 8,
      lastSentAt: null,
      pausedUntil: null,
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "outside_send_window");
  });
});

describe("localDateKeyForMs", () => {
  it("uses the user's timezone for calendar day boundaries", () => {
    const ms = Date.parse("2026-05-23T07:30:00.000Z");
    assert.equal(localDateKeyForMs(ms, "America/Los_Angeles"), "2026-05-23");
    assert.equal(localDateKeyForMs(ms, "UTC"), "2026-05-23");
  });
});
