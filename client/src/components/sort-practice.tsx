import { useMemo, useState } from "react";
import { Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type {
  SortPromptPayload,
  SortResponse,
  ThreadTurn,
  Bookmark,
} from "@shared/schema";

// SortPractice
//
// A dedicated Signal / Noise practice moment inserted into the deepening
// thread. The server hands us 6–8 short phrases distilled from the actual
// conversation. The user sorts each one — by hand — into "matters" or "noise"
// (or leaves it in the pool as "not sure"). When they press Done, we submit
// to /api/sift/:id/sort, which persists the sort, updates the bookmark's
// matters/noise with the user's choices, and returns the next Sift reply.
//
// Design rules (from the brief):
//   - Calm and intentional, not gamey. No drag animations, no random motion.
//   - Reflects the actual conversation — phrases come from the thread.
//   - Emotionally spacious. One clear thing on the screen.
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
  // Per-item assignment. Items not in the map are still "in the pool".
  const [assignments, setAssignments] = useState<Record<string, Bin>>({});
  const [submitting, setSubmitting] = useState(false);

  const items = payload.items;

  const pool = useMemo(
    () => items.filter((it) => !assignments[it]),
    [items, assignments],
  );
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

  function assign(item: string, bin: Bin) {
    setAssignments((prev) => ({ ...prev, [item]: bin }));
  }
  function unassign(item: string) {
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[item];
      return next;
    });
  }

  const pooledCount = pool.length;
  const anyAssigned = matters.length + noise.length + unsure.length > 0;
  const allSorted = pooledCount === 0;

  async function submit(skipped: boolean) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const body = skipped
        ? { matters: [], noise: [], unsure: [], skipped: true }
        : {
            matters,
            noise,
            unsure: [...unsure, ...pool], // anything still in the pool reads as unsure
          };
      const res = await apiRequest("POST", `/api/sift/${siftId}/sort`, body);
      const data = (await res.json()) as SortResponse;
      if (data.type === "care") {
        onCare();
        return;
      }
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
        A pause — sort by hand
      </p>
      <p
        className="font-serif text-xl md:text-2xl leading-snug text-foreground/95 mb-2"
        data-testid="text-sort-intro"
      >
        {payload.intro}
      </p>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        Move each phrase into what seems to matter most right now, what may be
        noise right now, or set it aside if you are not sure. Your sort shapes
        what happens next.
      </p>

      {/* Pool of unsorted phrases. Each is a calm typographic row with three
          quiet actions — no drag, no animation, no color overload. */}
      {pool.length > 0 && (
        <div className="mb-6" data-testid="sort-pool">
          <p className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground/80 mb-3 font-medium">
            {anyAssigned
              ? `Still to sort · ${pool.length}`
              : `From this thread · ${pool.length}`}
          </p>
          <ul className="space-y-2.5">
            {pool.map((item) => (
              <li
                key={item}
                className="rounded-xl border border-border/60 bg-background px-4 py-3"
                data-testid={`sort-item-${slug(item)}`}
              >
                <p
                  className="text-[15px] leading-relaxed text-foreground/90 mb-3"
                  data-testid={`sort-item-text-${slug(item)}`}
                >
                  {item}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <SortButton
                    variant="matters"
                    onClick={() => assign(item, "matters")}
                    testId={`button-assign-matters-${slug(item)}`}
                  >
                    Matters
                  </SortButton>
                  <SortButton
                    variant="noise"
                    onClick={() => assign(item, "noise")}
                    testId={`button-assign-noise-${slug(item)}`}
                  >
                    Noise
                  </SortButton>
                  <SortButton
                    variant="unsure"
                    onClick={() => assign(item, "unsure")}
                    testId={`button-assign-unsure-${slug(item)}`}
                  >
                    Not sure
                  </SortButton>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sorted columns — matters first, then noise, then unsure. Each item
          is tappable to move it back out. Labels are verbatim product copy. */}
      <div className="space-y-5">
        <SortedColumn
          label="What seems to matter most right now"
          tone="matters"
          items={matters}
          onUnassign={unassign}
        />
        <SortedColumn
          label="What may be noise right now"
          tone="noise"
          items={noise}
          onUnassign={unassign}
        />
        {unsure.length > 0 && (
          <SortedColumn
            label="Not sure yet"
            tone="unsure"
            items={unsure}
            onUnassign={unassign}
          />
        )}
      </div>

      <div className="mt-7 pt-5 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
        <p
          className="text-xs text-muted-foreground/70"
          data-testid="text-sort-helper"
        >
          {allSorted
            ? "Ready when you are."
            : pool.length === items.length
            ? "Tap a row to place it."
            : `${pool.length} left in the pool.`}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={submitting}
            data-testid="button-sort-skip"
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors disabled:opacity-50"
          >
            Skip this for now
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
    </div>
  );
}

// --- Sub-components ---

function SortButton({
  variant,
  children,
  onClick,
  testId,
}: {
  variant: Bin;
  children: React.ReactNode;
  onClick: () => void;
  testId: string;
}) {
  const base =
    "text-xs tracking-wide px-3 py-1.5 rounded-full border transition-colors";
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
      className={`${base} ${styles[variant]}`}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function SortedColumn({
  label,
  tone,
  items,
  onUnassign,
}: {
  label: string;
  tone: Bin;
  items: string[];
  onUnassign: (item: string) => void;
}) {
  if (items.length === 0) {
    // Still render the label so the user sees the two homes waiting to receive
    // phrases. An empty state keeps the spatial structure clear.
    return (
      <div data-testid={`sort-column-${tone}-empty`}>
        <p className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground/80 mb-2 font-medium">
          {label}
        </p>
        <div className="rounded-xl border border-dashed border-border/60 px-4 py-3">
          <p className="text-sm text-muted-foreground/70">
            {tone === "matters"
              ? "Nothing placed here yet."
              : tone === "noise"
              ? "Nothing placed here yet."
              : "Nothing set aside."}
          </p>
        </div>
      </div>
    );
  }
  const rowStyles: Record<Bin, string> = {
    matters: "border-primary/30 bg-primary/5",
    noise: "border-border bg-muted/30",
    unsure: "border-dashed border-border/70 bg-transparent",
  };
  return (
    <div data-testid={`sort-column-${tone}`}>
      <p className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground/80 mb-2 font-medium">
        {label}
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className={`rounded-xl border ${rowStyles[tone]} px-4 py-2.5 flex items-start justify-between gap-3`}
            data-testid={`sort-placed-${tone}-${slug(item)}`}
          >
            <span
              className={`text-[15px] leading-relaxed ${
                tone === "noise"
                  ? "text-muted-foreground"
                  : "text-foreground/90"
              }`}
            >
              {item}
            </span>
            <button
              type="button"
              onClick={() => onUnassign(item)}
              aria-label={`Move "${item}" back`}
              className="text-muted-foreground/60 hover:text-foreground transition-colors shrink-0 mt-0.5"
              data-testid={`button-unassign-${tone}-${slug(item)}`}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
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
