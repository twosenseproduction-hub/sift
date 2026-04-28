import { useEffect, useRef, useState } from "react";

// ─── Phases ─────────────────────────────────────────────────
type Phase = "entry" | "cards" | "result";
// entry: show the original prompt
// cards: signal/noise cards float in one by one
// result: settled composition with bins + next step

const PHASES: Phase[] = ["entry", "cards", "result"];

// ─── Timing ────────────────────────────────────────────────
const T = { entry: 0, cards: 3200, result: 9000 };
const TOTAL = 19000;


function currentPhase(elapsed: number): Phase {
  if (elapsed < T.cards)  return "entry";
  if (elapsed < T.result) return "cards";
  return "result";
}

function phaseProg(elapsed: number, start: number, end: number): number {
  return Math.min(1, Math.max(0, (elapsed - start) / (end - start)));
}

// ─── Content ───────────────────────────────────────────────
const ENTRY_TEXT =
  "I keep telling myself I'm going to do it, but every time I sit down to work I end up doing something else — scrolling, cleaning, something. Then I feel worse.";

const SIGNAL_CARDS = [
  {
    id: "c1",
    color: "primary" as const,
    label: "Matters",
    text: "The fear of not being good enough is the real thing underneath.",
  },
  {
    id: "c2",
    color: "primary" as const,
    label: "Matters",
    text: "You already know what you need to do — you just need permission to do it imperfectly.",
  },
  {
    id: "c3",
    color: "muted" as const,
    label: "Noise",
    text: "The comparison to how fast you think others move.",
  },
  {
    id: "c4",
    color: "muted" as const,
    label: "Noise",
    text: "The story that trying and failing makes you inadequate.",
  },
];

const MATTERS_ITEMS = [
  "The fear underneath the avoidance.",
  "What you already know you need to do.",
];
const NOISE_ITEMS = [
  "How fast others seem to move.",
  "The story that trying and failing makes you inadequate.",
];
const NEXT_STEP =
  "Write one sentence about what you would do if you already believed you were good enough to try.";

// ─── Story captions ─────────────────────────────────────────
const STORY: Record<Phase, { eyebrow: string; line: string }> = {
  entry: {
    eyebrow: "The entry",
    line: "You bring what you're holding — messy, honest, unfinished.",
  },
  cards: {
    eyebrow: "The sift",
    line: "Sift surfaces the patterns underneath. You decide which pile each one belongs in.",
  },
  result: {
    eyebrow: "The shape",
    line: "Not a list. Not advice. Just a cleaner read on what's actually going on, and one small next step.",
  },
};

