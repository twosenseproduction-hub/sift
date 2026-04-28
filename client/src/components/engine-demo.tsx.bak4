import { useEffect, useRef, useState } from "react";

// EngineDemo
// ---------------------------------------------------------------
// Five-stage autonomous animation that dramatizes the Sift engine.
// It plays in a loop while the section is in view, pauses when out
// of view (no offscreen work), and respects the prefers-reduced-
// motion setting (renders the final state still, no movement).
//
// Stages (timings in ms, set in `STAGES` below):
//   0  pile      — messy paragraph fades in
//   1  lift      — six phrase chips rise out of the paragraph
//   2  sort      — chips travel into Matters / Noise bins
//   3  step      — "one next step" materializes
//   4  rest      — a quiet pause before the loop restarts
//
// Calm motion budget: 600–900ms per move, ease-out, no springs,
// no bounces. The only moving things at any moment are the chips
// that need to move; everything else holds still.

type Bucket = "matters" | "noise";

interface Phrase {
  id: string;
  text: string;
  bucket: Bucket;
  // Position inside the paragraph block (percent of the block's
  // width and height) so chips appear to lift from where the
  // matching words live in the paragraph.
  fromX: number;
  fromY: number;
}

// Phrases lifted from the paragraph below. The fromX/fromY values
// are tuned so each chip appears to rise from the part of the
// paragraph where its words actually sit — working out lives near
// the start, "too tired" sits late, etc.
const PHRASES: Phrase[] = [
  { id: "p1", text: "Working out.", bucket: "matters", fromX: 38, fromY: 22 },
  { id: "p2", text: "Writing.", bucket: "matters", fromX: 30, fromY: 88 },
  { id: "p3", text: "Time for myself.", bucket: "matters", fromX: 70, fromY: 28 },
  { id: "p4", text: "\u201CThere\u2019s no time.\u201D", bucket: "noise", fromX: 22, fromY: 14 },
  { id: "p5", text: "\u201CToo tired to try.\u201D", bucket: "noise", fromX: 60, fromY: 70 },
  { id: "p6", text: "Sleeping instead.", bucket: "noise", fromX: 50, fromY: 92 },
];

// Cumulative milestones the stage clock advances through.
// The total cycle length is the last entry. Pacing is deliberately
// slow — a viewer should be able to read every chip and the next
// step without rushing. Roughly twice the speed of an attention-
// economy demo, because Sift is the opposite of that.
const STAGES = {
  pile: 3800,   // 0      -> 3800   paragraph fades in, breathes, then sits
  lift: 9200,   // 3800   -> 9200   chips rise out of paragraph, one at a time
  sort: 17000,  // 9200   -> 17000  chips fly to bins, well staggered
  step: 24000,  // 17000  -> 24000  next step materializes and holds long enough to read
  rest: 28000,  // 24000  -> 28000  quiet pause, then loop
} as const;

type StageName = keyof typeof STAGES;

function currentStage(t: number): StageName {
  if (t < STAGES.pile) return "pile";
  if (t < STAGES.lift) return "lift";
  if (t < STAGES.sort) return "sort";
  if (t < STAGES.step) return "step";
  return "rest";
}

// Captions that follow the right-column "story" as the engine works.
const CAPTIONS: Record<StageName, { eyebrow: string; line: string }> = {
  pile: {
    eyebrow: "The pile",
    line: "Everything you are holding, in one place. No order yet, no judgment.",
  },
  lift: {
    eyebrow: "Sift listens",
    line: "The phrases you actually said — pulled out, one by one.",
  },
  sort: {
    eyebrow: "Signal from noise",
    line: "What matters lands on the left. What doesn't, on the right.",
  },
  step: {
    eyebrow: "One next step",
    line: "Not a list. One calm thing you can do today.",
  },
  rest: {
    eyebrow: "And then quiet",
    line: "The shape lands. Sift remembers the throughline, not the noise.",
  },
};

const PARAGRAPH = `I can’t seem to find time to do the things I need to do like working out or doing some personal things, because I have to wake up, then be a dad, then go to work, then come home, then be a dad. Then I’m too tired to do anything for myself, so I end up sleeping instead of working out or writing or doing something else.`;

const NEXT_STEP =
  "Pick one fifteen-minute window today — before work, or right after the kids are down. Move, or write. Just that one window.";

