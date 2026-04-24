import { useState } from "react";
import { Bookmark as BookmarkIcon, ChevronDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Bookmark } from "@shared/schema";

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
}

export function BookmarkCard({
  bookmark,
  onKeepProcessing,
  onCloseLoop,
  defaultOpen = false,
}: BookmarkCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const p = bookmark.payload;

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
