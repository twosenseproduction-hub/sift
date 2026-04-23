import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  onContinue?: () => void;
}

type Phase = "idle" | "inhale" | "hold" | "exhale" | "done";

// Total cycles before the session completes. Kept brief and calm.
const TOTAL_CYCLES = 3;

// Phase durations, in ms. Slow and even — no drama.
const INHALE_MS = 4600;
const HOLD_MS = 1400;
const EXHALE_MS = 6000;

// Deterministic, seeded PRNG.
function makeRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// Build a closed, irregular, hand-drawn ring at a given base radius and a
// phase offset `t` (radians). Passing a changing `t` makes the ring breathe
// organically — the wobble drifts instead of freezing.
function buildRingPath(
  cx: number,
  cy: number,
  baseR: number,
  t: number,
  seed: number,
): string {
  const points = 72;
  const rand = makeRand(seed);
  // Pre-compute stable per-vertex offsets so the shape has identity, then
  // modulate with low-frequency sines driven by `t` so it drifts.
  const pts: Array<[number, number]> = [];
  const staticPhase: number[] = [];
  const staticAmp: number[] = [];
  for (let i = 0; i < points; i++) {
    staticPhase.push(rand() * Math.PI * 2);
    staticAmp.push(0.7 + rand() * 0.6); // 0.7..1.3
  }
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    // Three drifting low-frequency harmonics + one tiny high-frequency jitter.
    const w1 =
      Math.sin(a * 3 + t * 0.8 + staticPhase[i]) *
      (baseR * 0.042) *
      staticAmp[i];
    const w2 =
      Math.cos(a * 5 + t * 1.1 + staticPhase[i] * 0.7) * (baseR * 0.026);
    const w3 = Math.sin(a * 2 + t * 0.5) * (baseR * 0.018);
    const j =
      Math.sin(a * 11 + t * 1.8 + staticPhase[i] * 1.3) * (baseR * 0.008);
    const r = baseR + w1 + w2 + w3 + j;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  // Smooth closed path through points using midpoint-quadratic curves.
  let d = "";
  for (let i = 0; i < points; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % points];
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    if (i === 0) d += `M ${mx.toFixed(2)} ${my.toFixed(2)} `;
    else d += `Q ${x0.toFixed(2)} ${y0.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)} `;
  }
  d += "Z";
  return d;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

/**
 * BreathingDot
 *
 * Quiet, optional grounding module. At rest it sits as a small invitation
 * beneath the composer. When started, it takes over the whole screen with a
 * living hand-drawn ring around a center dot. Three cycles, then a calm
 * resting state with a soft path back to writing.
 *
 * Respects prefers-reduced-motion: the ring stops fluctuating and the scale
 * transition is removed.
 */
