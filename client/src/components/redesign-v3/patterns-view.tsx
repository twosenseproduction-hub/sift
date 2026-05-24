import { Link } from "wouter";
import {
  buildLibraryPatterns,
  formatPatternDates,
  type LibraryPatterns,
} from "@/lib/patterns-from-library";
import type { LibraryRecurringTheme, LibrarySiftItem } from "@shared/schema";
import { cn } from "@/lib/utils";

const HEATMAP_DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

export function PatternsView({
  items,
  recurringThemes,
  loading,
}: {
  items: LibrarySiftItem[];
  recurringThemes: LibraryRecurringTheme[];
  loading?: boolean;
}) {
  if (loading) {
    return <p className="v3-empty-state">Reading your patterns…</p>;
  }

  if (!items.length) {
    return (
      <div className="v3-empty-state">
        <p className="v3-empty-state-title">Patterns appear after a few Sifts.</p>
        <p className="mt-2">
          Save entries to your Library and Sift will surface recurring themes, activity, and signals
          that keep returning.
        </p>
        <Link href="/sift">
          <a className="mt-4 inline-block text-[13px] text-[color:var(--v3-sage)] underline-offset-4 hover:underline">
            Start a sift
          </a>
        </Link>
      </div>
    );
  }

  const patterns = buildLibraryPatterns(items, recurringThemes);
  return <PatternsViewBody patterns={patterns} />;
}

function PatternsViewBody({ patterns }: { patterns: LibraryPatterns }) {
  return (
    <div className="v3-patterns-layout">
      <aside className="v3-patterns-sidebar">
        <p className="v3-patterns-sidebar-title">Patterns</p>
        <p className="v3-patterns-sidebar-sub">What Sift has noticed across all your entries.</p>

        <StatBlock value={patterns.totalEntries} label="Total entries" />
        <hr className="v3-stat-divider" />
        <StatBlock value={patterns.weekStreak} label="Week streak" />
        <hr className="v3-stat-divider" />
        <StatBlock value={patterns.recurringThemeCount} label="Returning themes" />
        <hr className="v3-stat-divider" />
        <StatBlock value={patterns.resolvedCount} label="Without open step" />
      </aside>

      <main className="v3-patterns-main">
        {patterns.metaSignal ? (
          <section className="v3-patterns-section">
            <p className="v3-patterns-section-label">What Sift sees in you</p>
            <div className="v3-distilled-block">
              <p className="v3-distilled-eyebrow">Meta-signal</p>
              <p className="v3-distilled-text">{patterns.metaSignal}</p>
            </div>
          </section>
        ) : null}

        <section className="v3-patterns-section">
          <p className="v3-patterns-section-label">Activity — past {patterns.heatmap.weeks} weeks</p>
          <ActivityHeatmap heatmap={patterns.heatmap} />
        </section>

        {patterns.recurringThemes.length ? (
          <section className="v3-patterns-section">
            <p className="v3-patterns-section-label">Recurring themes</p>
            {patterns.recurringThemes.map((theme) => (
              <div key={theme.label} className="v3-theme-row">
                <span className="v3-theme-name">{theme.label}</span>
                <div className="v3-theme-bar-wrap">
                  <div className="v3-theme-bar">
                    <div
                      className="v3-theme-bar-fill"
                      style={{ width: `${theme.barWidth}%` }}
                    />
                  </div>
                </div>
                <span className="v3-theme-count">
                  {theme.count} {theme.count === 1 ? "entry" : "entries"}
                </span>
              </div>
            ))}
          </section>
        ) : null}

        {patterns.returningSignals.length ? (
          <section className="v3-patterns-section">
            <p className="v3-patterns-section-label">Signals that keep returning</p>
            {patterns.returningSignals.map((row) => (
              <Link key={`${row.tag}-${row.signal}`} href={`/library/${row.latestEntryId}`}>
                <a className="v3-returning-card block">
                  <p className="v3-returning-card-signal">{row.signal}</p>
                  <div className="v3-returning-card-meta">
                    <span className="v3-returning-card-freq">
                      appeared {row.count}× · {row.tag}
                    </span>
                    <span className="v3-returning-card-dates">
                      {formatPatternDates(row.dates)}
                    </span>
                  </div>
                </a>
              </Link>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="v3-stat-block">
      <p className="v3-stat-num">{value}</p>
      <p className="v3-stat-label">{label}</p>
    </div>
  );
}

function ActivityHeatmap({ heatmap }: { heatmap: LibraryPatterns["heatmap"] }) {
  const { weeks, grid, monthLabels } = heatmap;

  return (
    <div className="v3-heatmap-wrap">
      <div className="v3-heatmap-months">
        {monthLabels.map((month) => (
          <span key={month} className="v3-heatmap-month-label">
            {month}
          </span>
        ))}
      </div>
      <div>
        {HEATMAP_DAY_LABELS.map((dayLabel, dayIndex) => (
          <div key={dayIndex} className="v3-heatmap-row">
            <span className="v3-heatmap-day-label">{dayLabel}</span>
            <div className="v3-heatmap-cells">
              {Array.from({ length: weeks }, (_, weekIndex) => {
                const cell = grid[weekIndex]?.[dayIndex];
                return (
                  <div
                    key={`${weekIndex}-${dayIndex}`}
                    className={cn("v3-hm-cell", cell?.level ? `l${cell.level}` : undefined)}
                    title={
                      cell?.count
                        ? `${cell.dateKey}: ${cell.count} ${cell.count === 1 ? "entry" : "entries"}`
                        : cell?.dateKey
                    }
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
