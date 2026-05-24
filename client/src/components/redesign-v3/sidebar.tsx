import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function RedesignV3Sidebar({
  activeStep,
  microDoneCount = 0,
  microTotal = 4,
  onRelease,
  className,
}: {
  activeStep?: string | null;
  microDoneCount?: number;
  microTotal?: number;
  onRelease?: () => void;
  className?: string;
}) {
  return (
    <aside className={cn("v3-sidebar", className)} aria-label="Session sidebar">
      <div>
        <p className="v3-sidebar-label">Today</p>
        <div className="v3-sidebar-item active">
          <span className="v3-sidebar-dot" aria-hidden />
          New entry
        </div>
      </div>

      {activeStep?.trim() ? (
        <div className="v3-sidebar-active-step">
          <div className="v3-sidebar-step-eyebrow">
            <span
              className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--v3-leaf-accent)]"
              aria-hidden
            />
            Carrying now
          </div>
          <p className="v3-sidebar-step-text">{activeStep}</p>
          <div className="v3-progress-pips" aria-hidden>
            {Array.from({ length: microTotal }, (_, i) => (
              <div key={i} className={cn("v3-pip", i < microDoneCount && "done")} />
            ))}
          </div>
          {onRelease ? (
            <button
              type="button"
              onClick={onRelease}
              className="mt-3 text-[10px] uppercase tracking-[0.14em] text-[color:var(--v3-sage)] transition hover:text-[color:var(--v3-leaf-mid)]"
            >
              Release →
            </button>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

export function RedesignV3Layout({
  sidebar,
  children,
  className,
}: {
  sidebar?: React.ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative z-10 flex min-h-0 flex-1", className)}>
      {sidebar}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
