import { useCallback, useEffect, useRef, useState } from "react";

// ─── Stages ─────────────────────────────────────────────────
type StageName =
  | "entry"    // prompt shown full, no typewriter
  | "sift"     // loading state
  | "summary"  // Sift's mirror text
  | "followup" // Sift's follow-up question
  | "response" // user response typewriter
  | "cards"    // signal/noise explanation cards
  | "result";  // final result

// ─── Timing (ms) ─────────────────────────────────────────────
const T = {
  entry:    0,
  sift:     2200,
  summary:  4400,
  followup: 6600,
  response: 10000,
  cards:    13500,
  result:   17500,
};
const TOTAL = 21000; // loop length

function currentStage(elapsed: number): StageName {
  if (elapsed < T.sift)    return "entry";
  if (elapsed < T.summary)  return "sift";
  if (elapsed < T.followup) return "followup";
  if (elapsed < T.response) return "response";
  if (elapsed < T.cards)   return "cards";
  return "result";
}

function stageProgress(elapsed: number, start: number, end: number): number {
  return Math.min(1, Math.max(0, (elapsed - start) / (end - start)));
}

const nextOf = (s: StageName): StageName => {
  const all: StageName[] = ["entry","sift","summary","followup","response","cards","result"];
  return all[Math.min(all.indexOf(s) + 1, all.length - 1)];
};

// ─── Content ────────────────────────────────────────────────
const ENTRY_TEXT =
  "I keep telling myself I'm going to do it, but every time I sit down to work I end up doing something else — scrolling, cleaning, something. Then I feel worse.";

const MIRROR_TEXT =
  "What you are holding is not laziness. It is avoidance with a question underneath — what are you actually protecting?";

const FOLLOWUP_TEXT =
  "When you say you 'end up doing something else' — is the scrolling or cleaning actually doing something for you, or is it just quieter than sitting with what needs to be done?";

const RESPONSE_TEXT =
  "No, it's not doing anything. I'm just... I think I'm avoiding the feeling of not being good enough if I try and fail. Again.";

const SIGNAL_CARDS = [
  { id: "c1", color: "primary" as const, text: "The fear of not being good enough is the real thing underneath." },
  { id: "c2", color: "primary" as const, text: "You already know what you need to do — you just need permission to do it imperfectly." },
  { id: "c3", color: "muted"   as const, text: "The comparison to how fast you think others move." },
  { id: "c4", color: "neutral" as const, text: "Whether this is about this project specifically, or something older." },
];

const RESULT_MATTERS = [
  "The fear underneath the avoidance.",
  "What you already know you need to do.",
];
const RESULT_NOISE = [
  "How fast others seem to move.",
  "The story that trying and failing makes you inadequate.",
];
const RESULT_STEP =
  "Write one sentence about what you would do if you already believed you were good enough to try.";

// ─── Story captions ──────────────────────────────────────────
const STORY: Record<StageName, { eyebrow: string; line: string }> = {
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
const ALL_STAGES: StageName[] = ["entry","sift","summary","followup","response","cards","result"];

// ─── Typewriter hook ─────────────────────────────────────────
function useTypewriter(text: string, active: boolean, startMs: number, endMs: number) {
  const [progress, setProgress] = useState(active ? 1 : 0);
  useEffect(() => {
    if (!active) { setProgress(1); return; }
    setProgress(0);
    const dur = endMs - startMs;
    let raf: number;
    const start = performance.now() + startMs;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / dur));
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, active, startMs, endMs]);
  return text.slice(0, Math.round(progress * text.length));
}