export function BreathingDot({ onContinue }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [cycle, setCycle] = useState(0);
  const reduced = usePrefersReducedMotion();
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  // Continuous organic-time clock. Advances whenever the overlay is open,
  // driving the per-frame wobble of the ring path.
  const [tick, setTick] = useState(0);
  const rafRef = useRef<number | null>(null);

  const active = phase === "inhale" || phase === "hold" || phase === "exhale";
  const overlayOpen = active || phase === "done";

  useEffect(() => {
    if (!overlayOpen || reduced) return;
    let mounted = true;
    const start = performance.now();
    const loop = (now: number) => {
      if (!mounted) return;
      setTick((now - start) / 1000);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      mounted = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [overlayOpen, reduced]);

  // Lock page scroll while the overlay is open.
  useEffect(() => {
    if (!overlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [overlayOpen]);

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  const runCycle = (n: number) => {
    if (n >= TOTAL_CYCLES) {
      setPhase("done");
      setCycle(TOTAL_CYCLES);
      return;
    }
    setCycle(n);
    setPhase("inhale");
    timers.current.push(
      setTimeout(() => {
        setPhase("hold");
        timers.current.push(
          setTimeout(() => {
            setPhase("exhale");
            timers.current.push(
              setTimeout(() => runCycle(n + 1), EXHALE_MS),
            );
          }, HOLD_MS),
        );
      }, INHALE_MS),
    );
  };

  const start = () => {
    if (active) return;
    clearTimers();
    runCycle(0);
  };

  const stop = () => {
    clearTimers();
    setPhase("idle");
    setCycle(0);
  };

  // Escape key exits the overlay at any time.
  useEffect(() => {
    if (!overlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlayOpen]);

  // The ring scale per phase. Expanded further than before at inhale peak.
  const scale =
    reduced || phase === "idle"
      ? 1
      : phase === "inhale"
        ? 1.55
        : phase === "hold"
          ? 1.55
          : phase === "exhale"
            ? 1
            : 1;

  const phaseMs =
    phase === "inhale"
      ? INHALE_MS
      : phase === "exhale"
        ? EXHALE_MS
        : HOLD_MS;

  const phaseText =
    phase === "inhale"
      ? "Inhale"
      : phase === "hold"
        ? ""
        : phase === "exhale"
          ? "Exhale"
          : "";

  // Organic time drives the ring path. Frozen when reduced-motion is on.
  const ringPath = useMemo(
    () => buildRingPath(200, 200, 110, reduced ? 0 : tick, 0x51f7c0d3),
    [tick, reduced],
  );

  // Resting module (below composer) — same tone as other quiet modules.
  const resting = (
    <section
      aria-labelledby="breathing-title"
      className="mt-10 md:mt-12 pt-6 md:pt-8 border-t border-border/40"
      data-testid="card-breathing"
    >
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p
            id="breathing-title"
            className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground/80 font-medium"
            data-testid="text-breathing-eyebrow"
          >
            Breath
          </p>
          <p
            className="mt-1.5 text-sm md:text-[15px] leading-snug text-muted-foreground"
            data-testid="text-breathing-line"
          >
            A moment before you write.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-4 text-sm">
          <button
            type="button"
            onClick={start}
            data-testid="button-breathing-open"
            className="text-foreground/80 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
          >
            Try it
          </button>
        </div>
      </div>
    </section>
  );

  if (!overlayOpen) return resting;

  return (
    <>
      {resting}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Breathing"
        data-testid="overlay-breathing"
        className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center text-foreground"
      >
        {/* Close (always available) */}
        <button
          type="button"
          onClick={stop}
          aria-label="Close"
          data-testid="button-breathing-close"
          className="absolute top-5 right-5 md:top-6 md:right-6 text-xs tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors"
        >
          Close
        </button>

        {/* Phase word — subtle, above the ring */}
        <div
          className="h-6 text-xs md:text-sm tracking-[0.25em] uppercase text-muted-foreground"
          data-testid="text-breathing-phase"
        >
          {phase === "done"
            ? "Still here"
            : active
              ? phaseText || "\u00A0"
              : "\u00A0"}
        </div>

        {/* The ring + dot */}
        <button
          type="button"
          onClick={active ? stop : start}
          aria-label={active ? "Stop breathing" : "Start breathing"}
          data-testid="button-breathing-dot"
          className="mt-6 md:mt-8 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        >
          <svg
            width="min(74vmin, 560px)"
            height="min(74vmin, 560px)"
            viewBox="0 0 400 400"
            aria-hidden="true"
            className="block"
            style={{
              width: "min(74vmin, 560px)",
              height: "min(74vmin, 560px)",
            }}
          >
            <g
              style={{
                transformOrigin: "200px 200px",
                transform: `scale(${scale})`,
                transition: reduced
                  ? "none"
                  : `transform ${phaseMs}ms cubic-bezier(0.37, 0, 0.24, 1)`,
              }}
            >
              <path
                d={ringPath}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinejoin="round"
                strokeLinecap="round"
                className="text-foreground/55"
                vectorEffect="non-scaling-stroke"
              />
            </g>
            <circle cx="200" cy="200" r="7" className="fill-foreground" />
          </svg>
        </button>

        {/* Footer: cycle count while active, soft continuation when done */}
        <div className="mt-8 md:mt-10 h-6 text-xs md:text-sm text-muted-foreground/80">
          {active ? (
            <span data-testid="text-breathing-count">
              {Math.min(cycle + 1, TOTAL_CYCLES)} of {TOTAL_CYCLES}
            </span>
          ) : phase === "done" ? (
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => {
                  setPhase("idle");
                  setCycle(0);
                  onContinue?.();
                }}
                data-testid="button-breathing-continue"
                className="text-foreground/85 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
              >
                Begin writing
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhase("idle");
                  setCycle(0);
                  runCycle(0);
                }}
                data-testid="button-breathing-reset"
                className="text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                Again
              </button>
            </div>
          ) : (
            <span>&nbsp;</span>
          )}
        </div>
      </div>
    </>
  );
}
