import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Token pool — a mix of charged/pressure-flavored and grounded words so the
// sort can lean either way. Sampled N per open (enough signal, still small).
const TOKEN_POOL = [
  "pressure",
  "behind",
  "rushed",
  "urgency",
  "should",
  "proving",
  "fear",
  "guilt",
  "control",
  "rest",
  "truth",
  "space",
  "breath",
  "clarity",
  "enough",
  "quiet",
] as const;

// Loose classification used only for the post-sort reflection. Not shown to
// the user. Words not listed are treated as neutral.
const LOUD_WORDS = new Set<string>([
  "pressure",
  "behind",
  "rushed",
  "urgency",
  "should",
  "proving",
  "fear",
  "guilt",
  "control",
]);
const GROUNDED_WORDS = new Set<string>([
  "rest",
  "truth",
  "space",
  "breath",
  "clarity",
  "enough",
  "quiet",
]);

type Bucket = "loud" | "real";

/**
 * QuickResetOutcome — what the parent gets back when the user completes the sort.
 * `seed` is a soft composer seed; parent decides whether/how to apply it.
 */
export type QuickResetOutcome = {
  loudCount: number;
  realCount: number;
  seed: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user taps the completion CTA. Parent routes the seed into the composer. */
  onComplete: (outcome: QuickResetOutcome) => void;
}

const SAMPLE_SIZE = 5;

function sampleN(n: number): string[] {
  const arr = [...TOKEN_POOL];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

/** Small, safe haptic pulse. No-ops where unsupported. */
function haptic() {
  try {
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav && typeof nav.vibrate === "function") {
      nav.vibrate(8);
    }
  } catch {
    // ignore — haptics are strictly a nice-to-have
  }
}

