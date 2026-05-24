import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildLibraryPatterns,
  computeWeekStreak,
  returningSignalsFromItems,
} from "./patterns-from-library";
import type { LibrarySiftItem } from "@shared/schema";

function item(partial: Partial<LibrarySiftItem> & Pick<LibrarySiftItem, "id">): LibrarySiftItem {
  return {
    title: partial.title ?? "Test",
    createdAt: partial.createdAt ?? Date.now(),
    summary: partial.summary ?? "Summary",
    tags: partial.tags ?? ["Identity"],
    hasNextStep: partial.hasNextStep ?? true,
    pinned: false,
    memoryMode: "full",
    transcriptExpiresAt: null,
    mode: "personal",
    environment: null,
    preview: {
      summary: partial.preview?.summary ?? "Signal text",
      matters: partial.preview?.matters ?? [],
      noise: partial.preview?.noise ?? [],
      nextStep: partial.preview?.nextStep ?? "Do one thing",
    },
    ...partial,
  };
}

describe("patterns-from-library", () => {
  it("computes week streak when entries exist in consecutive weeks", () => {
    const now = new Date("2026-05-23T12:00:00").getTime();
    const week = 7 * 24 * 60 * 60 * 1000;
    const items = [
      item({ id: "a", createdAt: now }),
      item({ id: "b", createdAt: now - week }),
    ];
    assert.equal(computeWeekStreak(items, now), 2);
  });

  it("groups returning signals by primary tag", () => {
    const items = [
      item({ id: "a", tags: ["Work"], title: "First work signal", createdAt: 1 }),
      item({ id: "b", tags: ["Work"], title: "Second work signal", createdAt: 2 }),
      item({ id: "c", tags: ["Grief"], title: "Grief signal", createdAt: 3 }),
    ];
    const rows = returningSignalsFromItems(items);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.count, 2);
    assert.equal(rows[0]?.tag, "Work");
    assert.equal(rows[0]?.latestEntryId, "b");
  });

  it("builds patterns summary from library list", () => {
    const items = [
      item({ id: "a", tags: ["Identity"], hasNextStep: false }),
      item({ id: "b", tags: ["Identity"], hasNextStep: true }),
    ];
    const patterns = buildLibraryPatterns(items, [{ label: "Identity", count: 2 }]);
    assert.equal(patterns.totalEntries, 2);
    assert.equal(patterns.resolvedCount, 1);
    assert.equal(patterns.recurringThemes[0]?.barWidth, 100);
  });
});
