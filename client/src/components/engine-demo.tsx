import { useEffect, useRef, useState, useCallback } from "react";

type Bucket = "matters" | "noise";
type Phase = "pile" | "signal" | "shape" | "step";

interface Phrase {
  id: string;
  text: string;
  bucket: Bucket;
  fromX: number;
  fromY: number;
}

const PHRASES: Phrase[] = [
  { id: "p1", text: "Working out.", bucket: "matters", fromX: 38, fromY: 22 },
  { id: "p2", text: "Writing.", bucket: "matters", fromX: 30, fromY: 88 },
  { id: "p3", text: "Time for myself.", bucket: "matters", fromX: 70, fromY: 28 },
  { id: "p4", text: "\u201CThere\u2019s no time.\u201D", bucket: "noise", fromX: 22, fromY: 14 },
  { id: "p5", text: "\u201CToo tired to try.\u201D", bucket: "noise", fromX: 60, fromY: 70 },
  { id: "p6", text: "Sleeping instead.", bucket: "noise", fromX: 50, fromY: 92 },
];

const PARAGRAPH =
  "I can\u2019t seem to find time to do the things I need to do like working out or doing some personal things, because I have to wake up, then be a dad, then go to work, then come home, then be a dad. Then I\u2019m too tired to do anything for myself, so I end up sleeping instead of working out or writing or doing something else.";

const SIGNAL_TEXT =
  "You\u2019re not missing time. You\u2019re missing support for what you actually need.";

const NOISE_TEXT =
  "The guilt about not doing more, the story that rest equals failure, the loop of exhaustion.";

const NEXT_STEP =
  "Pick one fifteen-minute window today \u2014 before work, or right after the kids are down. Move, or write. Just that one window.";

const PHASES: Phase[] = ["pile", "signal", "shape", "step"];

const PHASE_META: Record<Phase, { num: string; label: string; eyebrow: string; caption: string }> = {
  pile: {
    num: "01",
    label: "The pile",
    eyebrow: "Everything you\u2019re holding",
    caption:
      "No order yet. No judgment. Just the full mess on the table \u2014 the work, the family, the tiredness, all of it.",
  },
  signal: {
    num: "02",
    label: "Signal emerges",
    eyebrow: "What\u2019s actually there",
    caption:
      "Sift listens for the phrases that are actually there \u2014 not the story about them, just what you said.",
  },
  shape: {
    num: "03",
    label: "The shape",
    eyebrow: "What matters / what\u2019s only noise",
    caption:
      "What\u2019s central lands on the left. What\u2019s distortion lands on the right. Not a score \u2014 a read.",
  },
  step: {
    num: "04",
    label: "One next step",
    eyebrow: "One doable thing",
    caption:
      "Not a to-do list. Not advice. Just the one small thing you can actually take today.",
  },
};

// Animation durations per phase (ms).
const PHASE_DUR: Record<Phase, number> = {
  pile: 1000,
  signal: 1800,
  shape: 1400,
  step: 1200,
};

