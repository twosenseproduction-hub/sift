import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { selectDailyPrompt } from "../daily-prompt.ts";
import { buildDailyPromptInputForUser } from "../daily-prompt-context.ts";

describe("selectDailyPrompt integration", () => {
  it("returns a prompt for anonymous calendar input", () => {
    const result = selectDailyPrompt({
      themeCycleDay: 42,
      hasPriorSift: false,
      userKey: "anon",
      localHour: 9,
    });
    assert.ok(result.prompt.text.length > 0);
    assert.ok(result.themeNum >= 1 && result.themeNum <= 10);
  });

  it("buildDailyPromptInputForUser uses stable user key shape", () => {
    const input = buildDailyPromptInputForUser(7, 10, Date.UTC(2026, 4, 23, 15, 0));
    assert.equal(input.userKey, "u:7");
    assert.equal(typeof input.themeCycleDay, "number");
  });
});

describe("daily prompt email html", () => {
  it("renders prompt text without raw html injection", async () => {
    const { renderDailyPromptEmailHtml } = await import(
      "../email/daily-prompt-email.ts"
    );
    const html = renderDailyPromptEmailHtml({
      to: "test@example.com",
      firstName: "Alex",
      promptText: "What feels <loud> today?",
      themeName: "Energy",
      promptId: 12,
      ctaUrl: "https://app.siftnow.io/#/daily-sift/12",
    });
    assert.match(html, /What feels &lt;loud&gt; today\?/);
    assert.match(html, /Open in Sift/);
    assert.doesNotMatch(html, /What feels <loud>/);
  });
});
