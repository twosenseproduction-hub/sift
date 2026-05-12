import { useEffect, useRef, useState } from "react";

// ─── Phases ─────────────────────────────────────────────────
type Phase = "entry" | "sift" | "result";
// entry  — paragraph + Sift button (mirrors the live composer)
// sift   — the quick scan: lines appear, get tapped Matters/Noise/?
//          one by one. This mirrors the live fragment-sort gate
//          (sift-ui.tsx — "Quick scan — tap what each line feels
//          like."), so a visitor who watches the demo and then tries
//          the product encounters the same shape, not a different
//          one. Auto-classification is the only honest concession to
//          a non-interactive demo.
// result — settled composition: what Sift heard + bins + next step

const PHASES: Phase[] = ["entry", "sift", "result"];

// ─── Timing ────────────────────────────────────────────────
// Tighter than the prior version. Entry holds long enough to read
// the paragraph; the sift phase plays through four lines + final
// classifications in ~5s; result lingers ~7s so the next step has
// time to be read. Total loop ≈ 16s, down from 19s — closer to the
// live flow's perceived pace.
const T = { entry: 0, sift: 3000, result: 8200 };
const TOTAL = 16000;

function currentPhase(elapsed: number): Phase {
  if (elapsed < T.sift)   return "entry";
  if (elapsed < T.result) return "sift";
  return "result";
}

function phaseProg(elapsed: number, start: number, end: number): number {
  return Math.min(1, Math.max(0, (elapsed - start) / (end - start)));
}

// ─── Content ───────────────────────────────────────────────
// Three starters mirror the three flavors Sift actually handles —
// emotional, operator, and relational. The hero lets the visitor pick
// which one to watch, so the demo feels chosen rather than broadcast.
// Each starter ships its own entry text, four signal/noise cards, the
// two bin summaries, and one next step. The visual choreography
// (entry → cards → result) stays identical across starters.

type SignalCard = {
  id: string;
  bucket: "matters" | "noise";
  label: "Matters" | "Noise";
  dot: "primary" | "muted";
  text: string;
};

type Starter = {
  id: string;
  // Short label shown on the selector pill.
  tag: string;
  // What the entry-phase paragraph reads. Should sound like real input
  // someone might bring, not a tagline.
  entry: string;
  cards: SignalCard[];
  bins: { matters: string[]; noise: string[] };
  nextStep: string;
};

const STARTERS: Starter[] = [
  {
    id: "emotional",
    tag: "Emotional clutter",
    entry:
      "I keep telling myself I'm going to do it, but every time I sit down to work I end up doing something else — scrolling, cleaning, something. Then I feel worse.",
    cards: [
      {
        id: "e1",
        bucket: "matters",
        label: "Matters",
        dot: "primary",
        text: "The fear of not being good enough is the real thing underneath.",
      },
      {
        id: "e2",
        bucket: "matters",
        label: "Matters",
        dot: "primary",
        text: "You already know what you need to do — you just need permission to do it imperfectly.",
      },
      {
        id: "e3",
        bucket: "noise",
        label: "Noise",
        dot: "muted",
        text: "The comparison to how fast you think others move.",
      },
      {
        id: "e4",
        bucket: "noise",
        label: "Noise",
        dot: "muted",
        text: "The story that trying and failing makes you inadequate.",
      },
    ],
    bins: {
      matters: [
        "The fear underneath the avoidance.",
        "What you already know you need to do.",
      ],
      noise: [
        "How fast others seem to move.",
        "The story that trying and failing makes you inadequate.",
      ],
    },
    nextStep:
      "Write one sentence about what you would do if you already believed you were good enough to try.",
  },
  {
    id: "operator",
    tag: "Project pressure",
    entry:
      "I'm trying to launch this thing, money is tight, and I keep bouncing between strategy, branding, and client work. Nothing is moving forward enough.",
    cards: [
      {
        id: "o1",
        bucket: "matters",
        label: "Matters",
        dot: "primary",
        text: "The launch decision has not been made, so every workstream is provisional.",
      },
      {
        id: "o2",
        bucket: "matters",
        label: "Matters",
        dot: "primary",
        text: "Client work pays the bills now but is not the load-bearing thread.",
      },
      {
        id: "o3",
        bucket: "noise",
        label: "Noise",
        dot: "muted",
        text: "Branding feels urgent but cannot resolve until the offer is named.",
      },
      {
        id: "o4",
        bucket: "noise",
        label: "Noise",
        dot: "muted",
        text: "The feeling of falling behind, separate from the sequencing problem.",
      },
    ],
    bins: {
      matters: [
        "The missing launch decision.",
        "Which work is load-bearing this week.",
      ],
      noise: [
        "Branding before the offer.",
        "The feeling of falling behind.",
      ],
    },
    nextStep:
      "Write the one sentence that defines what the launch is offering. Twenty minutes, no design work yet.",
  },
  {
    id: "relational",
    tag: "Hard conversation",
    entry:
      "I owe someone an honest conversation and I keep rehearsing it instead of having it. Every version I run in my head ends a different way.",
    cards: [
      {
        id: "r1",
        bucket: "matters",
        label: "Matters",
        dot: "primary",
        text: "The rehearsal is a way of staying in control of an outcome you can't control.",
      },
      {
        id: "r2",
        bucket: "matters",
        label: "Matters",
        dot: "primary",
        text: "The conversation is load-bearing — the avoidance keeps shaping everything else.",
      },
      {
        id: "r3",
        bucket: "noise",
        label: "Noise",
        dot: "muted",
        text: "Trying to script a version where no one feels anything difficult.",
      },
      {
        id: "r4",
        bucket: "noise",
        label: "Noise",
        dot: "muted",
        text: "Working out what they'll say before you've said your part.",
      },
    ],
    bins: {
      matters: [
        "The conversation is the move, not the rehearsal.",
        "What you actually need to say.",
      ],
      noise: [
        "Scripting their response.",
        "Solving it before it happens.",
      ],
    },
    nextStep:
      "Send a short message that names the topic and proposes a time. Nothing about the content yet.",
  },
];

