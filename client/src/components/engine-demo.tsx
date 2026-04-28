import { useEffect, useRef, useState, useCallback } from "react";

type Phase = "pile" | "signal" | "shape" | "step";

const PARAGRAPH =
  "I keep telling myself I should be doing more. Working out, writing, making time for things I care about. But every day fills up with obligations and I end up too tired to do any of it. I don't know if I'm genuinely exhausted or just avoiding things.";

const MATTERS = [
  "The thing you keep almost-starting is the one you actually care about.",
  "You're tired in a way rest alone does not fix.",
];

const NOISE = [
  "The full schedule.",
  "The story that you're behind.",
  "The guilt about not doing more.",
];

const NEXT_STEP =
  "Pick the one thing that scares you a little. Write the first sentence. Nothing more.";

const PHASES: Phase[] = ["pile", "signal", "shape", "step"];

const PHASE_META: Record<Phase, { num: string; eyebrow: string; caption: string }> = {
  pile: {
    num: "01",
    eyebrow: "The pile",
    caption:
      "Everything you're holding, in one place. No order yet. No judgment.",
  },
  signal: {
    num: "02",
    eyebrow: "What Sift heard",
    caption:
      "Sift listens for what's actually there — not the story about it, just what you said.",
  },
  shape: {
    num: "03",
    eyebrow: "The shape",
    caption:
      "Back and forth it goes. What matters lands on the left. What doesn't, on the right.",
  },
  step: {
    num: "04",
    eyebrow: "One next step",
    caption:
      "Not a to-do list. Not advice. One small thing you can actually do today.",
  },
};

// How long each phase runs before auto-advancing (ms).
const PHASE_AUTO: Record<Phase, number> = {
  pile: 0,     // user-driven
  signal: 0,   // user-driven
  shape: 0,    // user-driven
  step: 0,     // user-driven
};

