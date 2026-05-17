import type { ComponentPropsWithoutRef } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";

/** Soft gradient shape — same spirit as the landing blobs / paper grain, scaled for journal home. */
export function JournalFlowerMark({
  className,
  ...rest
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "relative isolate shrink-0 overflow-hidden rounded-[42%]",
        "ring-1 ring-black/[0.05] dark:ring-white/[0.08]",
        "shadow-[0_14px_38px_-22px_hsl(var(--primary)/0.35)]",
        className,
      )}
      aria-hidden
      {...rest}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[hsl(42_42%_96%/0.85)] via-transparent to-[hsl(186_28%_88%/0.35)] dark:from-[hsl(186_25%_14%/0.5)] dark:via-transparent dark:to-[hsl(var(--primary)/0.12)]" />
      <div className="pointer-events-none absolute -inset-[42%]">
        <div
          className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[22px]"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--primary) / 0.38) 0%, hsl(var(--primary) / 0.06) 52%, transparent 70%)",
          }}
        />
        <div className="absolute left-[6%] top-[14%] h-[52%] w-[52%] rounded-full bg-[hsl(186_30%_72%/0.42)] blur-[26px] dark:bg-[hsl(186_35%_42%/0.38)]" />
        <div className="absolute bottom-[10%] right-[4%] h-[56%] w-[50%] rounded-full bg-[hsl(42_48%_82%/0.62)] blur-[24px] dark:bg-[hsl(30_28%_34%/0.45)]" />
        <div className="absolute left-[28%] bottom-[4%] h-[38%] w-[44%] rounded-full bg-[hsl(var(--primary)/0.22)] blur-[18px] dark:bg-[hsl(var(--primary)/0.28)]" />
      </div>
    </div>
  );
}

/** Horizontal week strip (Mon–Sun) — today emphasized like the reference journal UI. */
export function HomeWeekStrip({ className }: { className?: string }) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div
      className={cn(
        "flex justify-between gap-0.5 sm:gap-1 flex-1 min-w-0 select-none",
        className,
      )}
      aria-hidden
    >
      {days.map((day) => {
        const isToday = isSameDay(day, today);
        const dow = format(day, "EEE").slice(0, 2);
        const dom = format(day, "d");
        return (
          <div
            key={day.toISOString()}
            className={cn(
              "flex flex-col items-center min-w-0 flex-1 text-[9px] sm:text-[10px] tracking-tight",
              isToday ? "text-foreground font-semibold" : "text-muted-foreground/75 font-normal",
            )}
          >
            <span className="tabular-nums">{dow}</span>
            <span className={cn("tabular-nums", isToday && "scale-105")}>{dom}</span>
            {isToday ? (
              <span className="mt-0.5 h-0.5 w-3 rounded-full bg-primary/70" />
            ) : (
              <span className="mt-0.5 h-0.5 w-3 rounded-full bg-transparent" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function formatJournalHeadingDate(d: Date): string {
  return format(d, "EEEE, MMM d").toUpperCase();
}