// ─── Main component ──────────────────────────────────────────
export function EngineDemo() {
  const ref    = useRef<HTMLDivElement>(null);
  const raf    = useRef<number>(0);
  const startR = useRef<number | null>(null);
  const [elapsed, setElapsed]   = useState(0);
  const [inView, setInView]     = useState(false);
  const [reduced, setReduced]   = useState(false);

  // prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const u  = () => setReduced(mq.matches);
    u();
    mq.addEventListener?.("change", u);
    return () => mq.removeEventListener?.("change", u);
  }, []);

  // IntersectionObserver
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

  // Animation loop
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

  const stage: StageName = reduced ? "result" : currentStage(elapsed);
  const sp = (s: keyof typeof T) => stageProgress(elapsed, T[s], T[nextOf(s)]);

  // Typewriter for response phase
  const displayedResponse = useTypewriter(
    RESPONSE_TEXT,
    stage === "response" || stage === "cards" || stage === "result",
    T.response,
    T.cards
  );

  return (
    <div className="grid items-stretch gap-8 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      {/* ── Left: demo card ── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 shadow-[var(--shadow-md)] backdrop-blur-md">
        <Card
          stage={stage}
          ep={sp("entry")}
          sp2={sp("sift")}
          sump={sp("summary")}
          fop={sp("followup")}
          rp={sp("response")}
          cp={sp("cards")}
          r2p={sp("result")}
          displayedResponse={displayedResponse}
          reduced={reduced}
        />
      </div>

      {/* ── Right: story panel ── */}
      <StoryPanel stage={stage} reduced={reduced} />
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────
// SINGLE content slot — one phase replaces the previous, no stacking.
function Card({
  stage, ep, sp2, sump, fop, rp, cp, r2p,
  displayedResponse, reduced,
}: {
  stage: StageName;
  ep: number; sp2: number; sump: number; fop: number;
  rp: number; cp: number; r2p: number;
  displayedResponse: string;
  reduced: boolean;
}) {
  const H = 520; // card height

  // Common slot: center-aligned, full width, animated in/out
  const slot = (children: React.ReactNode, opacity: number, y: string, xPad = "px-5") => (
    <div
      className={`absolute inset-x-0 flex items-center justify-center ${xPad} transition-all duration-500`}
      style={{ top: y, opacity, transform: y === "50%" ? "translateY(-50%)" : undefined }}
    >
      {children}
    </div>
  );

  return (
    <div className="relative p-5 sm:p-7" style={{ minHeight: H }}>

      {/* ── ENTRY ── full prompt, fades when sift starts */}
      {ep > 0 && slot(
        <div className="w-full max-w-[46ch] rounded-2xl border border-border/40 bg-background/60 px-4 py-3 text-[13px] leading-[1.6] text-foreground/70">
          {ENTRY_TEXT}
        </div>,
        ep > sp2 ? 1 : 0.1,
        "50%"
      )}

      {/* ── SIFT BUTTON ── shown in entry stage only */}
      {stage === "entry" && (
        <div className="absolute bottom-4 right-5">
          <div className="rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm">
            Sift
          </div>
        </div>
      )}

      {/* ── SIFT LOADING ── replaces entry on sift press */}
      {sp2 > 0 && stage === "sift" && slot(
        <div className="w-full max-w-[46ch] rounded-2xl border border-border/40 bg-background/40 px-4 py-3 text-center">
          <span className="text-[12px] text-muted-foreground">Sifting…</span>
        </div>,
        Math.min(1, sp2 * 2),
        "50%"
      )}

      {/* ── MIRROR ── appears after sift, centered */}
      {sump > 0 && (stage === "summary" || stage === "followup" || stage === "response" || stage === "cards" || stage === "result") && slot(
        <div className="max-w-[44ch] rounded-2xl border border-border/50 bg-background/50 px-4 py-3 text-center text-[13.5px] leading-[1.6] text-foreground/85 backdrop-blur-sm">
          {MIRROR_TEXT}
        </div>,
        sump,
        "50%"
      )}

      {/* ── FOLLOW-UP ── replaces mirror */}
      {fop > 0 && (stage === "followup" || stage === "response" || stage === "cards" || stage === "result") && slot(
        <div className="max-w-[44ch] rounded-2xl border border-border/40 bg-muted/10 px-4 py-3 text-center text-[13px] leading-[1.55] text-muted-foreground/80 backdrop-blur-sm">
          {FOLLOWUP_TEXT}
        </div>,
        fop,
        "50%"
      )}

      {/* ── USER RESPONSE ── replaces follow-up, typewriter */}
      {rp > 0 && (stage === "response" || stage === "cards" || stage === "result") && slot(
        <div className="max-w-[44ch] rounded-2xl border border-primary/25 bg-primary/[0.05] px-4 py-3 text-center text-[13px] leading-[1.55] text-foreground/85 backdrop-blur-sm">
          {displayedResponse}
          {stage === "response" && (
            <span className="ml-[2px] inline-block h-[1em] w-[1.5px] -translate-y-px bg-foreground/40 align-middle" />
          )}
        </div>,
        rp,
        "50%"
      )}

      {/* ── CARDS ── full-card overlay with staggered cards */}
      {(stage === "cards" || stage === "result") && (
        <div
          className="absolute inset-4 flex flex-col items-center justify-center gap-2.5 transition-all duration-700"
          style={{
            opacity: cp,
            transform: `scale(${0.96 + cp * 0.04})`,
          }}
        >
          {SIGNAL_CARDS.map((card, i) => {
            const delay    = i * 100;
            const cardProg = Math.min(1, Math.max(0, (cp * TOTAL - delay) / 400));
            const stripe   = card.color === "primary"
              ? "border-primary/35 bg-primary/[0.05]"
              : card.color === "muted"
              ? "border-muted-foreground/20 bg-muted/15"
              : "border-border/35 bg-muted/8";
            return (
              <div
                key={card.id}
                className={`w-full max-w-[46ch] rounded-xl border px-4 py-2.5 backdrop-blur-sm ${stripe}`}
                style={{
                  opacity: cardProg,
                  transform: `translateY(${(1 - cardProg) * 6}px)`,
                  transitionDelay: `${delay}ms`,
                }}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <div className="flex gap-1">
                    {(["Matters", "Noise", "?"] as const).map((lbl) => (
                      <button
                        key={lbl}
                        className="rounded-full border px-2 py-1 text-[10px] font-medium cursor-pointer"
                        style={{
                          borderColor:
                            lbl === "Matters" ? "hsl(var(--primary) / 0.45)" :
                            lbl === "Noise"    ? "hsl(var(--muted-foreground) / 0.3)" :
                            "hsl(var(--border))",
                          color:
                            lbl === "Matters" ? "hsl(var(--primary))" :
                            lbl === "Noise"   ? "hsl(var(--muted-foreground))" :
                            "hsl(var(--muted-foreground))",
                          background:
                            lbl === "Matters" ? "hsl(var(--primary) / 0.07)" :
                            lbl === "Noise"   ? "hsl(var(--muted) / 0.15)" :
                            "hsl(var(--muted) / 0.08)",
                        }}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[12.5px] leading-snug text-foreground/80">{card.text}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── RESULT ── final composition */}
      {stage === "result" && (
        <div className="absolute inset-4 flex flex-col items-center justify-center gap-2.5">
          <div className="w-full max-w-[44ch] rounded-2xl border border-border/50 bg-background/40 px-4 py-3 backdrop-blur-sm">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-primary/70">What Sift heard</div>
            <p className="text-[13px] leading-[1.6] text-foreground/85">{MIRROR_TEXT}</p>
          </div>
          <div className="grid w-full max-w-[44ch] grid-cols-2 gap-2.5">
            <Bin label="Matters" tone="primary" items={RESULT_MATTERS} />
            <Bin label="Noise"   tone="muted"   items={RESULT_NOISE} />
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

// ─── Bins ────────────────────────────────────────────────────
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

// ─── Story panel ──────────────────────────────────────────────
function StoryPanel({ stage, reduced }: { stage: StageName; reduced: boolean }) {
  const idx = ALL_STAGES.indexOf(stage);
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

      {!reduced && (
        <div className="flex items-center gap-1.5">
          {ALL_STAGES.map((s, i) => (
            <span
              key={s}
              aria-hidden="true"
              className="h-[5px] rounded-full transition-all duration-300"
              style={{
                width: i === idx ? 20 : 5,
                background:
                  i === idx      ? "hsl(var(--primary))" :
                  i < idx        ? "hsl(var(--primary) / 0.4)" :
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