/** Join a small word list in app voice ("a, b and c"). */
function joinWords(words: string[]): string {
  if (words.length === 0) return "";
  if (words.length === 1) return words[0];
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/**
 * Word-aware completion copy. Picks up on the cluster shape of what the user
 * actually sorted — not therapy, not a verdict. Just a quiet line that shows
 * the app noticed something.
 */
function completionCopy(
  loudWords: string[],
  realWords: string[],
): { title: string; cta: string; seed: string } {
  const loudHeavy = loudWords.filter((w) => LOUD_WORDS.has(w));
  const realGrounded = realWords.filter((w) => GROUNDED_WORDS.has(w));

  // Strong loud cluster — reflect the pressure words back.
  if (loudHeavy.length >= 2) {
    const cluster = joinWords(loudHeavy.slice(0, 3));
    return {
      title: `A lot of ${cluster} on the loud side today.`,
      cta: "Sift from that",
      seed: `Some of what feels loud right now is ${cluster}. What sits underneath it is`,
    };
  }

  // Real side is narrow (1–2 items) — reflect the smallness.
  if (realWords.length > 0 && realWords.length <= 2) {
    const anchor = realWords[0];
    return {
      title: `The real side is small — just ${joinWords(realWords)}.`,
      cta: "Start from that",
      seed: `If I stay with ${anchor}, what feels most true right now is`,
    };
  }

  // Real side is grounded — carry the tone forward.
  if (realGrounded.length >= 2) {
    const anchor = realGrounded[0];
    return {
      title: `There is ${joinWords(realGrounded.slice(0, 3))} on the real side.`,
      cta: "Stay with that",
      seed: `Starting from ${anchor}, what I actually want is`,
    };
  }

  // Nothing marked loud — everything feels real.
  if (loudWords.length === 0 && realWords.length > 0) {
    return {
      title: "Nothing feels loud — it all reads as real.",
      cta: "Begin",
      seed: "What I want to hold onto from all of this is",
    };
  }

  // Nothing marked real — everything feels loud.
  if (realWords.length === 0 && loudWords.length > 0) {
    return {
      title: "Most of this is louder than it is real.",
      cta: "Sift what's underneath",
      seed: "Under all the noise, the one thing that is actually real is",
    };
  }

  // Balanced / default.
  return {
    title: "A mix. Some real, some just loud.",
    cta: "Begin",
    seed: "What feels most real right now, past the noise, is",
  };
}

export function QuickResetDialog({ open, onOpenChange, onComplete }: Props) {
  const [tokens, setTokens] = useState<string[]>(() => sampleN(SAMPLE_SIZE));
  // Parallel to `tokens` — null = unsorted, else bucket.
  const [placement, setPlacement] = useState<(Bucket | null)[]>(() =>
    Array<Bucket | null>(SAMPLE_SIZE).fill(null),
  );
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [hoverBucket, setHoverBucket] = useState<Bucket | null>(null);
  const [justDroppedBucket, setJustDroppedBucket] = useState<Bucket | null>(
    null,
  );

  // Refs to the two bucket drop zones so pointer-based drag can hit-test.
  const loudRef = useRef<HTMLDivElement | null>(null);
  const realRef = useRef<HTMLDivElement | null>(null);

  // Re-sample on each open; reset placement.
  useEffect(() => {
    if (open) {
      setTokens(sampleN(SAMPLE_SIZE));
      setPlacement(Array<Bucket | null>(SAMPLE_SIZE).fill(null));
      setDraggingIdx(null);
      setHoverBucket(null);
      setJustDroppedBucket(null);
    }
  }, [open]);

  const loudCount = placement.filter((b) => b === "loud").length;
  const realCount = placement.filter((b) => b === "real").length;
  const placedCount = loudCount + realCount;
  const done = placedCount === tokens.length;

  const loudWords = useMemo(
    () => tokens.filter((_, i) => placement[i] === "loud"),
    [tokens, placement],
  );
  const realWords = useMemo(
    () => tokens.filter((_, i) => placement[i] === "real"),
    [tokens, placement],
  );

  const completion = useMemo(
    () => completionCopy(loudWords, realWords),
    [loudWords, realWords],
  );

  const bucketAtPoint = (x: number, y: number): Bucket | null => {
    const hit = (el: HTMLElement | null) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    if (hit(loudRef.current)) return "loud";
    if (hit(realRef.current)) return "real";
    return null;
  };

  const placeAt = (idx: number, bucket: Bucket) => {
    setPlacement((prev) => {
      const next = [...prev];
      next[idx] = bucket;
      return next;
    });
    haptic();
    setJustDroppedBucket(bucket);
    window.setTimeout(() => setJustDroppedBucket(null), 260);
  };

  const unplace = (idx: number) => {
    setPlacement((prev) => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
  };

  // Pointer-based drag that works on both touch and mouse. Tracks by index.
  const onPointerDown = (idx: number) => (e: React.PointerEvent) => {
    if (placement[idx] !== null) return;
    // Don't start a drag on secondary mouse buttons.
    if (e.button !== 0 && e.pointerType === "mouse") return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    setDraggingIdx(idx);
    setHoverBucket(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (draggingIdx === null) return;
    setHoverBucket(bucketAtPoint(e.clientX, e.clientY));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (draggingIdx === null) return;
    const target = bucketAtPoint(e.clientX, e.clientY);
    if (target) placeAt(draggingIdx, target);
    setDraggingIdx(null);
    setHoverBucket(null);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const onPointerCancel = () => {
    setDraggingIdx(null);
    setHoverBucket(null);
  };

  // Keyboard fallback: Enter/Space on an unplaced chip sends it to whichever
  // bucket has fewer items (keeps the feature accessible without requiring
  // the pointer drag).
  const onChipKey = (idx: number) => (e: React.KeyboardEvent) => {
    if (placement[idx] !== null) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const bucket: Bucket = loudCount <= realCount ? "loud" : "real";
      placeAt(idx, bucket);
    }
  };

  const handleDone = () => {
    onComplete({
      loudCount,
      realCount,
      seed: completion.seed,
    });
    onOpenChange(false);
  };

  const chipsFor = (bucket: Bucket) =>
    tokens
      .map((t, i) => ({ t, i }))
      .filter(({ i }) => placement[i] === bucket);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-quick-reset">
        <DialogHeader>
          <DialogTitle
            className="font-serif text-xl md:text-2xl"
            data-testid="text-reset-title"
          >
            Signal / Noise
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Drag each word into where it belongs.
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
              {tokens.map((t, i) => {
                if (placement[i] !== null) return null;
                const isDragging = draggingIdx === i;
                return (
                  <span
                    key={i}
                    role="listitem"
                    tabIndex={0}
                    aria-grabbed={isDragging}
                    data-testid={`chip-token-${t}`}
                    onPointerDown={onPointerDown(i)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerCancel}
                    onKeyDown={onChipKey(i)}
                    className={cn(
                      "select-none touch-none px-4 py-2 rounded-full border text-sm",
                      "min-h-[40px] leading-tight",
                      "cursor-grab active:cursor-grabbing transition-colors",
                      isDragging
                        ? "border-primary bg-primary/10 text-foreground shadow-sm"
                        : "border-border bg-card hover:border-foreground/40 text-foreground/80",
                    )}
                  >
                    {t}
                  </span>
                );
              })}
              {placedCount === tokens.length && (
                <span className="text-xs text-muted-foreground/70">
                  All sorted.
                </span>
              )}
            </div>

            {/* Buckets */}
            <div className="grid grid-cols-2 gap-3">
              <BucketZone
                ref={loudRef}
                label="Loud"
                chips={chipsFor("loud")}
                onChipTap={unplace}
                testid="bucket-loud"
                isHover={hoverBucket === "loud" && draggingIdx !== null}
                isFlash={justDroppedBucket === "loud"}
              />
              <BucketZone
                ref={realRef}
                label="Real"
                chips={chipsFor("real")}
                onChipTap={unplace}
                testid="bucket-real"
                isHover={hoverBucket === "real" && draggingIdx !== null}
                isFlash={justDroppedBucket === "real"}
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
              <Button onClick={handleDone} data-testid="button-reset-cta">
                {completion.cta}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface BucketZoneProps {
  label: string;
  chips: { t: string; i: number }[];
  onChipTap: (idx: number) => void;
  testid: string;
  isHover: boolean;
  isFlash: boolean;
}

const BucketZone = forwardRef<HTMLDivElement, BucketZoneProps>(
  ({ label, chips, onChipTap, testid, isHover, isFlash }, ref) => (
    <div
      ref={ref}
      data-testid={testid}
      aria-label={`${label} — drop zone`}
      className={cn(
        "rounded-xl border p-3 min-h-[112px] flex flex-col gap-2 transition-all",
        isHover
          ? "border-primary bg-primary/5 scale-[1.01]"
          : isFlash
            ? "border-primary/70 bg-primary/[0.06]"
            : "border-border bg-card",
      )}
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
              className="px-3 py-1 rounded-full border border-border/80 bg-background text-xs text-foreground/80 cursor-pointer hover:border-foreground/40 transition-colors"
              title="Tap to move back"
            >
              {t}
            </span>
          ))
        )}
      </div>
    </div>
  ),
);
BucketZone.displayName = "BucketZone";
