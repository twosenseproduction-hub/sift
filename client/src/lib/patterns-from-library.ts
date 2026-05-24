import type { LibraryRecurringTheme, LibrarySiftItem } from "@shared/schema";

export type PatternsHeatmapCell = {
  dateKey: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};

export type PatternsHeatmap = {
  weeks: number;
  /** [weekIndex][dayIndex 0=Mon..6=Sun] */
  grid: PatternsHeatmapCell[][];
  monthLabels: string[];
};

export type ReturningSignalPattern = {
  signal: string;
  tag: string;
  count: number;
  dates: number[];
  /** Most recent library entry in this group (for deep link). */
  latestEntryId: string;
};

export type LibraryPatterns = {
  totalEntries: number;
  weekStreak: number;
  recurringThemeCount: number;
  resolvedCount: number;
  recurringThemes: Array<LibraryRecurringTheme & { barWidth: number }>;
  returningSignals: ReturningSignalPattern[];
  metaSignal: string | null;
  heatmap: PatternsHeatmap;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function localDateKey(ms: number, timeZone?: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function startOfLocalWeek(ms: number, timeZone?: string) {
  const date = new Date(ms);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const dayIndex = map[weekday] ?? 0;
  const key = localDateKey(ms, timeZone);
  const midnight = new Date(`${key}T12:00:00`);
  return midnight.getTime() - dayIndex * 24 * 60 * 60 * 1000;
}

function intensityLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

export function buildActivityHeatmap(
  items: LibrarySiftItem[],
  weeks = 15,
  now = Date.now(),
): PatternsHeatmap {
  const countsByDay = new Map<string, number>();
  for (const item of items) {
    const key = localDateKey(item.createdAt);
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }

  const currentWeekStart = startOfLocalWeek(now);
  const grid: PatternsHeatmapCell[][] = Array.from({ length: weeks }, () =>
    Array.from({ length: 7 }, () => ({ dateKey: "", count: 0, level: 0 })),
  );

  const monthSet = new Set<string>();

  for (let w = 0; w < weeks; w++) {
    const weekStart = currentWeekStart - (weeks - 1 - w) * WEEK_MS;
    for (let d = 0; d < 7; d++) {
      const dayMs = weekStart + d * 24 * 60 * 60 * 1000;
      const dateKey = localDateKey(dayMs);
      const count = countsByDay.get(dateKey) ?? 0;
      grid[w]![d] = { dateKey, count, level: intensityLevel(count) };
      if (w === 0 || d === 0) {
        monthSet.add(
          new Intl.DateTimeFormat(undefined, { month: "short" }).format(new Date(dayMs)),
        );
      }
    }
  }

  const monthLabels = Array.from(monthSet);
  if (monthLabels.length < 2 && items.length) {
    const oldest = Math.min(...items.map((i) => i.createdAt));
    monthLabels.unshift(
      new Intl.DateTimeFormat(undefined, { month: "short" }).format(new Date(oldest)),
    );
  }

  return { weeks, grid, monthLabels: monthLabels.slice(-6) };
}

export function computeWeekStreak(items: LibrarySiftItem[], now = Date.now()): number {
  if (!items.length) return 0;
  const weekStarts = new Set(items.map((i) => startOfLocalWeek(i.createdAt)));
  let streak = 0;
  let cursor = startOfLocalWeek(now);
  while (weekStarts.has(cursor)) {
    streak++;
    cursor -= WEEK_MS;
  }
  return streak;
}

export function returningSignalsFromItems(items: LibrarySiftItem[]): ReturningSignalPattern[] {
  const byTag = new Map<string, LibrarySiftItem[]>();
  for (const item of items) {
    const tag = item.tags[0]?.trim() || "General";
    const key = tag.toLowerCase();
    const group = byTag.get(key) ?? [];
    group.push(item);
    byTag.set(key, group);
  }

  return Array.from(byTag.entries())
    .map(([, group]) => {
      const sorted = [...group].sort((a, b) => b.createdAt - a.createdAt);
      const lead = sorted[0]!;
      return {
        signal: lead.title?.trim() || lead.preview.summary,
        tag: lead.tags[0]?.trim() || "General",
        count: sorted.length,
        dates: sorted.map((i) => i.createdAt),
        latestEntryId: lead.id,
      };
    })
    .filter((row) => row.count >= 2)
    .sort((a, b) => b.count - a.count || b.dates[0]! - a.dates[0]!)
    .slice(0, 5);
}

export function metaSignalFromPatterns(
  items: LibrarySiftItem[],
  recurringThemes: LibraryRecurringTheme[],
): string | null {
  if (items.length < 2) return null;

  const top = recurringThemes[0];
  const second = recurringThemes[1];

  if (top && top.count >= 2) {
    const lead =
      second && second.count >= 2
        ? `${top.label} and ${second.label.toLowerCase()} keep showing up`
        : `${top.label} keeps showing up`;
    return `${lead} across your saved Sifts. These are observations from your entries — not labels or diagnoses.`;
  }

  const recurringMovement = items
    .map((i) => i.movement?.recurring?.trim())
    .find(Boolean);
  if (recurringMovement) {
    return recurringMovement;
  }

  if (items.length >= 3) {
    return "A thread runs through what you bring: the tension is often between what you already know and what you are willing to act on.";
  }

  return null;
}

function allThemesFromItems(items: LibrarySiftItem[]): LibraryRecurringTheme[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const item of items) {
    for (const tag of item.tags.slice(0, 6)) {
      const label = tag.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const existing = counts.get(key);
      if (existing) existing.count++;
      else counts.set(key, { label, count: 1 });
    }
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map(({ label, count }) => ({ label, count }));
}

export function buildLibraryPatterns(
  items: LibrarySiftItem[],
  recurringThemes: LibraryRecurringTheme[],
): LibraryPatterns {
  const themesForDisplay =
    allThemesFromItems(items).length > 0 ? allThemesFromItems(items) : recurringThemes;
  const maxThemeCount = themesForDisplay[0]?.count ?? 1;
  const themesWithBars = themesForDisplay.map((theme) => ({
    ...theme,
    barWidth: maxThemeCount > 0 ? Math.round((theme.count / maxThemeCount) * 100) : 0,
  }));

  return {
    totalEntries: items.length,
    weekStreak: computeWeekStreak(items),
    recurringThemeCount: themesForDisplay.filter((t) => t.count > 1).length,
    resolvedCount: items.filter((i) => !i.hasNextStep).length,
    recurringThemes: themesWithBars,
    returningSignals: returningSignalsFromItems(items),
    metaSignal: metaSignalFromPatterns(items, themesForDisplay),
    heatmap: buildActivityHeatmap(items),
  };
}

export function formatPatternDates(dates: number[]): string {
  return dates
    .slice()
    .sort((a, b) => a - b)
    .map((ms) =>
      new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(ms)),
    )
    .join(" · ");
}