export function EngineDemo() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const [t, setT] = useState(0);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Detect prefers-reduced-motion.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Pause animation when out of view (and resume from a fresh loop
  // start when it scrolls back in, so people always see the opening).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          setInView(e.isIntersecting);
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Animation loop. Reset clock when (re)entering view so the
  // narrative starts at "the pile" each time.
  useEffect(() => {
    if (!inView || reducedMotion) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    startRef.current = null;
    const tick = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const elapsed = (ts - startRef.current) % STAGES.rest;
      setT(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [inView, reducedMotion]);

  // For reduced motion, render a still composition that shows the
  // final, sorted state with the next step visible.
  const stage: StageName = reducedMotion ? "step" : currentStage(t);

  return (
    <div
      ref={containerRef}
      className="grid items-stretch gap-8 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]"
    >
      {/* Stage column — the actual demo */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-5 shadow-[var(--shadow-md)] backdrop-blur-md sm:p-7">
        <Stage stage={stage} t={t} reducedMotion={reducedMotion} />
      </div>

      {/* Caption column — text follows the demo */}
      <div className="flex flex-col justify-center">
        <CaptionColumn stage={stage} reducedMotion={reducedMotion} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Stage (left column)
// ---------------------------------------------------------------

function Stage({ stage, t, reducedMotion }: { stage: StageName; t: number; reducedMotion: boolean }) {
  return (
    <div className="relative h-[480px] w-full sm:h-[520px]">
      {/* Paragraph layer */}
      <ParagraphBlock stage={stage} reducedMotion={reducedMotion} />

      {/* Bins layer */}
      <Bins stage={stage} reducedMotion={reducedMotion} />

      {/* Chips layer */}
      <ChipsLayer stage={stage} t={t} reducedMotion={reducedMotion} />

      {/* Next step layer */}
      <NextStep stage={stage} reducedMotion={reducedMotion} />
    </div>
  );
}

// The messy paragraph that the engine will sift. It fades in at the
// start, dims while chips are being lifted out, and fades out fully
// once sorting begins so the bins can breathe.
function ParagraphBlock({ stage, reducedMotion }: { stage: StageName; reducedMotion: boolean }) {
  let opacity = 0;
  if (reducedMotion) opacity = 0;
  else if (stage === "pile") opacity = 1;
  else if (stage === "lift") opacity = 0.5;
  else opacity = 0;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center px-2 transition-opacity duration-[1400ms] ease-out"
      style={{ opacity }}
    >
      <p
        className="m-0 max-w-[44ch] text-center font-serif text-[clamp(1.05rem,1.6vw,1.4rem)] leading-[1.55] tracking-[-0.01em] text-foreground/80"
      >
        {PARAGRAPH}
      </p>
    </div>
  );
}

// The two bins. They slide up from below and become visible during
// the "sort" stage, hold during "step", and quietly fade during
// "rest" before the loop restarts.
function Bins({ stage, reducedMotion }: { stage: StageName; reducedMotion: boolean }) {
  const visible = reducedMotion || stage === "sort" || stage === "step" || stage === "rest";
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 grid grid-cols-2 gap-4 transition-all duration-[1100ms] ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
      }}
    >
      <Bin label="Matters" tone="primary" />
      <Bin label="Noise" tone="muted" />
    </div>
  );
}

function Bin({ label, tone }: { label: string; tone: "primary" | "muted" }) {
  const isPrimary = tone === "primary";
  return (
    <div
      className="relative h-[200px] rounded-2xl border border-dashed"
      style={{
        borderColor: isPrimary ? "hsl(var(--primary) / 0.35)" : "hsl(var(--muted-foreground) / 0.25)",
        background: isPrimary ? "hsl(var(--primary) / 0.05)" : "hsl(var(--muted) / 0.4)",
      }}
    >
      <div
        className="absolute left-4 top-3 text-[11px] font-medium uppercase tracking-[0.22em]"
        style={{ color: isPrimary ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
      >
        {label}
      </div>
    </div>
  );
}

// Chip layer — the six phrases. Each chip has three positions:
//   - "in paragraph" (its origin coordinates)
//   - "in deck"      (a stack near the center, just above the bins)
//   - "in bin"       (resting inside Matters or Noise)
// Stages drive which target each chip is moving toward.
function ChipsLayer({ stage, t, reducedMotion }: { stage: StageName; t: number; reducedMotion: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {PHRASES.map((p, i) => (
        <Chip key={p.id} phrase={p} index={i} stage={stage} t={t} reducedMotion={reducedMotion} />
      ))}
    </div>
  );
}

interface ChipPos {
  left: string;
  top: string;
  opacity: number;
  scale: number;
  rotate: number;
}

// Returns target position for a given chip + stage.
// Chips are positioned with their CENTER on the given coordinates
// (the chip element uses translate(-50%, -50%) for centering).
function chipTarget(p: Phrase, index: number, stage: StageName): ChipPos {
  // Bin geometry — these mirror the Bins grid above. The bins
  // occupy the bottom 200px of the 480-520px stage in two columns
  // with a small gap. Chip CENTERS sit at:
  //   - left bin center  ≈ 25% of stage width
  //   - right bin center ≈ 75% of stage width
  // That keeps each chip fully inside its bin even on mobile,
  // because the chip max-width is also capped at ~46% of the
  // stage width (see Chip component).
  const matterIdx = PHRASES.filter((x) => x.bucket === "matters").findIndex((x) => x.id === p.id);
  const noiseIdx = PHRASES.filter((x) => x.bucket === "noise").findIndex((x) => x.id === p.id);
  const slot = p.bucket === "matters" ? matterIdx : noiseIdx;

  // Final resting positions inside each bin (3 slots each, stacked).
  // Bins occupy roughly the bottom 200px / 38% of stage height. Chip
  // slot centers begin a bit below the bin label.
  const binBaseTop = 76; // % from top of stage to first chip slot center
  const binSlotGap = 7;  // % between chip slot centers

  const binTop = `${binBaseTop + slot * binSlotGap}%`;
  const binLeft = p.bucket === "matters" ? "25%" : "75%";

  // Deck position (centered, slightly fanned). Chips overlap in
  // a small stack just above where the bins will appear.
  const fan = (index - 2.5) * 1.4; // small rotation
  const deckLeft = `50%`;
  const deckTop = `calc(40% + ${index * 4}px)`;

  switch (stage) {
    case "pile":
      // Hidden inside the paragraph.
      return {
        left: `${p.fromX}%`,
        top: `${p.fromY}%`,
        opacity: 0,
        scale: 0.96,
        rotate: 0,
      };
    case "lift":
      // Lift out of paragraph toward the deck position.
      return {
        left: deckLeft,
        top: deckTop,
        opacity: 1,
        scale: 1,
        rotate: fan,
      };
    case "sort":
    case "step":
    case "rest":
    default:
      return {
        left: binLeft,
        top: binTop,
        opacity: 1,
        scale: 1,
        rotate: 0,
      };
  }
}

function Chip({
  phrase,
  index,
  stage,
  t,
  reducedMotion,
}: {
  phrase: Phrase;
  index: number;
  stage: StageName;
  t: number;
  reducedMotion: boolean;
}) {
  // Stagger each chip's lift and sort so they don't all move at once.
  // The delays are deliberately wide — the viewer should be able to
  // read each chip as it appears, and feel each one travel to its
  // bin individually. This is the engine talking, slowly.
  const liftDelay = index * 700; // ms — chips lift one at a time
  const sortDelay = index * 800; // ms — chips fly to bins one at a time

  // During the "lift" stage, chips that haven't yet "lifted" should
  // still read as invisible. We compute a per-chip activation time.
  const liftStart = STAGES.pile + liftDelay;
  const sortStart = STAGES.lift + sortDelay;

  // Effective stage for this chip (it can lag behind the global stage
  // by up to (chips-1)*delay). This prevents the last chip from
  // teleporting if its delay would push it past the stage boundary.
  let effectiveStage: StageName = stage;
  if (!reducedMotion) {
    if (stage === "lift" && t < liftStart) effectiveStage = "pile";
    if (stage === "sort" && t < sortStart) effectiveStage = "lift";
  }

  const pos = chipTarget(phrase, index, effectiveStage);

  // Color the chip subtly by bucket once it's in the bin (helps the
  // viewer connect chip → bin without being loud about it).
  const inBin = effectiveStage === "sort" || effectiveStage === "step" || effectiveStage === "rest";
  const isMatters = phrase.bucket === "matters";

  const borderColor = inBin
    ? isMatters
      ? "hsl(var(--primary) / 0.45)"
      : "hsl(var(--muted-foreground) / 0.3)"
    : "hsl(var(--border))";
  const bg = inBin
    ? isMatters
      ? "hsl(var(--primary) / 0.08)"
      : "hsl(var(--muted) / 0.6)"
    : "hsl(var(--card))";
  const fg = inBin
    ? isMatters
      ? "hsl(var(--primary))"
      : "hsl(var(--muted-foreground))"
    : "hsl(var(--foreground))";

  // Per-stage transition timing. Slow, calm easings — every move is
  // long enough to feel intentional rather than animated.
  let duration = 900;
  let delay = 0;
  if (!reducedMotion) {
    if (stage === "lift") {
      duration = 1100;
      delay = liftDelay;
    } else if (stage === "sort") {
      duration = 1300;
      delay = sortDelay;
    } else {
      duration = 800;
      delay = 0;
    }
  } else {
    duration = 0;
  }

  return (
    <div
      className="absolute flex max-w-[44%] items-center justify-center rounded-full border px-3 py-1.5 text-center font-sans text-[11.5px] leading-snug will-change-transform sm:px-3.5 sm:text-[12.5px]"
      style={{
        left: pos.left,
        top: pos.top,
        opacity: pos.opacity,
        background: bg,
        borderColor,
        color: fg,
        transform: `translate(-50%, -50%) scale(${pos.scale}) rotate(${pos.rotate}deg)`,
        transition: `left ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, top ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, opacity ${duration}ms ease-out ${delay}ms, transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, background ${duration}ms ease-out ${delay}ms, border-color ${duration}ms ease-out ${delay}ms, color ${duration}ms ease-out ${delay}ms`,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <span className="truncate">{phrase.text}</span>
    </div>
  );
}

// The "one next step" panel that materializes after sorting completes.
// Sits in the upper-middle of the stage so it reads as the engine's
// final output, with the sorted bins below.
function NextStep({ stage, reducedMotion }: { stage: StageName; reducedMotion: boolean }) {
  const visible = reducedMotion || stage === "step" || stage === "rest";
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 flex justify-center px-2 transition-all duration-[1200ms] ease-out"
      style={{
        top: "22%",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-8px)",
      }}
    >
      <div
        className="max-w-[34ch] rounded-2xl border px-4 py-3 text-center backdrop-blur-md"
        style={{
          background: "hsl(var(--primary) / 0.07)",
          borderColor: "hsl(var(--primary) / 0.32)",
        }}
      >
        <div
          className="mb-1 text-[10px] font-medium uppercase tracking-[0.24em]"
          style={{ color: "hsl(var(--primary))" }}
        >
          One next step
        </div>
        <div className="font-serif text-[14.5px] leading-snug text-foreground sm:text-[15px]">{NEXT_STEP}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Caption column (right)
// ---------------------------------------------------------------

function CaptionColumn({ stage, reducedMotion }: { stage: StageName; reducedMotion: boolean }) {
  const c = CAPTIONS[stage];
  const stages: StageName[] = ["pile", "lift", "sort", "step", "rest"];
  const activeIndex = stages.indexOf(stage);

  return (
    <div className="space-y-7">
      {/* Live caption that swaps with each stage */}
      <div className="min-h-[7.5rem]">
        <div key={stage} className="fade-up">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            {c.eyebrow}
          </div>
          <p className="m-0 font-serif text-[clamp(1.15rem,1.6vw,1.45rem)] leading-[1.45] tracking-[-0.01em] text-foreground">
            {c.line}
          </p>
        </div>
      </div>

      {/* Progress dots — quietly show where we are in the loop. */}
      {!reducedMotion && (
        <div className="flex items-center gap-2">
          {stages.map((s, i) => (
            <span
              key={s}
              aria-hidden="true"
              className="h-[6px] rounded-full transition-all duration-500 ease-out"
              style={{
                width: i === activeIndex ? 22 : 6,
                background:
                  i === activeIndex
                    ? "hsl(var(--primary))"
                    : i < activeIndex
                    ? "hsl(var(--primary) / 0.35)"
                    : "hsl(var(--muted-foreground) / 0.25)",
              }}
            />
          ))}
        </div>
      )}

      <div className="border-t border-border/50 pt-5 text-sm leading-7 text-muted-foreground">
        This is what Sift does, every time. It listens to the pile, lifts what
        is actually there, separates signal from noise, and hands back one
        small, doable thing — not a to-do list.
      </div>
    </div>
  );
}
