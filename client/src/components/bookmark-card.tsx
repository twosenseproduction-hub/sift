import { useState } from "react";
import { Bookmark as BookmarkIcon, ChevronDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Bookmark, BreakdownResponse } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import type React from "react";

// Compact re-entry card. Starts collapsed — shows just "Where you left this
// thread" + a calm one-liner derived from the latest checkpoint. Tapping the
// whole card expands it into the six labeled sections (spec labels preserved
// verbatim). "Keep processing this" is the primary re-entry action.
//
// Labels (must match spec exactly):
//   "What this may be pointing to"
//   "What has unfolded so far"
//   "What seems to matter most right now"
//   "What may be noise right now"
//   "Where you last landed"
//   "A next step, if there is one"
interface BookmarkCardProps {
  bookmark: Bookmark;
  onKeepProcessing: () => void;
  onCloseLoop?: () => void;
  // When rendered at the top of a thread page we want it open by default.
  defaultOpen?: boolean;
  // Sift ID for the breakdown API call
  siftId?: string;
}

export function BookmarkCard({
  bookmark,
  onKeepProcessing,
  onCloseLoop,
  defaultOpen = false,
  siftId,
}: BookmarkCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownSteps, setBreakdownSteps] = useState<string[] | null>(null);
  const [breakdownError, setBreakdownError] = useState(false);
  const p = bookmark.payload;

  const handleBreakdown = async () => {
    if (breakdownSteps || breakdownLoading) return;
    setBreakdownLoading(true);
    setBreakdownError(false);
    try {
      const res = await apiRequest("POST", `/api/sift/${siftId}/breakdown`, {
        nextStep: p.nextStep,
      });
      const data: BreakdownResponse = await res.json();
      setBreakdownSteps(data.microSteps);
    } catch {
      setBreakdownError(true);
    } finally {
      setBreakdownLoading(false);
    }
  };

  return (
    <section
      className="rounded-2xl border border-border/60 bg-card/60 px-5 py-5 md:px-6 md:py-6"
      data-testid="card-bookmark"
    >
      {/* Header — tappable to toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="bookmark-body"
        data-testid="button-bookmark-toggle"
        className="w-full flex items-start justify-between gap-4 text-left group"
      >
        <div className="flex items-start gap-3 min-w-0">
          <BookmarkIcon
            className="w-4 h-4 mt-1 text-primary shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p
              className="text-[11px] tracking-[0.25em] uppercase text-primary/80 font-medium mb-2"
              data-testid="text-bookmark-eyebrow"
            >
              Where you left this thread
            </p>
            <p
              className="text-base md:text-lg leading-relaxed text-foreground/90"
              data-testid="text-bookmark-summary"
            >
              {p.lastLanded}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 mt-2 shrink-0 text-muted-foreground transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id="bookmark-body"
          data-testid="panel-bookmark"
          className="mt-6 space-y-5 fade-in-slow"
        >
          <Section label="What this may be pointing to" testId="bookmark-pointing">
            <p className="text-[15px] leading-relaxed text-foreground/90">
              {p.pointing}
            </p>
          </Section>

          <Section label="What has unfolded so far" testId="bookmark-unfolded">
            <p className="text-[15px] leading-relaxed text-foreground/90">
              {p.unfolded}
            </p>
          </Section>

          <Section
            label="What seems to matter most right now"
            testId="bookmark-matters"
          >
            <ul className="space-y-1.5">
              {p.matters.map((m, i) => (
                <li
                  key={`m-${i}`}
                  className="text-[15px] leading-relaxed text-foreground/90 flex gap-2"
                  data-testid={`text-bookmark-matters-${i}`}
                >
                  <span className="text-primary/60 mt-[0.4em]">·</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section label="What may be noise right now" testId="bookmark-noise">
            <ul className="space-y-1.5">
              {p.noise.map((n, i) => (
                <li
                  key={`n-${i}`}
                  className="text-[15px] leading-relaxed text-muted-foreground flex gap-2"
                  data-testid={`text-bookmark-noise-${i}`}
                >
                  <span className="text-muted-foreground/50 mt-[0.4em]">·</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section label="A next step, if there is one" testId="bookmark-next">
            <p className="text-[15px] leading-relaxed text-foreground/90">
              {p.nextStep}
            </p>
            {/* Break down button */}
            {siftId && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleBreakdown}
                  disabled={breakdownLoading}
                  className={cn(
                    "text-[11px] text-primary/60 hover:text-primary transition-colors disabled:opacity-40",
                    breakdownLoading && "animate-pulse"
                  )}
                  data-testid="button-breakdown"
                >
                  {breakdownLoading
                    ? "Breaking it down…"
                    : breakdownSteps
                    ? "Break down again"
                    : "Break it down"}
                </button>

                {/* Micro-steps box */}
                {breakdownSteps && (
                  <div
                    className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 fade-in"
                    data-testid="panel-micro-steps"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-widest text-primary/70 mb-2">
                      Smaller version
                    </p>
                    <ol className="space-y-1.5">
                      {breakdownSteps.map((step, i) => (
                        <li
                          key={i}
                          className="text-sm text-foreground/80 flex gap-2"
                        >
                          <span className="text-primary/50 mt-[0.15em] tabular-nums select-none">
                            {i + 1}.
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {breakdownError && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Could not break it down right now.
                  </p>
                )}
              </div>
            )}
          </Section>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={onKeepProcessing}
              data-testid="button-keep-processing"
              className="gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              Keep processing this
            </Button>
            {onCloseLoop && (
              <Button
                type="button"
                variant="outline"
                onClick={onCloseLoop}
                data-testid="button-close-loop"
              >
                Close this loop
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Section({
  label,
  testId,
  children,
}: {
  label: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <div data-testid={`section-${testId}`}>
      <p
        className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground/80 mb-1.5 font-medium"
        data-testid={`label-${testId}`}
      >
        {label}
      </p>
      {children}
    </div>
  );
}