const DEFAULT_STARTER_ID = STARTERS[0].id;

// ─── Story captions ─────────────────────────────────────────
// Eyebrows mirror language the live product uses on the same surface.
// "Quick scan" matches the live fragment-sort header copy in
// sift-ui.tsx so the demo and the product describe themselves with
// the same words.
const STORY: Record<Phase, { eyebrow: string; line: string }> = {
  entry: {
    eyebrow: "The entry",
    line: "You bring what you're holding — messy, honest, unfinished.",
  },
  sift: {
    eyebrow: "Quick scan",
    line: "Each line gets a quick read — what matters, what's noise, what you're not sure about. You can override any of it.",
  },
  result: {
    eyebrow: "The shape",
    line: "Not a list. Not advice. Just a cleaner read on what's actually going on, and one small next step.",
  },
};

// ─── Main component ─────────────────────────────────────────
//
// Props:
//   compact     — narrower layout for hero placement; collapses to a
//                 single column under md and reduces the side panel.
//   showSelector — render the three-starter pill row above the demo so
//                 visitors can pick which flavor of input to watch.
export function EngineDemo({
  compact = false,
  showSelector = false,
}: {
  compact?: boolean;
  showSelector?: boolean;
} = {}) {
  const ref    = useRef<HTMLDivElement>(null);
  const raf    = useRef<number>(0);
  const startR = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [inView, setInView]   = useState(false);
  const [reduced, setReduced] = useState(false);
  const [starterId, setStarterId] = useState<string>(DEFAULT_STARTER_ID);

  const starter =
    STARTERS.find((s) => s.id === starterId) ?? STARTERS[0];

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

  // Restart the phase clock when the starter switches so the new
  // content always plays through entry → cards → result in order.
  useEffect(() => {
    startR.current = null;
    setElapsed(0);
  }, [starterId]);

  const phase: Phase = reduced ? "result" : currentPhase(elapsed);
  const ep = phaseProg(elapsed, T.entry, T.sift);
  const cp = phaseProg(elapsed, T.sift, T.result);
  const rp = phaseProg(elapsed, T.result, TOTAL);

  const gridClass = compact
    ? "grid items-stretch gap-5"
    : "grid items-stretch gap-8 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]";

  return (
    <div ref={ref}>
      {showSelector ? (
        <StarterSelector
          starters={STARTERS}
          activeId={starterId}
          onPick={setStarterId}
        />
      ) : null}
      <div className={gridClass}>
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 shadow-[var(--shadow-md)] backdrop-blur-md">
          <Card
            phase={phase}
            ep={ep}
            cp={cp}
            rp={rp}
            reduced={reduced}
            starter={starter}
          />
        </div>
        {compact ? null : (
          <StoryPanel phase={phase} reduced={reduced} />
        )}
      </div>
    </div>
  );
}

