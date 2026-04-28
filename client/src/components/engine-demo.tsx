import { useEffect, useRef, useState, useCallback } from "react";

type Phase = "pile" | "signal" | "shape" | "step";

const SIGNAL_TEXT = "You're not missing time. You're missing support for what you actually need.";
const NOISE_TEXT = "The guilt about not doing more, the story that rest equals failure, the loop of exhaustion.";
const MATTERS = ["The thing you keep almost-starting is the one you actually care about.", "You are tired in a way rest alone does not fix."];
const NOISE_PHRASES = ["The full inbox.", "The shape of the to-do list.", "The story that you are behind."];
const NEXT_STEP = "Pick the one item that scares you a little and write the first sentence — nothing more.";

const PHASES: Phase[] = ["pile", "signal", "shape", "step"];

const PHASE_META: Record<Phase, { num: string; eyebrow: string; caption: string }> = {
  pile: {
    num: "01",
    eyebrow: "Everything you're holding",
    caption: "No order yet. No judgment. Just the full mess on the table — the work, the family, the tiredness, all of it.",
  },
  signal: {
    num: "02",
    eyebrow: "What's actually there",
    caption: "Sift listens for the phrases that are actually there — not the story about them, just what you said.",
  },
  shape: {
    num: "03",
    eyebrow: "What matters / what's only noise",
    caption: "What's central lands on the left. What's distortion lands on the right. Not a score — a read.",
  },
  step: {
    num: "04",
    eyebrow: "One doable thing",
    caption: "Not a to-do list. Not advice. Just the one small thing you can actually take today.",
  },
};

// Matches Sift's card aesthetic — dark surface, rounded-3xl, border-border/60
const CARD = "rounded-3xl border border-border/60 bg-card/80 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.18)] backdrop-blur-md";

export function EngineDemo() {
  const [phase, setPhase] = useState<Phase>("pile");
  const [animT, setAnimT] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  const goTo = useCallback((p: Phase) => {
    setPhase(p);
    setAnimT(0);
    startRef.current = null;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Short, punchy phase durations — fast enough to stay engaging, slow enough to read each state.
  const PHASE_DUR: Record<Phase, number> = { pile: 1200, signal: 1200, shape: 1200, step: 1000 };

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
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase, reducedMotion]);

  const fade = (t: number) => reducedMotion ? 1 : t;
  const slideUp = (t: number, offset = 12) => reducedMotion ? "translateY(0)" : `translateY(${(1 - t) * offset}px)`;

  return (
    <div className="grid items-stretch gap-8 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      {/* Stage card */}
      <div className={`relative overflow-hidden p-6 sm:p-8 ${CARD}`} style={{ minHeight: 480 }}>

        {/* 01 — The pile: show the input */}
        {phase === "pile" && (
          <div className="flex h-full flex-col justify-center">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Clarity over comfort
            </p>
            <h3 className="m-0 mb-5 font-serif text-3xl leading-tight tracking-tight">
              What are you holding <em className="font-serif italic">right now?</em>
            </h3>
            <div
              className="rounded-xl border border-border/40 bg-background/60 p-4"
              style={{ minHeight: 120 }}
            >
              <p className="m-0 text-[15px] leading-[1.7] text-foreground/90 opacity-60 italic">
                There is so much I should be doing — replying, planning, fixing — and I keep stalling. I do not know if I am tired or avoiding something.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Messy is fine.</span>
              <span className="inline-flex h-9 items-center justify-center rounded-full bg-primary/90 px-4 text-xs font-semibold text-primary-foreground">
                Sift
              </span>
            </div>
          </div>
        )}

        {/* 02 — Signal emerges */}
        {phase === "signal" && (
          <div className="flex h-full flex-col justify-center">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              What Sift heard
            </p>
            <p className="m-0 mb-6 text-[15px] leading-[1.7] text-foreground/90 font-serif italic">
              "What you are holding is not laziness. It is a stack of half-started things and a quiet question underneath."
            </p>
          </div>
        )}

        {/* 03 — The shape: Matters / Noise */}
        {phase === "shape" && (
          <div className="flex h-full flex-col justify-center gap-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">What seems to matter most</p>
            <div className="space-y-2">
              {MATTERS.map((m, i) => (
                <div key={i} className="flex gap-2 text-[13px] leading-snug text-foreground/90">
                  <span className="text-primary/60 mt-[0.2em]">·</span>
                  <span>{m}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border/40 pt-4">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground/70">What may be noise</p>
              <div className="space-y-1.5">
                {NOISE_PHRASES.map((n, i) => (
                  <div key={i} className="flex gap-2 text-[13px] leading-snug text-muted-foreground">
                    <span className="text-muted-foreground/40 mt-[0.2em]">·</span>
                    <span>{n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 04 — One next step */}
        {phase === "step" && (
          <div className="flex h-full flex-col justify-center">
            <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] px-5 py-4">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.22em] text-primary/70">
                One next step
              </p>
              <p className="m-0 text-[14px] leading-snug text-foreground/95">
                {NEXT_STEP}
              </p>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              And then quiet. Sift remembers the throughline, not the noise.
            </p>
          </div>
        )}

        {/* Progress dots — bottom center, brand aligned */}
        <div
          aria-hidden="true"
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5"
        >
          {PHASES.map((p) => {
            const isActive = p === phase;
            const wasActive = PHASES.indexOf(p) < PHASES.indexOf(phase);
            return (
              <button
                key={p}
                onClick={() => goTo(p)}
                className="cursor-pointer rounded-full border-none p-0 transition-all duration-400"
                style={{
                  width: isActive ? 18 : 6,
                  height: 6,
                  background: isActive
                    ? "hsl(var(--primary))"
                    : wasActive
                    ? "hsl(var(--primary) / 0.35)"
                    : "hsl(var(--muted-foreground) / 0.22)",
                }}
                aria-label={`Go to ${PHASE_META[p].eyebrow}`}
              />
            );
          })}
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
          small, doable thing — not a to-do list.
        </div>
      </div>
    </div>
  );
}