import { useEffect, useRef, useState } from "react";

type Stage =
  | "entry"      // prompt shown, no typewriter
  | "sift"       // sift button pressed
  | "summary"    // Sift's mirror text appears
  | "followup"   // Sift's follow-up question
  | "response"   // user response (typewriter)
  | "cards"      // signal/noise cards appear with buttons
  | "result";    // final result shown

// ─── Timing (ms) ───────────────────────────────────────────────
const STAGES = {
  entry:    0,
  sift:     3200,
  summary:  6400,
  followup: 9000,
  response: 12000,
  cards:    17000,
  result:   22000,
} as const;

const TOTAL = 26000;

// ─── Content ───────────────────────────────────────────────────
const ENTRY_TEXT = "I keep telling myself I'm going to do it, but every time I sit down to work I end up doing something else — scrolling, cleaning, something. Then I feel worse.";

const MIRROR_TEXT = "What you are holding is not laziness. It is avoidance with a question underneath — what are you actually protecting?";

const FOLLOWUP_TEXT = "When you say you 'end up doing something else' — is the scrolling or cleaning actually doing something for you, or is it just quieter than sitting with what needs to be done?";

const RESPONSE_TEXT = "No, it's not doing anything. I'm just... I think I'm avoiding the feeling of not being good enough if I try and fail. Again.";

const SIGNAL_CARDS = [
  {
    id: "c1",
    label: "Matters",
    text: "The fear of not being good enough is the real thing underneath.",
    stripe: "primary",
  },
  {
    id: "c2",
    label: "Matters",
    text: "You already know what you need to do — you just need permission to do it imperfectly.",
    stripe: "primary",
  },
  {
    id: "c3",
    label: "Noise",
    text: "The comparison to how fast you think others move.",
    stripe: "muted",
  },
  {
    id: "c4",
    label: "Don't know yet",
    text: "Whether this is about this project specifically, or something older.",
    stripe: "neutral",
  },
];

const RESULT_MATTERS = [
  "The fear underneath the avoidance.",
  "What you already know you need to do.",
];
const RESULT_NOISE = [
  "How fast others seem to move.",
  "The story that trying and failing makes you inadequate.",
];
const RESULT_STEP = "Write one sentence about what you would do if you already believed you were good enough to try.";

// ─── Helpers ───────────────────────────────────────────────────
function currentStage(t: number): Stage {
  if (t < STAGES.sift)    return "entry";
  if (t < STAGES.summary) return "sift";
  if (t < STAGES.followup) return "summary";
  if (t < STAGES.response) return "followup";
  if (t < STAGES.cards)   return "response";
  if (t < STAGES.result)   return "cards";
  return "result";
}

function stageProgress(t: number, start: number, end: number): number {
  return Math.min(1, Math.max(0, (t - start) / (end - start)));
}

function fmt(ms: number) {
  return ms / 1000 + "s";
}

// ─── Typewriter ───────────────────────────────────────────────
function useTypewriter(text: string, active: boolean, startMs: number, endMs: number) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!active) { setProgress(1); return; }
    setProgress(0);
    let raf: number;
    const start = performance.now() + startMs;
    const dur = endMs - startMs;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / dur));
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, active, startMs, endMs]);
  const chars = Math.round(progress * text.length);
  return text.slice(0, chars);
}

// ─── Main component ────────────────────────────────────────────
export function EngineDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef<number>(null);
  const startRef = useRef<number>(null);
  const [t, setT] = useState(0);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const u = () => setReducedMotion(mq.matches);
    u();
    mq.addEventListener?.("change", u);
    return () => mq.removeEventListener?.("change", u);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) { setInView(true); return; }
    const io = new IntersectionObserver(e => setInView(e[0].isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || reducedMotion) {
      if (raf.current) cancelAnimationFrame(raf.current);
      return;
    }
    startRef.current = null;
    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = (ts - startRef.current) % TOTAL;
      setT(elapsed);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [inView, reducedMotion]);

  const stage = reducedMotion ? "result" : currentStage(t);
  const p = (s: keyof typeof STAGES) => stageProgress(t, STAGES[s], STAGES[resultAfter(s)]);

  const displayedResponse = useTypewriter(
    RESPONSE_TEXT,
    stage === "response" || stage === "cards" || stage === "result",
    STAGES.response,
    STAGES.cards
  );

  return (
    <div
      ref={ref}
      className="grid items-stretch gap-8 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]"
    >
      {/* ── Left: demo card ── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 shadow-[var(--shadow-md)] backdrop-blur-md">
        <Card stage={stage} t={t} p={p} displayedResponse={displayedResponse} reducedMotion={reducedMotion} />
      </div>

      {/* ── Right: story ── */}
      <StoryPanel stage={stage} reducedMotion={reducedMotion} />
    </div>
  );
}

