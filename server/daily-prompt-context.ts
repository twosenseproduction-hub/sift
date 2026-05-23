import type { RecentSiftSignal } from "./daily-prompt";
import { rawDb } from "./storage";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Shared UTC epoch for the 300-day theme cycle (Jan 1 2026 UTC = day 0). */
export const CYCLE_EPOCH_MS = Date.UTC(2026, 0, 1);

export function currentThemeCycleDay(nowMs = Date.now()): number {
  return Math.floor((nowMs - CYCLE_EPOCH_MS) / DAY_MS);
}

const countSiftsForUserStmt = rawDb.prepare(
  `SELECT COUNT(*) AS n FROM sifts WHERE user_id = ?`,
);

const recentSiftsStmt = rawDb.prepare(
  `SELECT created_at, themes, core_intent, next_step
     FROM sifts
    WHERE user_id = ? AND created_at >= ?
    ORDER BY created_at DESC
    LIMIT 40`,
);

export function countUserSifts(userId: number): number {
  const { n } = countSiftsForUserStmt.get(userId) as { n: number };
  return n;
}

export function loadRecentSiftSignals(
  userId: number,
  nowMs = Date.now(),
): RecentSiftSignal[] {
  const since = nowMs - 30 * DAY_MS;
  const rows = recentSiftsStmt.all(userId, since) as Array<{
    created_at: number;
    themes: string;
    core_intent: string | null;
    next_step: string | null;
  }>;

  return rows.map((r) => {
    let titles: string[] = [];
    try {
      const parsed = JSON.parse(r.themes);
      if (Array.isArray(parsed)) {
        titles = parsed
          .map((t) => (t && typeof t.title === "string" ? t.title : ""))
          .filter(Boolean);
      }
    } catch {
      // Malformed JSON — ignore titles for this row.
    }
    return {
      createdAt: r.created_at,
      themeTitles: titles,
      text: [r.core_intent || "", r.next_step || ""].join(" ").trim(),
    };
  });
}

export function buildDailyPromptInputForUser(
  userId: number,
  localHour: number | null,
  nowMs = Date.now(),
) {
  const hasPriorSift = countUserSifts(userId) > 0;
  const recentSifts = hasPriorSift
    ? loadRecentSiftSignals(userId, nowMs)
    : undefined;

  return {
    themeCycleDay: currentThemeCycleDay(nowMs),
    hasPriorSift,
    userKey: `u:${userId}`,
    recentSifts,
    localHour,
    nowMs,
  };
}
