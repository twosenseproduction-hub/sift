import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  onContinue?: () => void;
}

type Phase = "idle" | "inhale" | "hold" | "exhale" | "done";

// Total cycles before the session completes. Kept brief and calm.
const TOTAL_CYCLES = 3;

// Phase durations, in ms. Slow and even — no drama.
const INHALE_MS = 4200;
const HOLD_MS = 1200;
const EXHALE_MS = 5600;

// Build a single closed, irregular, hand-drawn-feeling ring as an SVG path.
// Deterministic per-mount so the ring looks stable but imperfect.
function buildRingPath(cx: number, cy: number, baseR: number, seed: number): string {
  const points = 64;
  // Simple seeded PRNG — good enough for a wobble.
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    // Two overlapping low-frequency wobbles, plus a tiny high-frequency jitter.
    const w1 = Math.sin(a * 3 + rand() * 0.6) * (baseR * 0.035);
    const w2 = Math.cos(a * 5 + rand() * 0.9) * (baseR * 0.022);
    const j = (rand() - 0.5) * (baseR * 0.012);
    const r = baseR + w1 + w2 + j;
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
 * A quiet, optional grounding module. Lives below the composer as a secondary
 * offering — not part of the required flow. Tap the center dot to begin; the
 * hand-drawn ring expands on the inhale and settles on the exhale. Three
 * cycles, then a subtle rest state with a soft invitation back to writing.
 *
 * Respects prefers-reduced-motion: the ring stays still and the session runs
 * as quiet phase text only.
 */
export function BreathingDot({ onContinue }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [cycle, setCycle] = useState(0);
  const reduced = usePrefersReducedMotion();
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const ringPath = useMemo(() => buildRingPath(100, 100, 64, 0x51f7c0d3), []);

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
    if (phase === "inhale" || phase === "hold" || phase === "exhale") return;
    clearTimers();
    runCycle(0);
  };

  const stop = () => {
    clearTimers();
    setPhase("idle");
    setCycle(0);
  };

  const active = phase === "inhale" || phase === "hold" || phase === "exhale";

  // Ring scale per phase. Kept gentle; no bounce.
  const scale =
    reduced || phase === "idle"
      ? 1
      : phase === "inhale"
        ? 1.18
        : phase === "hold"
          ? 1.18
          : phase === "exhale"
            ? 1
            : 1; // done

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

  return (
    <section
      aria-labelledby="breathing-title"
      className="mt-10 md:mt-12 pt-6 md:pt-8 border-t border-border/40"
      data-testid="card-breathing"
    >
      <div className="flex flex-col items-center text-center">
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
          {phase === "done"
            ? "Still here. Take your time."
            : active
              ? phaseText || "\u00A0"
              : "A moment before you write."}
        </p>

        <button
          type="button"
          onClick={active ? stop : start}
          aria-label={active ? "Stop breathing" : "Start breathing"}
          data-testid="button-breathing-dot"
          className="mt-6 md:mt-7 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        >
          <svg
            width="160"
            height="160"
            viewBox="0 0 200 200"
            aria-hidden="true"
            className="block"
          >
            <g
              style={{
                transformOrigin: "100px 100px",
                transform: `scale(${scale})`,
                transition: reduced
                  ? "none"
                  : `transform ${phaseMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
              }}
            >
              <path
                d={ringPath}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                className="text-foreground/55"
                vectorEffect="non-scaling-stroke"
              />
            </g>
            <circle
              cx="100"
              cy="100"
              r="6"
              className="fill-foreground"
            />
          </svg>
        </button>

        <div className="mt-5 h-5 text-xs text-muted-foreground/70">
          {active ? (
            <span data-testid="text-breathing-count">
              {Math.min(cycle + 1, TOTAL_CYCLES)} of {TOTAL_CYCLES}
            </span>
          ) : phase === "done" ? (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setPhase("idle");
                  setCycle(0);
                  onContinue?.();
                }}
                data-testid="button-breathing-continue"
                className="text-foreground/80 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
              >
                Begin writing
              </button>
              <button
                type="button"
                onClick={stop}
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
    </section>
  );
}