// resultAfter helper
function resultAfter(s: Stage): Stage {
  const order: Stage[] = ["entry","sift","summary","followup","response","cards","result"];
  const i = order.indexOf(s);
  return order[Math.min(i + 1, order.length - 1)];
}

// ─── Card content ─────────────────────────────────────────────
function Card({ stage, t, p, displayedResponse, reducedMotion }: {
  stage: Stage; t: number; p: (s: keyof typeof STAGES) => number;
  displayedResponse: string; reducedMotion: boolean;
}) {
  const ep = p("entry");
  const siftp = p("sift");
  const sump = p("summary");
  const fop = p("followup");
  const resp = p("response");
  const cardp = p("cards");
  const res2 = p("result");

  // Sift button press
  const siftPressed = stage === "sift" || stage === "summary" || stage === "followup" || stage === "response" || stage === "cards" || stage === "result";
  const siftLoading = stage === "sift" && !reducedMotion ? siftp < 0.6 : stage === "sift" && reducedMotion ? true : false;

  return (
    <div className="relative p-5 sm:p-7" style={{ minHeight: 520 }}>
      {/* ── Entry composer (always visible underneath, fades once sift starts) ── */}
      <div
        className="absolute inset-x-0 top-0 flex items-center justify-center px-4 pt-5 sm:pt-7 transition-opacity duration-700"
        style={{ opacity: siftPressed ? 0.12 : 1 }}
      >
        <div className="w-full max-w-[46ch] rounded-2xl border border-border/40 bg-background/60 p-4 text-[13px] leading-[1.6] text-foreground/70">
          {ENTRY_TEXT}
        </div>
      </div>

      {/* ── Sift button (if visible) ── */}
      {stage === "entry" && (
        <div className="absolute bottom-4 right-6 flex items-center gap-3">
          <div className="rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm">
            Sift
          </div>
        </div>
      )}

      {/* ── Summary / mirror ── */}
      {(stage === "summary" || stage === "followup" || stage === "response" || stage === "cards" || stage === "result") && (
        <div
          className="absolute inset-x-0 top-4 flex items-center justify-center px-4 transition-all duration-700"
          style={{
            opacity: sump > 0 ? 1 : 0,
            transform: sump > 0 ? "translateY(0)" : "translateY(6px)",
          }}
        >
          <div className="max-w-[44ch] rounded-2xl border border-border/50 bg-background/50 px-4 py-3 text-center text-[13.5px] leading-[1.6] text-foreground/80 backdrop-blur-sm">
            {MIRROR_TEXT}
          </div>
        </div>
      )}

      {/* ── Follow-up question ── */}
      {(stage === "followup" || stage === "response" || stage === "cards" || stage === "result") && (
        <div
          className="absolute inset-x-0 top-4 flex items-center justify-center px-4 transition-all duration-700"
          style={{
            opacity: fop > 0 && sump < 1 ? 0 : fop > 0 ? 1 : 0,
            transform: fop > 0 ? "translateY(0)" : "translateY(6px)",
          }}
        >
          <div className="max-w-[44ch] rounded-2xl border border-border/40 bg-muted/10 px-4 py-3 text-center text-[13px] leading-[1.55] text-muted-foreground/80 backdrop-blur-sm">
            {FOLLOWUP_TEXT}
          </div>
        </div>
      )}

      {/* ── User response (typewriter) ── */}
      {(stage === "response" || stage === "cards" || stage === "result") && (
        <div
          className="absolute inset-x-0 top-4 flex items-center justify-center px-4 transition-all duration-700"
          style={{
            opacity: resp > 0 ? 1 : 0,
            transform: resp > 0 ? "translateY(0)" : "translateY(6px)",
          }}
        >
          <div className="max-w-[44ch] rounded-2xl border border-primary/25 bg-primary/[0.05] px-4 py-3 text-center text-[13px] leading-[1.55] text-foreground/85 backdrop-blur-sm">
            {displayedResponse}
            <span className="ml-[2px] inline-block h-[1em] w-[1.5px] -translate-y-px bg-foreground/40" />
          </div>
        </div>
      )}

      {/* ── Signal/Noise explanation cards ── */}
      {(stage === "cards" || stage === "result") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-4 transition-all duration-800"
          style={{
            opacity: cardp > 0 ? 1 : 0,
            transform: cardp > 0 ? "scale(1)" : "scale(0.97)",
          }}
        >
          {SIGNAL_CARDS.map((card, i) => {
            const cardProgress = Math.min(1, (cardp - i * 0.12) / 0.5);
            const stripe = card.stripe === "primary" ? "border-primary/40 bg-primary/[0.06]" :
                           card.stripe === "muted"   ? "border-muted-foreground/25 bg-muted/20" :
                           "border-border/40 bg-muted/10";
            return (
              <div
                key={card.id}
                className={`w-full max-w-[46ch] rounded-xl border px-4 py-2.5 backdrop-blur-sm ${stripe}`}
                style={{
                  opacity: cardProgress,
                  transform: `translateY(${(1 - cardProgress) * 8}px)`,
                  transitionDelay: `${i * 80}ms`,
                }}
              >
                <div className="mb-1.5 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <ChipBtn label="Matters" delay={i * 80 + 200} />
                    <ChipBtn label="Noise" delay={i * 80 + 300} />
                    <ChipBtn label="?" delay={i * 80 + 400} muted />
                  </div>
                </div>
                <p className="text-[12.5px] leading-snug text-foreground/80">{card.text}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Result ── */}
      {stage === "result" && (
        <div
          className="absolute inset-x-0 bottom-4 top-4 flex flex-col items-center justify-center gap-3 px-4"
          style={{ opacity: res2 }}
        >
          <div className="w-full max-w-[44ch] rounded-2xl border border-border/50 bg-background/40 px-4 py-3 backdrop-blur-sm">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-primary/70">What Sift heard</div>
            <p className="text-[13px] leading-[1.6] text-foreground/85">{MIRROR_TEXT}</p>
          </div>
          <div className="grid w-full max-w-[44ch] grid-cols-2 gap-2.5">
            <Bin label="Matters" tone="primary" items={RESULT_MATTERS} />
            <Bin label="Noise" tone="muted" items={RESULT_NOISE} />
          </div>
          <div className="w-full max-w-[44ch] rounded-xl border border-primary/25 bg-primary/[0.05] px-4 py-2.5">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-primary/70">One next step</div>
            <p className="text-[12.5px] leading-snug text-foreground/90">{RESULT_STEP}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small chip buttons inside cards ─────────────────────────
function ChipBtn({ label, delay, muted }: { label: string; delay: number; muted?: boolean }) {
  return (
    <button
      className="rounded-full border px-2 py-1 text-[10px] font-medium transition-colors"
      style={{
        borderColor: muted ? "hsl(var(--border))" : "hsl(var(--primary) / 0.4)",
        color: muted ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))",
        background: muted ? "hsl(var(--muted) / 0.15)" : "hsl(var(--primary) / 0.06)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// ─── Bins in result ───────────────────────────────────────────
function Bin({ label, tone, items }: { label: string; tone: "primary" | "muted"; items: string[] }) {
  const isP = tone === "primary";
  return (
    <div
      className="rounded-xl border border-dashed px-3 py-2"
      style={{
        borderColor: isP ? "hsl(var(--primary) / 0.35)" : "hsl(var(--muted-foreground) / 0.25)",
        background: isP ? "hsl(var(--primary) / 0.04)" : "hsl(var(--muted) / 0.15)",
      }}
    >
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.2em]" style={{ color: isP ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}>
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

// ─── Story panel ──────────────────────────────────────────────
const STORY: Record<Stage, { eyebrow: string; line: string }> = {
  entry: {
    eyebrow: "The entry",
    line: "You bring what you're holding — messy, honest, unfinished.",
  },
  sift: {
    eyebrow: "Sift",
    line: "The button press is the only action. Everything else happens underneath.",
  },
  summary: {
    eyebrow: "The mirror",
    line: "Sift names what it's hearing — not interpreting, not advising, just reflecting the shape.",
  },
  followup: {
    eyebrow: "One clear question",
    line: "Sift asks the one thing that, if answered honestly, cuts through the knot.",
  },
  response: {
    eyebrow: "Your response",
    line: "You answer, and Sift listens without judgment or escalation.",
  },
  cards: {
    eyebrow: "Signal or noise",
    line: "Sift surfaces the patterns — you decide which pile each one belongs in.",
  },
  result: {
    eyebrow: "The shape",
    line: "Not a list. Not advice. Just a cleaner read on what's actually going on, and one small next step.",
  },
};

const ALL: Stage[] = ["entry","sift","summary","followup","response","cards","result"];

function StoryPanel({ stage, reducedMotion }: { stage: Stage; reducedMotion: boolean }) {
  const idx = ALL.indexOf(stage);
  return (
    <div className="flex flex-col justify-center space-y-6">
      <div key={stage}>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          {STORY[stage].eyebrow}
        </div>
        <p className="font-serif text-[clamp(1.1rem,1.5vw,1.4rem)] leading-[1.45] tracking-[-0.01em] text-foreground">
          {STORY[stage].line}
        </p>
      </div>

      {!reducedMotion && (
        <div className="flex items-center gap-1.5">
          {ALL.map((s, i) => (
            <span
              key={s}
              aria-hidden="true"
              className="h-[5px] rounded-full transition-all duration-400"
              style={{
                width: i === idx ? 20 : 5,
                background: i === idx ? "hsl(var(--primary))"
                  : i < idx ? "hsl(var(--primary) / 0.4)"
                  : "hsl(var(--muted-foreground) / 0.2)",
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