// Typewriter hook — returns [displayedText, progress 0-1]
function useTypewriter(text: string, active: boolean, speed = 28) {
  const [displayed, setDisplayed] = useState("");
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const lenRef = useRef(text.length);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      const update = () => setReducedMotion(mq.matches);
      update();
      mq.addEventListener?.("change", update);
      return () => mq.removeEventListener?.("change", update);
    }
  }, []);

  useEffect(() => {
    if (!active) {
      setDisplayed("");
      setProgress(0);
      startRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    if (reducedMotion) {
      setDisplayed(text);
      setProgress(1);
      return;
    }
    setDisplayed("");
    setProgress(0);
    startRef.current = null;
    lenRef.current = text.length;

    const tick = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const charCount = Math.floor(elapsed / speed);
      const idx = Math.min(charCount, lenRef.current);
      setDisplayed(text.slice(0, idx));
      setProgress(idx / lenRef.current);
      if (idx < lenRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, text, speed, reducedMotion]);

  return { displayed, progress };
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-cards for each phase
// ──────────────────────────────────────────────────────────────────────────────

function PileCard({ phase }: { phase: Phase }) {
  const active = phase === "pile";
  const opacity = active ? 1 : 0;
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex flex-col items-center justify-center px-5 transition-opacity duration-500"
      style={{ opacity }}
    >
      <div className="w-full max-w-[44ch] rounded-2xl border border-border/60 bg-card/80 p-5 shadow-[var(--shadow-md)] backdrop-blur-md">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Clarity over comfort
        </p>
        <h3 className="mb-4 font-serif text-2xl leading-tight tracking-tight text-foreground">
          What are you holding <em className="font-serif italic">right now?</em>
        </h3>
        <div className="min-h-[88px] rounded-xl border border-border/40 bg-background/60 p-4">
          <p className="text-[14px] leading-[1.7] text-foreground/75">
            {PARAGRAPH}
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Messy is fine.</span>
          <span className="inline-flex h-9 items-center justify-center rounded-full bg-primary/90 px-4 text-xs font-semibold text-primary-foreground">
            Sift
          </span>
        </div>
      </div>
    </div>
  );
}

function SignalCard({ phase }: { phase: Phase }) {
  const active = phase === "signal";
  const { displayed: mirror, progress: mirrorP } = useTypewriter(
    "What you're holding is not laziness. It is a stack of half-started things and a quiet question underneath.",
    active,
    22
  );
  const { displayed: matters0 } = useTypewriter(MATTERS[0], active && mirrorP > 0.4, 28);
  const { displayed: matters1 } = useTypewriter(MATTERS[1], active && mirrorP > 0.7, 28);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex flex-col items-center justify-center px-5 transition-opacity duration-500"
      style={{ opacity: active ? 1 : 0 }}
    >
      <div className="w-full max-w-[44ch] rounded-2xl border border-border/60 bg-card/80 p-5 shadow-[var(--shadow-md)] backdrop-blur-md">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          What Sift heard
        </p>
        <p className="m-0 mb-4 text-[14px] leading-[1.7] text-foreground/90">
          {mirror}
          {active && mirrorP < 1 && (
            <span
              className="ml-[2px] inline-block h-[1em] w-[2px] -translate-y-[2px] bg-foreground/60"
              style={{ animation: "blink 1s step-end infinite" }}
            />
          )}
        </p>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-primary/70">
              Matters
            </p>
            <ul className="space-y-1.5">
              {[matters0, matters1].map((t, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-snug text-foreground/90">
                  <span className="mt-[0.35em] text-primary/60">·</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShapeCard({ phase }: { phase: Phase }) {
  const active = phase === "shape";
  const [turn, setTurn] = useState<"matters" | "noise">("matters");
  const [turnDone, setTurnDone] = useState(false);
  const [step, setStep] = useState(0); // 0-4
  const [text, setText] = useState("");
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const lenRef = useRef(0);

  const contents: Array<{ who: "matters" | "noise"; label: string; text: string; sublabel?: string }> = [
    { who: "matters", label: "What matters most", text: "The thing you keep almost-starting is the one you actually care about." },
    { who: "noise", label: "What may be noise", text: "The full schedule. The story that you're behind. The guilt about not doing more." },
    { who: "matters", label: "What matters most", text: "You're tired in a way rest alone does not fix." },
    { who: "noise", label: "What may be noise", text: "Nothing is broken. The shape is the answer." },
  ];

  useEffect(() => {
    if (!active) { setStep(0); setText(""); setTurnDone(false); return; }
    setStep(0); setText(""); setTurnDone(false); startRef.current = null;
    const run = () => {
      if (step >= contents.length) { setTurnDone(true); return; }
      const item = contents[step];
      setTurn(item.who);
      lenRef.current = item.text.length;
      startRef.current = null;
      const tick = (ts: number) => {
        if (startRef.current == null) startRef.current = ts;
        const elapsed = ts - startRef.current;
        const n = Math.min(Math.floor(elapsed / 18), lenRef.current);
        setText(item.text.slice(0, n));
        if (n < lenRef.current) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          // hold this card briefly, then advance
          setTimeout(() => {
            setStep(s => s + 1);
          }, 600);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };
    run();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active, step]);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex flex-col items-center justify-center px-5 transition-opacity duration-500"
      style={{ opacity: active ? 1 : 0 }}
    >
      <div className="w-full max-w-[44ch] rounded-2xl border border-border/60 bg-card/80 p-5 shadow-[var(--shadow-md)] backdrop-blur-md">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          {turn === "matters" ? "What seems to matter most" : "What may be noise"}
        </p>
        <p className="m-0 text-[14px] leading-[1.65] text-foreground/90">
          {text}
          {active && !turnDone && (
            <span
              className="ml-[2px] inline-block h-[1em] w-[2px] -translate-y-[2px] bg-foreground/60"
              style={{ animation: "blink 1s step-end infinite" }}
            />
          )}
        </p>
        {/* Progress bar for back-and-forth turns */}
        <div className="mt-4 flex gap-1">
          {contents.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-colors duration-300"
              style={{
                background: i < step
                  ? "hsl(var(--primary))"
                  : i === step
                  ? "hsl(var(--primary) / 0.4)"
                  : "hsl(var(--muted-foreground) / 0.2)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StepCard({ phase }: { phase: Phase }) {
  const active = phase === "step";
  const { displayed, progress } = useTypewriter(NEXT_STEP, active, 26);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex flex-col items-center justify-center px-5 transition-opacity duration-500"
      style={{ opacity: active ? 1 : 0 }}
    >
      <div className="w-full max-w-[38ch] rounded-2xl border border-primary/30 bg-primary/[0.06] px-5 py-4 shadow-[var(--shadow-md)] backdrop-blur-md">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.24em] text-primary/70">
          One next step
        </p>
        <p className="m-0 font-serif text-[15px] leading-snug text-foreground/95">
          {displayed}
          {active && progress < 1 && (
            <span
              className="ml-[2px] inline-block h-[1em] w-[2px] -translate-y-[2px] bg-foreground/60"
              style={{ animation: "blink 1s step-end infinite" }}
            />
          )}
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main EngineDemo
// ──────────────────────────────────────────────────────────────────────────────

export function EngineDemo() {
  const [phase, setPhase] = useState<Phase>("pile");
  const [reducedMotion, setReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const goTo = useCallback((p: Phase) => {
    setPhase(p);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  return (
    <div
      ref={containerRef}
      className="grid items-stretch gap-8 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]"
    >
      {/* ── Card column ── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-5 shadow-[var(--shadow-md)] backdrop-blur-md sm:p-7">
        <div className="relative h-[460px] w-full sm:h-[500px]">
          <PileCard phase={phase} />
          <SignalCard phase={phase} />
          <ShapeCard phase={phase} />
          <StepCard phase={phase} />
        </div>

        {/* Blink keyframe */}
        <style>{`
          @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        `}</style>

        {/* Progress dots — clickable */}
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 sm:bottom-4">
          {PHASES.map((p, i) => (
            <button
              key={p}
              onClick={() => goTo(p)}
              className="rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50"
              style={{
                width: p === phase ? 20 : 6,
                height: 6,
                background:
                  p === phase
                    ? "hsl(var(--primary))"
                    : i < PHASES.indexOf(phase)
                    ? "hsl(var(--primary) / 0.35)"
                    : "hsl(var(--muted-foreground) / 0.22)",
                cursor: "pointer",
                border: "none",
                padding: 0,
              }}
              aria-label={`Go to ${PHASE_META[p].label ?? PHASE_META[p].eyebrow}`}
            />
          ))}
        </div>
      </div>

      {/* ── Caption column ── */}
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
          small, doable thing — not a to-do list.
        </div>
      </div>
    </div>
  );
}