// ─── Starter selector ──────────────────────────────────────
// Three pills above the demo. Tapping one switches the content; the
// active pill fills with primary. Keeps the surface honest as a demo —
// no live engine call, just a chosen example.
function StarterSelector({
  starters,
  activeId,
  onPick,
}: {
  starters: Starter[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Choose an example to watch"
      className="mb-5 flex flex-wrap gap-2"
      data-testid="engine-demo-starter-selector"
    >
      {starters.map((s) => {
        const isActive = s.id === activeId;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={`engine-demo-starter-${s.id}`}
            onClick={() => onPick(s.id)}
            className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] transition-colors ${
              isActive
                ? "border-primary/45 bg-primary/[0.08] text-primary"
                : "border-border/60 bg-card/60 text-muted-foreground/80 hover:text-foreground"
            }`}
          >
            {s.tag}
          </button>
        );
      })}
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────
function Card({
  phase, ep, cp, rp, reduced, starter,
}: {
  phase: Phase; ep: number; cp: number; rp: number; reduced: boolean;
  starter: Starter;
}) {
  // The card needs a minimum height so its absolutely-positioned phases
  // do not collapse the parent. Tuned for the longest content (cards
  // phase under the relational starter).
  const H = 520;
  void H;

  // ── ENTRY ──────────────────────────────────────────────
  if (phase === "entry") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5">
        <div
          className="mb-6 w-full max-w-[46ch] rounded-2xl border border-border/40 bg-background/60 px-4 py-3"
          style={{ opacity: reduced ? 1 : ep, transition: "opacity 600ms ease-out" }}
        >
          <p className="text-[13px] leading-[1.6] text-foreground/70">
            {starter.entry}
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

  // ── SIFT (quick scan) ──────────────────────────────────
  // Visual parity with the live fragment-sort surface in
  // sift-ui.tsx: a short header, then each line followed by three
  // tappable labels (Matters / Noise / Not sure). The label that
  // would be picked animates in as an underline rather than a pill
  // press, since text-button-with-underline is exactly the live
  // selection state. Lines and their picks stagger in one after the
  // other so the surface reads as a deliberate scan, not a flash of
  // cards.
  if (phase === "sift") {
    const lineDur   = 360; // fade-in per fragment
    const pickDelay = 220; // gap before the auto-pick underlines
    const phaseMs   = T.result - T.sift;

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5">
        {/* Header — same words the live product uses. */}
        <p className="mb-3 w-full max-w-[46ch] text-[12px] leading-snug text-muted-foreground">
          Quick scan — tap what each line feels like.
        </p>
        {starter.cards.map((card, i) => {
          const lineOffset = i * 220;
          const lineProg   = reduced
            ? 1
            : Math.min(1, Math.max(0, (cp * phaseMs - lineOffset) / lineDur));
          const pickProg   = reduced
            ? 1
            : Math.min(
                1,
                Math.max(0, (cp * phaseMs - lineOffset - pickDelay) / 300),
              );

          // Map the card's bucket onto the live label set.
          const pickedLabel: "Matters" | "Noise" | "Not sure" =
            card.bucket === "matters" ? "Matters" : "Noise";

          return (
            <div
              key={card.id}
              className="mb-3 w-full max-w-[46ch] space-y-1.5"
              style={{
                opacity: lineProg,
                transform: `translateY(${(1 - lineProg) * 6}px)`,
                transition: `opacity ${lineDur}ms ease-out, transform ${lineDur}ms ease-out`,
              }}
            >
              {/* Fragment text */}
              <p className="text-[12.5px] leading-snug text-foreground/85">
                {card.text}
              </p>
              {/* Tappable labels — picked one underlines with primary,
                  matching the live picked state. */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                {(["Matters", "Noise", "Not sure"] as const).map((lbl) => {
                  const isPicked = lbl === pickedLabel;
                  return (
                    <span
                      key={lbl}
                      className={
                        isPicked
                          ? "text-foreground"
                          : "text-muted-foreground/70"
                      }
                      style={
                        isPicked
                          ? {
                              textDecoration: "underline",
                              textDecorationColor: `hsl(var(--primary) / ${pickProg * 0.7})`,
                              textDecorationThickness: "1.5px",
                              textUnderlineOffset: "4px",
                              opacity: 0.6 + pickProg * 0.4,
                              transition: "opacity 300ms ease-out",
                            }
                          : undefined
                      }
                    >
                      {lbl}
                    </span>
                  );
                })}
              </div>
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
          {starter.cards[0].text}
        </p>
      </div>

      {/* Bins */}
      <div className="grid w-full max-w-[44ch] grid-cols-2 gap-2.5">
        <ResultBin label="Matters" tone="primary" items={starter.bins.matters} />
        <ResultBin label="Noise"   tone="muted"   items={starter.bins.noise} />
      </div>

      {/* One next step */}
      <div className="w-full max-w-[44ch] rounded-xl border border-primary/25 bg-primary/[0.05] px-4 py-2.5">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-primary/70">
          One next step
        </div>
        <p className="text-[12.5px] leading-snug text-foreground/90">
          {starter.nextStep}
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