// ─── Main component ─────────────────────────────────────────
export function EngineDemo() {
  const ref    = useRef<HTMLDivElement>(null);
  const raf    = useRef<number>(0);
  const startR = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [inView, setInView]   = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const u  = () => setReduced(mq.matches);
    u();
    mq.addEventListener?.("change", u);
    return () => mq.removeEventListener?.("change", u);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) { setInView(true); return; }
    const io = new IntersectionObserver(
      (e) => setInView(e[0].isIntersecting),
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || reduced) {
      if (raf.current) cancelAnimationFrame(raf.current);
      return;
    }
    startR.current = null;
    const tick = (ts: number) => {
      if (startR.current == null) startR.current = ts;
      const e = (ts - startR.current) % TOTAL;
      setElapsed(e);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [inView, reduced]);

  const phase: Phase = reduced ? "result" : currentPhase(elapsed);
  const ep = phaseProg(elapsed, T.entry, T.cards);
  const cp = phaseProg(elapsed, T.cards, T.result);
  const rp = phaseProg(elapsed, T.result, TOTAL);

  return (
    <div className="grid items-stretch gap-8 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      {/* ── Left: demo card ── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 shadow-[var(--shadow-md)] backdrop-blur-md">
        <Card phase={phase} ep={ep} cp={cp} rp={rp} reduced={reduced} />
      </div>

      {/* ── Right: story panel ── */}
      <StoryPanel phase={phase} reduced={reduced} />
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────
function Card({
  phase, ep, cp, rp, reduced,
}: {
  phase: Phase; ep: number; cp: number; rp: number; reduced: boolean;
}) {
  const H = 520;

  // Completely hide content not in the current phase.
  // Only one phase is visible at a time — no stacking.
  return (
    <div className="relative p-5 sm:p-7" style={{ minHeight: H }}>

      {/* ── ENTRY ── */}
      {phase === "entry" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-5">
          {/* Prompt card */}
          <div className="mb-6 w-full max-w-[46ch] rounded-2xl border border-border/40 bg-background/60 px-4 py-3">
            <p className="text-[13px] leading-[1.6] text-foreground/70">
              {ENTRY_TEXT}
            </p>
          </div>
          {/* Sift button */}
          <div className="rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm">
            Sift
          </div>
        </div>
      )}

      {/* ── CARDS ── */}
      {phase === "cards" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-5">
          {SIGNAL_CARDS.map((card, i) => {
            const delay    = i * 180;
            const prog     = reduced ? 1 : Math.min(1, Math.max(0, (cp * (T.result - T.cards) - delay) / 500));
            const stripe   = card.color === "primary"
              ? "border-primary/40 bg-primary/[0.06]"
              : "border-muted-foreground/20 bg-muted/15";
            const dotColor = card.color === "primary"
              ? "bg-primary"
              : "bg-muted-foreground/50";
            return (
              <div
                key={card.id}
                className={`mb-2 w-full max-w-[46ch] rounded-xl border px-4 py-2.5 backdrop-blur-sm ${stripe}`}
                style={{
                  opacity: prog,
                  transform: `translateY(${(1 - prog) * 10}px)`,
                  transition: `opacity 500ms ease-out ${delay}ms, transform 500ms ease-out ${delay}ms`,
                }}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                  <span
                    className="text-[10px] font-medium uppercase tracking-[0.18em]"
                    style={{
                      color: card.color === "primary"
                        ? "hsl(var(--primary))"
                        : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {card.label}
                  </span>
                </div>
                <p className="text-[12.5px] leading-snug text-foreground/80">
                  {card.text}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── RESULT ── */}
      {phase === "result" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-5"
          style={{
            opacity: rp,
            transform: `scale(${0.98 + rp * 0.02})`,
            transition: "opacity 600ms ease-out, transform 600ms ease-out",
          }}
        >
          {/* What Sift heard */}
          <div className="w-full max-w-[44ch] rounded-2xl border border-border/50 bg-background/40 px-4 py-3 backdrop-blur-sm">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-primary/70">
              What Sift heard
            </div>
            <p className="text-[13px] leading-[1.6] text-foreground/85">
              {SIGNAL_CARDS[0].text}
            </p>
          </div>

          {/* Bins */}
          <div className="grid w-full max-w-[44ch] grid-cols-2 gap-2.5">
            <ResultBin label="Matters" tone="primary" items={MATTERS_ITEMS} />
            <ResultBin label="Noise"   tone="muted"   items={NOISE_ITEMS} />
          </div>

          {/* One next step */}
          <div className="w-full max-w-[44ch] rounded-xl border border-primary/25 bg-primary/[0.05] px-4 py-2.5">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-primary/70">
              One next step
            </div>
            <p className="text-[12.5px] leading-snug text-foreground/90">
              {NEXT_STEP}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Result bin ────────────────────────────────────────────
function ResultBin({
  label, tone, items,
}: {
  label: string; tone: "primary" | "muted"; items: string[];
}) {
  const isP = tone === "primary";
  return (
    <div
      className="rounded-xl border border-dashed px-3 py-2"
      style={{
        borderColor: isP ? "hsl(var(--primary) / 0.35)" : "hsl(var(--muted-foreground) / 0.25)",
        background:   isP ? "hsl(var(--primary) / 0.04)" : "hsl(var(--muted) / 0.15)",
      }}
    >
      <div
        className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.2em]"
        style={{ color: isP ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
      >
        {label}
      </div>
      {items.map((item, i) => (
        <div key={i} className="text-[11.5px] leading-snug text-foreground/75">
          · {item}
        </div>
      ))}
    </div>
  );
}

// ─── Story panel ────────────────────────────────────────────
function StoryPanel({ phase, reduced }: { phase: Phase; reduced: boolean }) {
  const idx = PHASES.indexOf(phase);
  return (
    <div className="flex flex-col justify-center space-y-6">
      <div>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          {STORY[phase].eyebrow}
        </div>
        <p className="font-serif text-[clamp(1.1rem,1.5vw,1.4rem)] leading-[1.45] tracking-[-0.01em] text-foreground">
          {STORY[phase].line}
        </p>
      </div>

      {!reduced && (
        <div className="flex items-center gap-1.5">
          {PHASES.map((p, i) => (
            <span
              key={p}
              aria-hidden="true"
              className="h-[5px] rounded-full transition-all duration-300"
              style={{
                width: i === idx ? 20 : 5,
                background:
                  i === idx       ? "hsl(var(--primary))"       :
                  i < idx         ? "hsl(var(--primary) / 0.4)"  :
                                    "hsl(var(--muted-foreground) / 0.2)",
              }}
            />
          ))}
        </div>
      )}

      <div className="border-t border-border/50 pt-5 text-sm leading-7 text-muted-foreground">
        This is what Sift does, every time. It listens to the pile, lifts what is actually there,
        separates signal from noise, and hands back one small, doable thing — not a to-do list.
      </div>
    </div>
  );
}