export function EngineDemo() {
  const [phase, setPhase] = useState<Phase>("pile");
  const [animT, setAnimT] = useState(0); // 0-1 progress through current phase
  const [reducedMotion, setReducedMotion] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const goTo = useCallback((p: Phase) => {
    setPhase(p);
    setAnimT(0);
    startRef.current = null;
  }, []);

  // Reduced motion detection.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Animation loop for current phase.
  useEffect(() => {
    if (reducedMotion) return;
    startRef.current = null;
    const dur = PHASE_DUR[phase];

    const tick = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / dur, 1);
      setAnimT(progress);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, reducedMotion]);

  const pct = (n: number) => `${Math.round(n * 100)}%`;

  const chipBinTop = (slot: number) => pct(0.6 + slot * 0.1);
  const chipBinLeft = (bucket: Bucket) => (bucket === "matters" ? "22%" : "78%");

  return (
    <div
      ref={containerRef}
      className="grid items-stretch gap-8 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]"
    >
      {/* Stage column */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-5 shadow-[var(--shadow-md)] backdrop-blur-md sm:p-7">
        {/* Paragraph layer — only visible in pile phase */}
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center px-4 transition-opacity duration-700"
          style={{ opacity: phase === "pile" ? (reducedMotion ? 1 : animT) : 0 }}
        >
          <p className="m-0 max-w-[44ch] text-center font-serif text-[clamp(1rem,1.5vw,1.3rem)] leading-[1.55] tracking-[-0.01em] text-foreground/75">
            {PARAGRAPH}
          </p>
        </div>

        {/* Signal layer — fades in during signal phase */}
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center px-4"
          style={{
            opacity: phase === "signal" ? (reducedMotion ? 1 : animT) : 0,
            transition: "opacity 600ms ease-out",
            pointerEvents: "none",
          }}
        >
          <div className="max-w-[36ch] rounded-2xl border border-primary/30 bg-primary/[0.06] px-5 py-4 text-center">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-primary/70">
              The signal
            </div>
            <p className="m-0 font-serif text-[clamp(1.05rem,1.5vw,1.25rem)] leading-[1.5] tracking-[-0.01em] text-foreground/90">
              {SIGNAL_TEXT}
            </p>
          </div>
        </div>

        {/* Noise layer — fades in alongside signal */}
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center px-4"
          style={{
            opacity: phase === "signal" ? (reducedMotion ? 1 : animT * 0.6) : 0,
            transition: "opacity 800ms ease-out 200ms",
            pointerEvents: "none",
          }}
        >
          <div className="max-w-[36ch] rounded-2xl border border-border/50 bg-muted/20 px-5 py-4 text-center">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/70">
              The noise
            </div>
            <p className="m-0 text-[14px] leading-[1.55] text-muted-foreground/80">
              {NOISE_TEXT}
            </p>
          </div>
        </div>

        {/* Bins layer — visible during shape phase */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-4 bottom-4 grid grid-cols-2 gap-3 transition-all duration-[1100ms] ease-out"
          style={{
            opacity: phase === "shape" ? (reducedMotion ? 1 : animT) : 0,
            transform: phase === "shape"
              ? reducedMotion
                ? "translateY(0)"
                : `translateY(${(1 - animT) * 20}px)`
              : "translateY(16px)",
          }}
        >
          <Bin label="Matters" tone="primary" />
          <Bin label="Noise" tone="muted" />
        </div>

        {/* Chips layer */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {PHRASES.map((p, i) => {
            const matterCount = PHRASES.filter((x) => x.bucket === "matters").length;
            const isMatters = p.bucket === "matters";
            const slot = PHRASES.filter((x) => x.bucket === p.bucket).findIndex((x) => x.id === p.id);
            const binTop = isMatters ? `${58 + slot * 10}%` : `${58 + slot * 10}%`;
            const binLeft = isMatters ? "22%" : "78%";

            let opacity = 0;
            let left = `${p.fromX}%`;
            let top = `${p.fromY}%`;
            let scale = 0.96;
            let rotate = 0;

            if (phase === "pile") {
              opacity = 0;
            } else if (phase === "signal") {
              // Chips fan out from paragraph to deck
              const fan = (i - 2.5) * 1.2;
              opacity = reducedMotion ? 1 : Math.min(animT * 1.5, 1);
              left = "50%";
              top = `calc(38% + ${i * 3}px)`;
              scale = 1;
              rotate = fan;
            } else if (phase === "shape") {
              // Chips fly to bins
              opacity = reducedMotion ? 1 : 1;
              left = binLeft;
              top = binTop;
              scale = 1;
              rotate = 0;
            } else if (phase === "step") {
              opacity = 0;
            }

            const inBin = phase === "shape";
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

            return (
              <div
                key={p.id}
                className="absolute flex max-w-[46%] items-center justify-center rounded-full border px-3 py-1.5 text-center font-sans text-[11.5px] leading-snug will-change-transform sm:px-3.5 sm:text-[12.5px]"
                style={{
                  left,
                  top,
                  opacity,
                  background: bg,
                  borderColor,
                  color: fg,
                  transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotate}deg)`,
                  transition: `left 900ms cubic-bezier(0.22,1,0.36,1), top 900ms cubic-bezier(0.22,1,0.36,1), opacity 500ms ease-out, transform 900ms cubic-bezier(0.22,1,0.36,1)`,
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <span className="truncate">{p.text}</span>
              </div>
            );
          })}
        </div>

        {/* Next step layer */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-4 flex items-center justify-center"
          style={{
            top: "20%",
            opacity: phase === "step" ? (reducedMotion ? 1 : animT) : 0,
            transform: phase === "step"
              ? reducedMotion
                ? "translateY(0)"
                : `translateY(${(1 - animT) * -6}px)`
              : "translateY(-8px)",
            transition: "opacity 700ms ease-out, transform 700ms ease-out",
          }}
        >
          <div className="max-w-[36ch] rounded-2xl border border-primary/30 bg-primary/[0.07] px-5 py-3.5 text-center backdrop-blur-md">
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.24em] text-primary/70">
              One next step
            </div>
            <div className="font-serif text-[14.5px] leading-snug text-foreground sm:text-[15px]">
              {NEXT_STEP}
            </div>
          </div>
        </div>

        {/* Progress dots */}
        <div
          aria-hidden="true"
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 sm:bottom-4"
        >
          {PHASES.map((p, i) => (
            <button
              key={p}
              onClick={() => goTo(p)}
              className="rounded-full transition-all duration-400"
              style={{
                width: p === phase ? 18 : 6,
                height: 6,
                background:
                  p === phase
                    ? "hsl(var(--primary))"
                    : p === PHASES[PHASES.indexOf(phase) - 1]
                    ? "hsl(var(--primary) / 0.4)"
                    : "hsl(var(--muted-foreground) / 0.22)",
                cursor: "pointer",
                border: "none",
                padding: 0,
              }}
              aria-label={`Go to ${PHASE_META[p].label}`}
            />
          ))}
        </div>
      </div>

      {/* Caption column */}
      <div className="flex flex-col justify-center">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          {PHASE_META[phase].num}
        </div>
        <div className="mb-4 font-serif text-[clamp(1.4rem,2vw,1.8rem)] leading-[1.1] tracking-[-0.02em] text-foreground">
          {PHASE_META[phase].eyebrow}
        </div>
        <p className="m-0 font-serif text-[clamp(1rem,1.4vw,1.2rem)] leading-[1.6] tracking-[-0.01em] text-muted-foreground">
          {PHASE_META[phase].caption}
        </p>

        <div className="mt-6 border-t border-border/50 pt-5 text-sm leading-7 text-muted-foreground">
          This is what Sift does, every time. It listens to the pile, lifts what
          is actually there, separates signal from noise, and hands back one
          small, doable thing \u2014 not a to-do list.
        </div>
      </div>
    </div>
  );
}

function Bin({ label, tone }: { label: string; tone: "primary" | "muted" }) {
  const isPrimary = tone === "primary";
  return (
    <div
      className="relative h-[180px] rounded-2xl border border-dashed"
      style={{
        borderColor: isPrimary
          ? "hsl(var(--primary) / 0.35)"
          : "hsl(var(--muted-foreground) / 0.25)",
        background: isPrimary
          ? "hsl(var(--primary) / 0.04)"
          : "hsl(var(--muted) / 0.15)",
      }}
    >
      <div
        className="absolute left-4 top-3 text-[10px] font-medium uppercase tracking-[0.22em]"
        style={{
          color: isPrimary ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
        }}
      >
        {label}
      </div>
    </div>
  );
}