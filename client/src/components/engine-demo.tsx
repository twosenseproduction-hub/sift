import { useEffect, useRef, useState } from "react";

// ─── Phases ─────────────────────────────────────────────────
type Phase = "entry" | "cards" | "result";
// entry  — prompt + Sift button
// cards  — 4 signal/noise cards float in, one by one
// result — settled composition: bins fill, next step appears

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

// 4 cards matching the real Sift response.
// Each card: dot color, label, and Sift's assigned bucket (for bin destination).
const SIGNAL_CARDS = [
  {
    id: "c1",
    bucket: "matters" as const,
    label: "Matters",
    dot: "primary" as const,
    text: "The fear of not being good enough is the real thing underneath.",
  },
  {
    id: "c2",
    bucket: "matters" as const,
    label: "Matters",
    dot: "primary" as const,
    text: "You already know what you need to do — you just need permission to do it imperfectly.",
  },
  {
    id: "c3",
    bucket: "noise" as const,
    label: "Noise",
    dot: "muted" as const,
    text: "The comparison to how fast you think others move.",
  },
  {
    id: "c4",
    bucket: "noise" as const,
    label: "Noise",
    dot: "muted" as const,
    text: "The story that trying and failing makes you inadequate.",
  },
];

const BIN_ITEMS = {
  matters: [
    "The fear underneath the avoidance.",
    "What you already know you need to do.",
  ],
  noise: [
    "How fast others seem to move.",
    "The story that trying and failing makes you inadequate.",
  ],
};

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
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 shadow-[var(--shadow-md)] backdrop-blur-md">
        <Card phase={phase} ep={ep} cp={cp} rp={rp} reduced={reduced} />
      </div>
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

  // ── ENTRY ──────────────────────────────────────────────
  if (phase === "entry") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5">
        <div
          className="mb-6 w-full max-w-[46ch] rounded-2xl border border-border/40 bg-background/60 px-4 py-3"
          style={{ opacity: reduced ? 1 : ep, transition: "opacity 600ms ease-out" }}
        >
          <p className="text-[13px] leading-[1.6] text-foreground/70">
            {ENTRY_TEXT}
          </p>
        </div>
        <div
          className="rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm"
          style={{ opacity: reduced ? 1 : ep, transition: "opacity 400ms ease-out 200ms" }}
        >
          Sift
        </div>
      </div>
    );
  }

  // ── CARDS ─────────────────────────────────────────────
  if (phase === "cards") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5">
        {SIGNAL_CARDS.map((card, i) => {
          const delay    = i * 180;
          const dur      = 500;
          const cardProg = reduced
            ? 1
            : Math.min(1, Math.max(0, (cp * (T.result - T.cards) - delay) / dur));

          const dotColor = card.dot === "primary"
            ? "bg-primary"
            : "bg-muted-foreground/45";
          const stripe = card.dot === "primary"
            ? "border-primary/35 bg-primary/[0.05]"
            : "border-muted-foreground/20 bg-muted/15";
          const labelColor = card.dot === "primary"
            ? "text-primary"
            : "text-muted-foreground/80";

          return (
            <div
              key={card.id}
              className={`mb-2 w-full max-w-[46ch] rounded-xl border px-4 py-2.5 backdrop-blur-sm ${stripe}`}
              style={{
                opacity: cardProg,
                transform: `translateY(${(1 - cardProg) * 12}px)`,
                transition: `opacity ${dur}ms ease-out ${delay}ms, transform ${dur}ms ease-out ${delay}ms`,
              }}
            >
              {/* Label row */}
              <div className="mb-1.5 flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                <span className={`text-[10px] font-medium uppercase tracking-[0.18em] ${labelColor}`}>
                  {card.label}
                </span>
                {/* Clickable pills */}
                <div className="ml-auto flex gap-1">
                  {(["Matters", "Noise", "?"] as const).map((lbl) => {
                    const isActive = lbl === card.label;
                    const pillStripe = lbl === "Matters"
                      ? "border-primary/45 text-primary bg-primary/[0.07]"
                      : lbl === "Noise"
                      ? "border-muted-foreground/30 text-muted-foreground/80 bg-muted/15"
                      : "border-border text-muted-foreground/60 bg-transparent";
                    return (
                      <button
                        key={lbl}
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${pillStripe}`}
                        style={{ cursor: "pointer" }}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Card text */}
              <p className="text-[12.5px] leading-snug text-foreground/80">
                {card.text}
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  // ── RESULT ─────────────────────────────────────────────
  // Bins fill with chips that flew in from the cards phase,
  // then the "What Sift heard" + next step appear on top.
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-5"
      style={{
        opacity: rp,
        transform: `scale(${0.98 + rp * 0.02})`,
        transition: "opacity 700ms ease-out, transform 700ms ease-out",
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
        <ResultBin label="Matters" tone="primary" items={BIN_ITEMS.matters} />
        <ResultBin label="Noise"   tone="muted"   items={BIN_ITEMS.noise} />
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
