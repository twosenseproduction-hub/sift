import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Hardcoded token pool. 4 are randomly sampled per open.
const TOKEN_POOL = [
  "pressure",
  "timing",
  "fear",
  "money",
  "clarity",
  "expectation",
  "control",
  "avoidance",
  "proof",
  "rest",
  "urgency",
  "guilt",
] as const;

type Bucket = "matters" | "noise";

/**
 * QuickResetOutcome — what the parent gets back when the user completes the sort.
 * `seed` is a soft composer seed; parent decides whether/how to apply it.
 */
export type QuickResetOutcome = {
  mattersCount: number;
  noiseCount: number;
  seed: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user taps the completion CTA. Parent routes the seed into the composer. */
  onComplete: (outcome: QuickResetOutcome) => void;
}

function sampleFour(): string[] {
  const arr = [...TOKEN_POOL];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 4);
}

function completionCopy(mattersCount: number, noiseCount: number) {
  if (mattersCount >= 3) {
    return {
      title: "There’s something here worth naming.",
      cta: "Start from that",
      seed:
        "Start with what feels most important, even if it’s unfinished.",
    };
  }
  if (noiseCount >= 3) {
    return {
      title: "Some of this may be louder than it is important.",
      cta: "Sift what’s underneath",
      seed:
        "What feels loud right now, and what might be underneath it?",
    };
  }
  return {
    title: "You may not need the whole picture yet.",
    cta: "Begin",
    seed: "What feels most real right now?",
  };
}

export function QuickResetDialog({ open, onOpenChange, onComplete }: Props) {
  const [tokens, setTokens] = useState<string[]>(() => sampleFour());
  // Parallel to `tokens` — null = unsorted, else bucket.
  const [placement, setPlacement] = useState<(Bucket | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Re-sample on each open; reset placement and selection.
  useEffect(() => {
    if (open) {
      setTokens(sampleFour());
      setPlacement([null, null, null, null]);
      setSelectedIdx(null);
    }
  }, [open]);

  const mattersCount = placement.filter((b) => b === "matters").length;
  const noiseCount = placement.filter((b) => b === "noise").length;
  const placedCount = mattersCount + noiseCount;
  const done = placedCount === 4;

  const completion = useMemo(
    () => completionCopy(mattersCount, noiseCount),
    [mattersCount, noiseCount],
  );

  const pickChip = (idx: number) => {
    if (placement[idx] !== null) {
      // Tap an already-placed chip to unplace it.
      const next = [...placement];
      next[idx] = null;
      setPlacement(next);
      setSelectedIdx(idx);
      return;
    }
    setSelectedIdx(selectedIdx === idx ? null : idx);
  };

  const sendTo = (bucket: Bucket) => {
    if (selectedIdx === null) return;
    const next = [...placement];
    next[selectedIdx] = bucket;
    setPlacement(next);
    // Auto-advance: pick the next unsorted chip so users can keep tapping.
    const nextUnsorted = next.findIndex((b) => b === null);
    setSelectedIdx(nextUnsorted === -1 ? null : nextUnsorted);
  };

  const handleDone = () => {
    onComplete({
      mattersCount,
      noiseCount,
      seed: completion.seed,
    });
    onOpenChange(false);
  };

  const chipsFor = (bucket: Bucket) =>
    tokens
      .map((t, i) => ({ t, i }))
      .filter(({ i }) => placement[i] === bucket);

  const unsorted = tokens
    .map((t, i) => ({ t, i }))
    .filter(({ i }) => placement[i] === null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="dialog-quick-reset"
      >
        <DialogHeader>
          <DialogTitle
            className="font-serif text-xl md:text-2xl"
            data-testid="text-reset-title"
          >
            Signal / Noise
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            What is asking for attention right now? Tap a word, then tap where
            it belongs.
          </DialogDescription>
        </DialogHeader>

        {!done ? (
          <div className="mt-1 space-y-5" data-testid="section-reset-sort">
            {/* Unsorted chips */}
            <div
              className="flex flex-wrap gap-2 min-h-[44px]"
              role="list"
              aria-label="Words to sort"
            >
              {unsorted.length === 0 ? (
                <span className="text-xs text-muted-foreground/70">
                  All sorted.
                </span>
              ) : (
                unsorted.map(({ t, i }) => (
                  <button
                    key={i}
                    type="button"
                    role="listitem"
                    onClick={() => pickChip(i)}
                    data-testid={`chip-token-${t}`}
                    aria-pressed={selectedIdx === i}
                    className={[
                      "px-4 py-2 rounded-full border text-sm transition-colors",
                      "min-h-[40px]",
                      selectedIdx === i
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card hover:border-foreground/40 text-foreground/80",
                    ].join(" ")}
                  >
                    {t}
                  </button>
                ))
              )}
            </div>

            {/* Buckets */}
            <div className="grid grid-cols-2 gap-3">
              <Bucket
                label="Matters"
                disabled={selectedIdx === null}
                onPlace={() => sendTo("matters")}
                chips={chipsFor("matters")}
                onChipTap={pickChip}
                testid="bucket-matters"
              />
              <Bucket
                label="Noise"
                disabled={selectedIdx === null}
                onPlace={() => sendTo("noise")}
                chips={chipsFor("noise")}
                onChipTap={pickChip}
                testid="bucket-noise"
              />
            </div>

            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              No right answer. Just sort what feels true.
            </p>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                data-testid="link-reset-skip"
                className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        ) : (
          <div
            className="mt-2 space-y-5"
            data-testid="section-reset-complete"
          >
            <p
              className="font-serif text-lg md:text-xl leading-snug text-foreground"
              data-testid="text-reset-complete-title"
            >
              {completion.title}
            </p>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                data-testid="link-reset-close"
                className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
              >
                Close
              </button>
              <Button
                onClick={handleDone}
                data-testid="button-reset-cta"
              >
                {completion.cta}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface BucketProps {
  label: string;
  disabled: boolean;
  onPlace: () => void;
  chips: { t: string; i: number }[];
  onChipTap: (idx: number) => void;
  testid: string;
}

function Bucket({
  label,
  disabled,
  onPlace,
  chips,
  onChipTap,
  testid,
}: BucketProps) {
  return (
    <button
      type="button"
      onClick={onPlace}
      disabled={disabled && chips.length === 0}
      data-testid={testid}
      aria-label={`Place selected word in ${label}`}
      className={[
        "rounded-xl border text-left p-3 min-h-[112px] transition-colors",
        "flex flex-col gap-2",
        disabled
          ? "border-border/60 bg-card/40 cursor-default"
          : "border-border bg-card hover:border-primary hover:bg-primary/5 cursor-pointer",
      ].join(" ")}
    >
      <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-medium">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {chips.length === 0 ? (
          <span className="text-xs text-muted-foreground/60">—</span>
        ) : (
          chips.map(({ t, i }) => (
            <span
              key={i}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChipTap(i);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChipTap(i);
                }
              }}
              data-testid={`chip-placed-${t}`}
              className="px-3 py-1 rounded-full border border-border/80 bg-background text-xs text-foreground/80"
            >
              {t}
            </span>
          ))
        )}
      </div>
    </button>
  );
}
