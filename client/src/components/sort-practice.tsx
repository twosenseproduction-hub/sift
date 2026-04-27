import { useEffect, useMemo, useState } from "react";
import { Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { track } from "@/lib/track";
import type {
  SortPromptPayload,
  SortResponse,
  ThreadTurn,
  Bookmark,
} from "@shared/schema";

// Quiet, low-contrast feedback shown for ~1.4s after a card is placed.
// These are deliberately provisional — they teach pattern recognition
// without lecturing. Match the brief's tone rules.
const RATIONALES: Record<"matters" | "noise" | "unsure", string> = {
  matters: "This seems to carry consequence.",
  noise: "This feels loud, but not clarifying.",
  unsure: "Unclear can still be honest.",
};

// A printed-margin-note legend kept always visible beneath the choice
// buttons. Editorial footnote register, not a feature callout. The phrasing
// here intentionally diverges from the per-placement RATIONALES so the
// legend reads like a quiet reference rather than echoing the feedback line.
const LEGEND: Record<"matters" | "noise" | "unsure", string> = {
  matters: "changes something if faced",
  noise: "loud, but not clarifying",
  unsure: "unclear is still honest",
};

// SortPractice
//
// A dedicated Signal / Noise practice moment inserted into the deepening
// thread. The server hands us 6–8 short phrases distilled from the actual
// conversation. The user sorts them — one card at a time — into "matters"
// or "noise" (or sets aside as "not sure"). When the deck is done, we submit
// to /api/sift/:id/sort, which persists the sort, updates the bookmark's
// matters/noise with the user's choices, and returns the next Sift reply.
//
// Design rules (from the brief):
//   - One card at a time. Focused, spacious, sequential.
//   - Calm and intentional, not gamey. Subtle transitions, no drag.
//   - Reflects the actual conversation — phrases come from the thread.
//   - Mobile-first. Low cognitive load.
//   - Materially affects what Sift says next.
//
// Labels match the product spec verbatim:
//   "What seems to matter most right now"
//   "What may be noise right now"

type Bin = "matters" | "noise" | "unsure";

interface SortPracticeProps {
  siftId: string;
  promptTurnId: number;
  payload: SortPromptPayload;
  onComplete: (args: {
    turns: ThreadTurn[];
    bookmark?: Bookmark;
    converged?: boolean;
  }) => void;
  onCare: () => void;
}

export function SortPractice({
  siftId,
  promptTurnId,
  payload,
  onComplete,
  onCare,
}: SortPracticeProps) {
  const { toast } = useToast();
  const items = payload.items;

  // Per-item assignment. Items not in the map are still "in the deck".
  const [assignments, setAssignments] = useState<Record<string, Bin>>({});
  // Which card index we're currently looking at.
  const [cursor, setCursor] = useState(0);
  // Brief fade between cards so the change is felt, not jarring.
  const [transitioning, setTransitioning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // The bin the user just picked, surfaced as a quiet rationale line for ~1.4s.
  // Cleared when the next card arrives or when undo wipes the placement.
  const [lastBin, setLastBin] = useState<Bin | null>(null);

  // Fire "shown" once when the practice mounts.
  useEffect(() => {
    track("sn.shown", { count: items.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-clear the rationale line so it doesn't linger past the moment.
  useEffect(() => {
    if (!lastBin) return;
    const id = window.setTimeout(() => setLastBin(null), 1400);
    return () => window.clearTimeout(id);
  }, [lastBin, cursor]);

  const matters = useMemo(
    () => items.filter((it) => assignments[it] === "matters"),
    [items, assignments],
  );
  const noise = useMemo(
    () => items.filter((it) => assignments[it] === "noise"),
    [items, assignments],
  );
  const unsure = useMemo(
    () => items.filter((it) => assignments[it] === "unsure"),
    [items, assignments],
  );

  const total = items.length;
  const current = cursor < total ? items[cursor] : null;
  const deckDone = cursor >= total;
  const anyAssigned = matters.length + noise.length + unsure.length > 0;

  function chooseCurrent(bin: Bin) {
    if (!current || transitioning) return;
    const item = current;
    setAssignments((prev) => ({ ...prev, [item]: bin }));
    setLastBin(bin);
    track(`sn.card_placed.${bin}` as const, { phrase: item });
    // Subtle transition to the next card.
    setTransitioning(true);
    window.setTimeout(() => {
      setCursor((c) => c + 1);
      setTransitioning(false);
    }, 180);
  }

  function undoLast() {
    if (cursor === 0 || transitioning) return;
    const prevIndex = cursor - 1;
    const prevItem = items[prevIndex];
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[prevItem];
      return next;
    });
    setLastBin(null);
    setTransitioning(true);
    window.setTimeout(() => {
      setCursor(prevIndex);
      setTransitioning(false);
    }, 140);
  }

  async function submit(skipped: boolean) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const body = skipped
        ? { matters: [], noise: [], unsure: [], skipped: true }
        : {
            matters,
            noise,
            // Anything the user never reached reads as unsure.
            unsure: [
              ...unsure,
              ...items.filter((it) => !assignments[it]),
            ],
          };
      const res = await apiRequest("POST", `/api/sift/${siftId}/sort`, body);
      const data = (await res.json()) as SortResponse;
      if (data.type === "care") {
        onCare();
        return;
      }
      track(skipped ? "sn.skipped" : "sn.completed", {
        matters: matters.length,
        noise: noise.length,
        unsure: unsure.length,
      });
      if (!skipped) track("sn.next_step_generated");
      onComplete({
        turns: data.turns,
        bookmark: data.bookmark,
        converged: data.converged,
      });
    } catch (err: any) {
      toast({
        title: "Couldn't save that sort",
        description: err?.message ?? "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="rounded-2xl border border-border/60 bg-card/40 px-5 py-6 md:px-7 md:py-8"
      data-testid={`sort-practice-${promptTurnId}`}
    >
      <p
        className="text-[11px] tracking-[0.25em] uppercase text-primary/80 mb-3 font-medium"
        data-testid="label-sort-practice"
      >
        A pause — one at a time
      </p>
      <p
        className="font-serif text-xl md:text-2xl leading-snug text-foreground/95 mb-2"
        data-testid="text-sort-intro"
      >
        {payload.intro}
      </p>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        A few phrases from this thread, one at a time. Place each one where it
        seems to belong right now.
      </p>

      {/* Progress — quiet, not gamified. */}
      <div
        className="flex items-center justify-between mb-5"
        data-testid="sort-progress"
      >
        <p className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground/80 font-medium">
          {deckDone
            ? `Sorted · ${total} of ${total}`
            : `Phrase ${Math.min(cursor + 1, total)} of ${total}`}
        </p>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {items.map((it, idx) => {
            const assigned = assignments[it];
            const isCurrent = idx === cursor && !deckDone;
            return (
              <span
                key={it}
                className={[
                  "h-1.5 rounded-full transition-all duration-300",
                  isCurrent ? "w-5" : "w-1.5",
                  assigned === "matters"
                    ? "bg-primary/70"
                    : assigned === "noise"
                    ? "bg-muted-foreground/40"
                    : assigned === "unsure"
                    ? "bg-muted-foreground/25"
                    : isCurrent
                    ? "bg-foreground/40"
                    : "bg-border",
                ].join(" ")}
              />
            );
          })}
        </div>
      </div>

      {/* One card at a time. Fades softly between cards. */}
      {current && (
        <div
          className={[
            "rounded-xl border border-border/60 bg-background px-5 py-6 md:px-6 md:py-7 transition-opacity duration-200",
            transitioning ? "opacity-0" : "opacity-100",
          ].join(" ")}
          data-testid={`sort-card-${slug(current)}`}
          aria-live="polite"
        >
          <p
            className="font-serif text-lg md:text-xl leading-snug text-foreground/95 mb-3 min-h-[2.5rem]"
            data-testid={`sort-card-text-${slug(current)}`}
          >
            {current}
          </p>
          {/* Quiet rationale line. Always-rendered with reserved height so the
              choice buttons never jump. Fades in when a placement just happened. */}
          <p
            className={[
              "text-xs italic text-muted-foreground/80 mb-4 min-h-[1.25rem] transition-opacity duration-500",
              lastBin ? "opacity-100" : "opacity-0",
            ].join(" ")}
            aria-live="polite"
            data-testid="sort-rationale"
          >
            {lastBin ? RATIONALES[lastBin] : "\u00A0"}
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2">
            <ChoiceButton
              variant="matters"
              onClick={() => chooseCurrent("matters")}
              testId={`button-assign-matters-${slug(current)}`}
              disabled={transitioning}
            >
              What matters
            </ChoiceButton>
            <ChoiceButton
              variant="noise"
              onClick={() => chooseCurrent("noise")}
              testId={`button-assign-noise-${slug(current)}`}
              disabled={transitioning}
            >
              Noise
            </ChoiceButton>
            <ChoiceButton
              variant="unsure"
              onClick={() => chooseCurrent("unsure")}
              testId={`button-assign-unsure-${slug(current)}`}
              disabled={transitioning}
            >
              Not sure yet
            </ChoiceButton>
          </div>
          {/* A quiet legend — printed-margin note, not a callout. Always
              visible beneath the buttons so users do not have to remember
              the distinction from memory. Stays tertiary to the card and
              the buttons themselves. */}
          <p
            className="mt-3 text-[11px] leading-relaxed text-muted-foreground/70"
            data-testid="sort-legend"
          >
            <span className="text-muted-foreground/85">What matters</span>
            <span className="text-muted-foreground/60"> — {LEGEND.matters}</span>
            <span aria-hidden="true" className="px-2 text-muted-foreground/40">·</span>
            <span className="text-muted-foreground/85">Noise</span>
            <span className="text-muted-foreground/60"> — {LEGEND.noise}</span>
            <span aria-hidden="true" className="px-2 text-muted-foreground/40">·</span>
            <span className="text-muted-foreground/85">Not sure yet</span>
            <span className="text-muted-foreground/60"> — {LEGEND.unsure}</span>
          </p>
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={undoLast}
              disabled={cursor === 0 || transitioning}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/80 hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="button-sort-undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo last
            </button>
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={submitting}
              data-testid="button-sort-skip"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors disabled:opacity-50"
            >
              Skip this for now
            </button>
          </div>
        </div>
      )}

      {/* When the deck is done, show a calm summary and the done button. */}
      {deckDone && (
        <div
          className="rounded-xl border border-border/60 bg-background px-5 py-6 md:px-6 md:py-7"
          data-testid="sort-summary"
        >
          <p className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground/80 mb-4 font-medium">
            How you sorted
          </p>
          <div className="space-y-4 mb-5">
            <SummaryRow
              label="What seems to matter most right now"
              tone="matters"
              items={matters}
            />
            <SummaryRow
              label="What may be noise right now"
              tone="noise"
              items={noise}
            />
            {unsure.length > 0 && (
              <div>
                <SummaryRow
                  label="Not sure yet"
                  tone="unsure"
                  items={unsure}
                />
                <p
                  className="mt-2 text-xs italic text-muted-foreground/80"
                  data-testid="text-unsure-caption"
                >
                  Unclear can still be honest. These can come back later, no
                  pressure to decide now.
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/60">
            <button
              type="button"
              onClick={undoLast}
              disabled={submitting || cursor === 0}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/80 hover:text-foreground transition-colors disabled:opacity-40"
              data-testid="button-sort-revise"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Revise last
            </button>
            <Button
              type="button"
              onClick={() => submit(false)}
              disabled={submitting || !anyAssigned}
              data-testid="button-sort-done"
              className="gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving sort…
                </>
              ) : (
                "Done sorting"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function ChoiceButton({
  variant,
  children,
  onClick,
  testId,
  disabled,
}: {
  variant: Bin;
  children: React.ReactNode;
  onClick: () => void;
  testId: string;
  disabled?: boolean;
}) {
  const base =
    "flex-1 text-sm tracking-wide px-4 py-2.5 rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const styles: Record<Bin, string> = {
    matters:
      "border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50",
    noise:
      "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground",
    unsure:
      "border-dashed border-border/70 text-muted-foreground hover:bg-muted/30 hover:text-foreground",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles[variant]}`}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function SummaryRow({
  label,
  tone,
  items,
}: {
  label: string;
  tone: Bin;
  items: string[];
}) {
  const rowStyles: Record<Bin, string> = {
    matters: "border-primary/30 bg-primary/5 text-foreground/90",
    noise: "border-border bg-muted/30 text-muted-foreground",
    unsure: "border-dashed border-border/70 bg-transparent text-foreground/80",
  };
  return (
    <div data-testid={`sort-summary-${tone}`}>
      <p className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground/80 mb-2 font-medium">
        {label}
      </p>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 px-4 py-2.5">
          <p className="text-sm text-muted-foreground/70">
            {tone === "unsure" ? "Nothing set aside." : "Nothing placed here."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item}
              className={`rounded-xl border ${rowStyles[tone]} px-4 py-2.5 text-[15px] leading-relaxed`}
              data-testid={`sort-placed-${tone}-${slug(item)}`}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
