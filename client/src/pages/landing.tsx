import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand";
import { useTheme } from "@/lib/theme";
import { EngineDemo } from "@/components/engine-demo";

// The landing page is the marketing surface that lives at the apex.
// It's modeled directly on the Sift deck — same sections, same copy,
// same visual language — but rebuilt natively in React + Tailwind so
// it shares the app's design system (Instrument Serif + DM Sans, the
// warm cream and deep teal palette, the same dark mode tokens).
//
// CTA target is host-aware: on the marketing domain (siftnow.io /
// www.siftnow.io) it cross-links to the app subdomain; on the app
// host or anywhere else (localhost, *.fly.dev, preview environments)
// it stays on the current host so previews don't bounce people away.
function getAppHref() {
  if (typeof window === "undefined") return "/";
  const h = window.location.hostname;
  if (h === "siftnow.io" || h === "www.siftnow.io") {
    return "https://app.siftnow.io/";
  }
  return "/";
}

// Reveal-on-scroll: a small wrapper that fades + slides in once the
// element enters the viewport. Once revealed it stays revealed.
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ease-out ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// A floating gradient blob — used inside the per-section gradient mesh.
// The slow drift is what gives each section its "atmosphere" without
// any imagery.
function Blob({
  className,
  duration = 14,
}: {
  className: string;
  duration?: number;
}) {
  return (
    <div
      className={`${className} absolute rounded-full blur-[70px]`}
      style={{
        animation: `float ${duration}s ease-in-out infinite`,
      }}
    />
  );
}

// Section wrapper: full-height, vignette overlay, content centered. The
// vignette is what makes the page feel composed of distinct rooms
// rather than one continuous scroll.
function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`relative flex min-h-[100svh] items-center justify-center overflow-clip py-[clamp(88px,10vw,124px)] ${className}`}
    >
      {children}
    </section>
  );
}

// Container for section content — sits above the vignette and gradient
// mesh, capped to a comfortable reading width.
function Content({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative z-[2] w-[min(1160px,calc(100vw-32px))] p-[clamp(1.5rem,4vw,4rem)] ${className}`}
    >
      {children}
    </div>
  );
}

// Pill — the small bordered tags used in the hero and the rotating
// example surface. Uses the primary teal as the bordered tint.
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/15 bg-primary/[0.06] px-4 py-2 text-sm text-primary">
      {children}
    </span>
  );
}

// HeroDemo — a self-running, four-stage loop that mirrors the actual
// app's flow (compose → analyze → result → reset). The text in the
// composer types itself out, the Sift button "presses" itself, a
// thinking pause, then the result panel slides in with the same
// Matters / Noise / next-step format the real app produces. Then it
// fades back to the composer and starts again.
//
// This is intentionally not wired to /api/sift — the marketing host
// is anonymous and the goal is honest demonstration, not a back-door
// to the product. The example is fixed and credible.
function HeroDemo() {
  type Stage = "typing" | "thinking" | "result" | "hold";
  const [stage, setStage] = useState<Stage>("typing");
  const [typed, setTyped] = useState("");

  const FULL_TEXT =
    "There is so much I should be doing — replying, planning, fixing — and I keep stalling. I do not know if I am tired or avoiding something.";
  const MIRROR =
    "What you are holding is not laziness. It is a stack of half\u2011started things and a quiet question underneath.";
  const MATTERS = [
    "The thing you keep almost\u2011starting is the one you actually care about.",
    "You are tired in a way rest alone does not fix.",
  ];
  const NOISE = [
    "The full inbox.",
    "The shape of the to\u2011do list.",
    "The story that you are behind.",
  ];
  const NEXT_STEP =
    "Pick the one item that scares you a little and write the first sentence — nothing more.";

  // Run the timeline. Each stage transitions to the next via setTimeout
  // so we do not need to coordinate animations and clocks.
  useEffect(() => {
    let cancelled = false;
    let timers: number[] = [];
    const t = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => !cancelled && fn(), ms);
      timers.push(id);
    };

    if (stage === "typing") {
      setTyped("");
      // 28ms per char → about 4.5s for the whole sentence
      let i = 0;
      const tick = () => {
        if (cancelled) return;
        i += 1;
        setTyped(FULL_TEXT.slice(0, i));
        if (i < FULL_TEXT.length) {
          const id = window.setTimeout(tick, 28);
          timers.push(id);
        } else {
          // pause briefly with the full text visible, then "press Sift"
          t(900, () => setStage("thinking"));
        }
      };
      const id = window.setTimeout(tick, 600); // small initial pause
      timers.push(id);
    } else if (stage === "thinking") {
      t(1500, () => setStage("result"));
    } else if (stage === "result") {
      t(7500, () => setStage("hold"));
    } else if (stage === "hold") {
      t(900, () => setStage("typing"));
    }

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [stage]);

  const showResult = stage === "result";
  const composerActive = stage === "typing" || stage === "thinking";

  return (
    <div
      className="relative w-full"
      aria-label="A short example of what Sift does"
      data-testid="hero-demo"
      // The wrapper holds two absolutely-stacked cards. Min-height keeps
      // the taller of the two (the result) inside its bounds at every
      // breakpoint, so neither card spills past the hero.
      style={{ minHeight: "clamp(440px, 56vh, 540px)" }}
    >
      {/* The composer card. Absolute so it can cross‑fade with the
          result without one pushing the other around. */}
      <div
        className={`absolute inset-0 rounded-3xl border border-border/60 bg-card/80 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.18)] backdrop-blur-md transition-opacity duration-700 ${
          composerActive ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Clarity over comfort
        </p>
        <h3 className="m-0 mb-4 font-serif text-3xl leading-tight tracking-tight">
          What are you holding <em className="font-serif italic">right now?</em>
        </h3>
        <div className="min-h-[120px] rounded-xl border border-border/40 bg-background/60 p-4">
          <p className="m-0 text-[15px] leading-[1.7] text-foreground/90">
            {typed}
            {composerActive && (
              <span
                className="ml-[2px] inline-block h-[1.05em] w-[2px] -translate-y-[2px] bg-foreground/60 align-middle"
                style={{ animation: "blink 1s step-end infinite" }}
              />
            )}
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {stage === "thinking" ? "Sifting\u2026" : "Messy is fine."}
          </span>
          <span
            className={`inline-flex h-9 items-center justify-center rounded-full px-4 text-xs font-semibold transition-all ${
              stage === "thinking"
                ? "bg-primary text-primary-foreground scale-95"
                : "bg-primary/90 text-primary-foreground"
            }`}
          >
            Sift
          </span>
        </div>
      </div>

      {/* The result card, absolutely positioned so it can cross‑fade with
          the composer. Same surface, same border, different content. */}
      <div
        className={`absolute inset-0 rounded-3xl border border-border/60 bg-card/85 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.20)] backdrop-blur-md transition-all duration-700 ${
          showResult
            ? "opacity-100 translate-y-0"
            : "pointer-events-none opacity-0 translate-y-3"
        }`}
      >
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          What Sift heard
        </p>
        <p className="m-0 mb-5 text-[15px] leading-[1.7] text-foreground/90">
          {MIRROR}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-[0.18em] text-primary/70">
              Matters
            </p>
            <ul className="m-0 space-y-1.5 p-0">
              {MATTERS.map((m, i) => (
                <li
                  key={`mat-${i}`}
                  className="flex gap-2 text-[13px] leading-snug text-foreground/90"
                >
                  <span className="mt-[0.4em] text-primary/60">·</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
              Noise
            </p>
            <ul className="m-0 space-y-1.5 p-0">
              {NOISE.map((n, i) => (
                <li
                  key={`noi-${i}`}
                  className="flex gap-2 text-[13px] leading-snug text-muted-foreground"
                >
                  <span className="mt-[0.4em] text-muted-foreground/50">·</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.22em] text-primary/70">
            One next step
          </p>
          <p className="m-0 text-[14px] leading-snug text-foreground/95">
            {NEXT_STEP}
          </p>
        </div>
      </div>
    </div>
  );
}

// FaqItem — single accordion row. Native <details> so it works without
// JS state, keyboard, or screen‑reader gymnastics. The chevron rotates
// via [open] attribute selector.
function FaqItem({
  q,
  children,
}: {
  q: string;
  children: React.ReactNode;
}) {
  return (
    <details
      className="group border-b border-border/60 py-5"
      data-testid={`faq-item-${q.slice(0, 24).toLowerCase().replace(/\s+/g, "-")}`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left">
        <span className="font-serif text-[clamp(1.15rem,1.6vw,1.4rem)] leading-snug text-foreground">
          {q}
        </span>
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-transform group-open:rotate-45"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 1.5v9M1.5 6h9"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </summary>
      <div className="mt-3 max-w-[60ch] text-[15px] leading-[1.7] text-muted-foreground">
        {children}
      </div>
    </details>
  );
}

// Sticky glass header — adds a faint border once the user scrolls past
// the top. Theme toggle and CTA on the right.
function LandingHeader() {
  const { theme, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    document.addEventListener("scroll", onScroll, { passive: true });
    return () => document.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={`sticky top-0 z-[100] backdrop-blur-md transition-colors ${
        scrolled ? "border-b border-border/60" : "border-b border-transparent"
      }`}
      style={{
        background: "color-mix(in srgb, hsl(var(--background)) 76%, transparent)",
      }}
      data-testid="landing-header"
    >
      <div className="mx-auto flex min-h-[76px] w-[min(1180px,calc(100vw-24px))] items-center justify-between gap-4">
        <a
          href="#top"
          className="inline-flex items-center gap-3"
          aria-label="Sift home"
          data-testid="link-landing-brand"
        >
          <Logo size={32} />
        </a>
        <nav
          className="hidden gap-5 text-sm text-muted-foreground md:flex"
          aria-label="Primary navigation"
        >
          <a
            href="#what"
            className="transition-colors hover:text-foreground"
            data-testid="link-nav-what"
          >
            What it is for
          </a>
          <a
            href="#how"
            className="transition-colors hover:text-foreground"
            data-testid="link-nav-how"
          >
            How it works
          </a>
          <a
            href="#engine"
            className="transition-colors hover:text-foreground"
            data-testid="link-nav-engine"
          >
            The engine
          </a>
          <a
            href="#clarity"
            className="transition-colors hover:text-foreground"
            data-testid="link-nav-clarity"
          >
            Clarity
          </a>
          <a
            href="#use-cases"
            className="transition-colors hover:text-foreground"
            data-testid="link-nav-cases"
          >
            Use cases
          </a>
          <a
            href="/#/pricing"
            className="transition-colors hover:text-foreground"
            data-testid="link-nav-pricing"
          >
            Pricing
          </a>
          <a
            href="#faq"
            className="transition-colors hover:text-foreground"
            data-testid="link-nav-faq"
          >
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            data-testid="button-theme"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-card/70 backdrop-blur-md transition-transform hover:-translate-y-px"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          <a
            href={getAppHref()}
            className="hidden h-11 items-center justify-center rounded-full border border-border/60 bg-card/70 px-5 text-sm font-semibold backdrop-blur-md transition-transform hover:-translate-y-px md:inline-flex"
            data-testid="link-header-cta"
          >
            Start with Sift
          </a>
        </div>
      </div>
    </header>
  );
}

// Mini composer mock used in the "actual experience" section. This is
// a static facsimile of the real composer — same hero question, same
// helper line, same warm cream framing — but it's not interactive.
// ComposerMock — the composer surface that sits beside the
// "clear surface" copy. It slowly types one honest line, holds it,
// then quietly clears and starts again. Different example from the
// hero so the page does not feel repetitive on second look. Uses an
// IntersectionObserver to delay the typing until the section is in
// view, so the visitor catches the start of the line, not the end.
function ComposerMock() {
  const FULL =
    "I keep saying yes to things I do not actually want to do, and I cannot tell if it is generosity or fear.";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [typed, setTyped] = useState("");
  const [seen, setSeen] = useState(false);

  // Trigger once when the composer enters the viewport.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setSeen(true);
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  // Loop: type → hold → clear → type again. Slower than the hero
  // (40ms/char) so this section feels patient, not performing.
  useEffect(() => {
    if (!seen) return;
    let cancelled = false;
    const timers: number[] = [];
    const t = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => !cancelled && fn(), ms);
      timers.push(id);
    };
    const run = () => {
      setTyped("");
      let i = 0;
      const tick = () => {
        if (cancelled) return;
        i += 1;
        setTyped(FULL.slice(0, i));
        if (i < FULL.length) {
          const id = window.setTimeout(tick, 40);
          timers.push(id);
        } else {
          // Hold the full line for a beat, then clear and restart.
          t(6000, () => {
            setTyped("");
            t(1200, run);
          });
        }
      };
      t(900, tick);
    };
    run();
    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [seen]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-[34px] bg-card shadow-[0_24px_50px_hsl(var(--foreground)/0.08)]"
      data-testid="mock-composer"
    >
      <div className="px-8 pb-4 pt-8">
        <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.25em] text-primary/80">
          Clarity over comfort
        </div>
        <h3 className="m-0 max-w-[10ch] font-serif text-[clamp(2rem,3.5vw,3.2rem)] leading-[1.02] tracking-tight">
          What are you holding{" "}
          <span className="italic text-primary">right now?</span>
        </h3>
      </div>
      <div className="px-8 pb-7">
        <div className="flex min-h-[176px] flex-col justify-between border-t border-border/60 pt-4">
          <div className="text-base leading-[1.7] text-foreground/85">
            {typed}
            {seen && (
              <span
                className="ml-[2px] inline-block h-[1.05em] w-[2px] -translate-y-[2px] bg-foreground/55 align-middle"
                style={{ animation: "blink 1s step-end infinite" }}
              />
            )}
            {!seen && (
              <span className="text-muted-foreground/90">
                What's on your mind?
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <span className="text-sm text-muted-foreground/70">
              Messy is fine.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// The rotating example in the "Clarity" section. Cycles through four
// real-world scenarios — each from a different domain (emotional,
// project work, relational, decision pressure) — to show the breadth
// of what Sift handles. The rotation is now visible: a pill row at
// the top shows all tags with the current one highlighted, and the
// content crossfades between scenarios with a brief typing reveal
// on the input field so the change reads as deliberate, not a glitch.
const EXAMPLES = [
  {
    tag: "Emotional clarity",
    input:
      "I cannot tell whether I am sad about what happened, or just attached to replaying it.",
    signal:
      "The real pain is not the conversation itself. It is what it touched underneath.",
    noise:
      "The compulsion to replay every detail until it finally feels solved.",
    step: "Name what hurts more honestly than the story you have been repeating.",
  },
  {
    tag: "Project pressure",
    input:
      "I have to start a project soon and the deadline is overwhelming, so I keep avoiding it and pretending I need a better plan first.",
    signal:
      "The main problem is not lack of ability. It is that the size of the whole project is collapsing onto the first move.",
    noise:
      "Treating the opening step like it has to solve the entire project at once.",
    step: "Write the smallest visible starting brief: objective, audience, and the first task you can finish in 25 minutes.",
  },
  {
    tag: "Hard conversation",
    input:
      "I owe someone an honest conversation and I keep rehearsing it instead of having it.",
    signal:
      "The rehearsal is not preparation. It is a way of staying in control of an outcome you cannot control.",
    noise:
      "Trying to script a version of the talk where no one feels anything difficult.",
    step: "Send a short message that names the topic and proposes a time — nothing about the content yet.",
  },
  {
    tag: "Decision overload",
    input:
      "I have too many good options and I keep researching instead of choosing one path for this month.",
    signal:
      "You do not need the perfect option yet. You need a temporary constraint that lets momentum return.",
    noise:
      "Assuming one choice has to answer the whole future before you can begin.",
    step: "Pick one option to test for the next two weeks and decide what result would make it worth continuing.",
  },
];

function ExampleRotator() {
  const [idx, setIdx] = useState(0);
  // Track whether we are mid-transition so we can fade out, swap, fade in.
  const [phase, setPhase] = useState<"in" | "out">("in");
  // Type the input field on each switch so the change is legible.
  const [typed, setTyped] = useState(EXAMPLES[0].input);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);

  // Only run the rotation while the section is on screen — avoids
  // burning CPU when the visitor has scrolled away.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setActive(e.isIntersecting);
      },
      { threshold: 0.25 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  // Drive the rotation. Each cycle: hold (~7s) → fade out (450ms) →
  // advance index. Typing for the new input lives in its own effect
  // below — that way advancing the index cleans up only the rotation
  // timer, never the in-flight typing for the new scenario.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timers: number[] = [];
    const t = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => !cancelled && fn(), ms);
      timers.push(id);
    };
    t(7000, () => {
      setPhase("out");
      t(450, () => {
        setIdx((prev) => (prev + 1) % EXAMPLES.length);
        setPhase("in");
      });
    });
    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [idx, active]);

  // Type the input field whenever the active scenario changes. Owned
  // by its own effect so a rotation tick advancing `idx` does not
  // cancel the typing chain mid-character.
  useEffect(() => {
    const fullInput = EXAMPLES[idx].input;
    // First scenario shows fully typed on mount; subsequent ones
    // animate. Detect by whether `typed` already matches.
    if (typed === fullInput) return;
    let cancelled = false;
    const timers: number[] = [];
    setTyped("");
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      i += 1;
      setTyped(fullInput.slice(0, i));
      if (i < fullInput.length) {
        const id = window.setTimeout(tick, 22);
        timers.push(id);
      }
    };
    const startId = window.setTimeout(tick, 120);
    timers.push(startId);
    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const ex = EXAMPLES[idx];
  const fadeClass =
    phase === "in"
      ? "opacity-100 translate-y-0"
      : "opacity-0 -translate-y-1";

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-[28px] border border-border/60 bg-card/70 shadow-[var(--shadow-lg)]"
      data-testid="mock-example"
    >
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 text-[12px] uppercase tracking-[0.18em] text-muted-foreground/80">
        <div className="flex gap-2" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        </div>
        <span>Sift examples</span>
      </div>
      {/* Tag rail — every scenario is visible at once so the rotation
          is legible. The active one fills with primary; the others sit
          quiet. Tapping is intentionally not wired — keeps the demo
          honest as a demo, not a half-built control. */}
      <div
        role="tablist"
        aria-label="Example scenarios"
        className="flex flex-wrap gap-2 border-b border-border/60 px-5 py-4"
      >
        {EXAMPLES.map((e, i) => {
          const isActive = i === idx;
          return (
            <span
              key={e.tag}
              role="tab"
              aria-selected={isActive}
              data-testid={`example-tag-${i}`}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors duration-500 ${
                isActive
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 bg-transparent text-muted-foreground/70"
              }`}
            >
              {e.tag}
            </span>
          );
        })}
      </div>
      <div
        className={`grid gap-3.5 p-5 transition-all duration-500 ease-out ${fadeClass}`}
      >
        <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Input
          </div>
          <div className="min-h-[3.5rem] leading-7 text-foreground/80">
            {typed}
            {phase === "in" && typed.length < ex.input.length && (
              <span
                className="ml-[2px] inline-block h-[1.05em] w-[2px] -translate-y-[2px] bg-foreground/55 align-middle"
                style={{ animation: "blink 1s step-end infinite" }}
              />
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-l-[3px] border-border/60 border-l-primary/55 bg-muted/40 p-4">
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Signal
          </div>
          <div className="leading-7 text-foreground/80">{ex.signal}</div>
        </div>
        <div className="rounded-2xl border border-l-[3px] border-border/60 border-l-muted-foreground/30 bg-muted/40 p-4">
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Noise
          </div>
          <div className="leading-7 text-foreground/80">{ex.noise}</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Next step
          </div>
          <div className="leading-7 text-foreground/80">{ex.step}</div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  // Smooth-scroll for in-page anchor links. Wouter's hash routing
  // intercepts hash navigation, so we manually handle anchors that
  // start with "#" and target a section on this page.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (href.length < 2) return;
      const id = href.slice(1);
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Float keyframes + subtle grain — scoped to this page. */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -35px) scale(1.08); }
          66% { transform: translate(-35px, 30px) scale(0.94); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
      {/* Faint grain overlay across the whole page — adds tactile
          warmth without competing with content. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.18] mix-blend-multiply dark:opacity-[0.10] dark:mix-blend-screen"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
          backgroundSize: "220px 220px",
        }}
      />

      <LandingHeader />

      <main className="relative z-[1]">
        {/* Hero */}
        <Section id="top">
          <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
            <Blob
              className="bg-primary/[0.14]"
              duration={14}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
            >
              <div
                className="absolute h-[380px] w-[380px] rounded-full blur-[70px]"
                style={{
                  top: -80,
                  right: -70,
                  background: "hsl(var(--primary) / 0.14)",
                  animation: "float 14s ease-in-out infinite",
                }}
              />
              <div
                className="absolute h-[280px] w-[280px] rounded-full blur-[70px]"
                style={{
                  bottom: -60,
                  left: -40,
                  background: "hsl(36 35% 70% / 0.32)",
                  animation: "float 18s ease-in-out infinite",
                }}
              />
              <div
                className="absolute h-[200px] w-[200px] rounded-full blur-[70px]"
                style={{
                  top: "38%",
                  left: "18%",
                  background: "hsl(180 18% 50% / 0.14)",
                  animation: "float 22s ease-in-out infinite",
                }}
              />
            </div>
          </div>
          <Content>
            <div className="grid items-center gap-12 md:grid-cols-[1.05fr_1fr]">
              <Reveal>
                <div className="mb-6">
                  <Logo size={72} />
                </div>
                <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
                  A quiet tool for a noisy mind
                </p>
                <h1 className="m-0 mb-5 font-serif text-[clamp(2.6rem,5vw,4.6rem)] leading-[0.95] tracking-[-0.045em]">
                  Sift helps you tell
                  <br />
                  what matters from
                  <br />
                  what is only loud.
                </h1>
                <p className="max-w-[34rem] text-[clamp(1.05rem,1.4vw,1.25rem)] leading-[1.65] text-muted-foreground">
                  You speak or type what you are holding. Sift separates signal
                  from noise, returns the deeper pattern, and gives you one
                  next step you can actually take.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Pill>Quiet clarity</Pill>
                  <Pill>One next step</Pill>
                  <Pill>No clutter</Pill>
                </div>
                <div className="mt-9">
                  <a
                    href={getAppHref()}
                    className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:-translate-y-px"
                    data-testid="link-hero-cta"
                  >
                    Start with Sift
                  </a>
                </div>
              </Reveal>
              <Reveal delay={120}>
                <HeroDemo />
              </Reveal>
            </div>
          </Content>
        </Section>

        {/* The actual experience */}
        <Section id="experience">
          <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
            <div
              className="absolute h-[340px] w-[340px] rounded-full blur-[70px]"
              style={{
                top: -80,
                left: "4%",
                background: "hsl(36 35% 70% / 0.28)",
                animation: "float 16s ease-in-out infinite",
              }}
            />
            <div
              className="absolute h-[320px] w-[320px] rounded-full blur-[70px]"
              style={{
                bottom: -70,
                right: "3%",
                background: "hsl(var(--primary) / 0.10)",
                animation: "float 20s ease-in-out infinite",
              }}
            />
          </div>
          <Content>
            <div className="grid items-center gap-14 md:grid-cols-2">
              <div>
                <Reveal>
                  <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
                    The actual experience
                  </p>
                </Reveal>
                <Reveal delay={80}>
                  <h2 className="m-0 mb-5 max-w-[11ch] font-serif text-[clamp(2.7rem,5.2vw,5.4rem)] leading-[0.95] tracking-[-0.05em]">
                    Built to feel like a clear surface, not another app asking
                    things from you.
                  </h2>
                </Reveal>
                <Reveal delay={160}>
                  <p className="max-w-[33rem] text-[clamp(1rem,1.6vw,1.25rem)] leading-[1.7] text-muted-foreground">
                    The entry is quiet. The language is spare. The response is
                    structured enough to help, but restrained enough to feel
                    human.
                  </p>
                </Reveal>
              </div>
              <Reveal delay={120}>
                <ComposerMock />
              </Reveal>
            </div>
          </Content>
        </Section>

        {/* What Sift is for */}
        <Section id="what">
          <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
            <div
              className="absolute h-[320px] w-[320px] rounded-full blur-[70px]"
              style={{
                top: -70,
                right: -50,
                background: "hsl(var(--primary) / 0.08)",
                animation: "float 18s ease-in-out infinite",
              }}
            />
            <div
              className="absolute h-[260px] w-[260px] rounded-full blur-[70px]"
              style={{
                bottom: -60,
                left: 0,
                background: "hsl(36 35% 70% / 0.26)",
                animation: "float 14s ease-in-out infinite",
              }}
            />
          </div>
          <Content>
            <div className="grid gap-14 md:grid-cols-2">
              <div>
                <Reveal>
                  <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
                    What Sift is for
                  </p>
                </Reveal>
                <Reveal delay={80}>
                  <h2 className="m-0 mb-5 font-serif text-[clamp(2.2rem,4.2vw,4rem)] leading-[0.95] tracking-[-0.05em]">
                    Not every hard moment needs more content.
                  </h2>
                </Reveal>
                <Reveal delay={160}>
                  <p className="text-[clamp(1.05rem,1.8vw,1.5rem)] leading-[1.7] text-muted-foreground">
                    Sometimes you do not need a journal prompt, a productivity
                    system, or ten options. You need someone or something to
                    help you see the real knot, reduce the noise, and move one
                    inch forward.
                  </p>
                </Reveal>
              </div>
              <Reveal delay={120}>
                <div className="rounded-3xl border border-border/60 bg-card/70 p-8 shadow-[var(--shadow-md)] backdrop-blur-md">
                  <div className="grid gap-5">
                    <div className="rounded-2xl border border-border/60 bg-muted/40 p-5">
                      <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        When life feels like
                      </div>
                      <div className="leading-7 text-muted-foreground">
                        Too many open loops, too much pressure, too many
                        thoughts competing at once.
                      </div>
                    </div>
                    <div className="rounded-2xl border border-l-[3px] border-border/60 border-l-primary/55 bg-muted/40 p-5">
                      <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Sift gives you
                      </div>
                      <div className="leading-7 text-muted-foreground">
                        A calmer read on what is central, what is distortion,
                        and what to do next.
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-muted/40 p-5">
                      <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        The feeling after
                      </div>
                      <div className="leading-7 text-muted-foreground">
                        I understand what this actually is now.
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </Content>
        </Section>

        {/* How it works */}
        <Section id="how">
          <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
            <div
              className="absolute h-[320px] w-[320px] rounded-full blur-[70px]"
              style={{
                top: -60,
                left: "10%",
                background: "hsl(180 18% 50% / 0.12)",
                animation: "float 16s ease-in-out infinite",
              }}
            />
            <div
              className="absolute h-[260px] w-[260px] rounded-full blur-[70px]"
              style={{
                bottom: -40,
                right: "8%",
                background: "hsl(36 35% 70% / 0.24)",
                animation: "float 20s ease-in-out infinite",
              }}
            />
          </div>
          <Content className="text-center">
            <Reveal>
              <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
                How it works
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mx-auto m-0 mb-12 max-w-[22ch] font-serif text-[clamp(2.2rem,4.2vw,4rem)] leading-[0.95] tracking-[-0.05em]">
                Three quiet steps, end to end.
              </h2>
            </Reveal>
            <div className="mx-auto grid max-w-[1080px] gap-5 md:grid-cols-3">
              <Reveal delay={120}>
                <div className="h-full rounded-3xl border border-border/60 bg-card/70 p-7 text-left shadow-[var(--shadow-md)] backdrop-blur-md">
                  <div className="mb-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Step one
                  </div>
                  <h3 className="m-0 mb-3 font-serif text-2xl tracking-tight">
                    Bring what you are holding.
                  </h3>
                  <p className="m-0 leading-7 text-muted-foreground">
                    Speak it or type it. Messy is fine. You can paste something
                    old too — a journal page, a draft, a thought you wrote
                    before.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={200}>
                <div className="h-full rounded-3xl border border-border/60 bg-card/70 p-7 text-left shadow-[var(--shadow-md)] backdrop-blur-md">
                  <div className="mb-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Step two
                  </div>
                  <h3 className="m-0 mb-3 font-serif text-2xl tracking-tight">
                    Sift returns the shape.
                  </h3>
                  <p className="m-0 leading-7 text-muted-foreground">
                    What seems to matter most, what may only be loud, why this
                    could be the signal, and one next step you can take.
                    Structured enough to move, restrained enough to feel human.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={280}>
                <div className="h-full rounded-3xl border border-border/60 bg-card/70 p-7 text-left shadow-[var(--shadow-md)] backdrop-blur-md">
                  <div className="mb-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Step three
                  </div>
                  <h3 className="m-0 mb-3 font-serif text-2xl tracking-tight">
                    Stay with it, or close the loop.
                  </h3>
                  <p className="m-0 leading-7 text-muted-foreground">
                    Deepen the thread until the pattern is clear, or close it
                    when the shape lands. Sift remembers the throughline, not
                    the noise.
                  </p>
                </div>
              </Reveal>
            </div>
          </Content>
        </Section>

        {/* The engine — animated demo of how the sort actually happens */}
        <Section id="engine">
          <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
            <div
              className="absolute h-[340px] w-[340px] rounded-full blur-[80px]"
              style={{
                top: -80,
                right: "6%",
                background: "hsl(186 40% 38% / 0.14)",
                animation: "float 18s ease-in-out infinite",
              }}
            />
            <div
              className="absolute h-[280px] w-[280px] rounded-full blur-[80px]"
              style={{
                bottom: -50,
                left: "4%",
                background: "hsl(36 35% 70% / 0.22)",
                animation: "float 22s ease-in-out infinite",
              }}
            />
          </div>
          <Content>
            <Reveal>
              <p className="mb-4 text-center text-[12px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
                The engine
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mx-auto m-0 mb-4 max-w-[22ch] text-center font-serif text-[clamp(2.2rem,4.2vw,4rem)] leading-[0.95] tracking-[-0.05em]">
                How the sort happens.
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <p className="mx-auto mb-12 max-w-[58ch] text-center leading-7 text-muted-foreground">
                A messy paragraph goes in. Sift listens for the phrases that
                are actually there, separates what matters from what doesn’t,
                and hands back one small, doable thing.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <div className="mx-auto max-w-[1080px]">
                <EngineDemo />
              </div>
            </Reveal>
          </Content>
        </Section>

        {/* Clarity */}
        <Section id="clarity">
          <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
            <div
              className="absolute h-[360px] w-[360px] rounded-full blur-[70px]"
              style={{
                top: -90,
                right: -70,
                background: "hsl(var(--primary) / 0.12)",
                animation: "float 18s ease-in-out infinite",
              }}
            />
            <div
              className="absolute h-[240px] w-[240px] rounded-full blur-[70px]"
              style={{
                bottom: -30,
                left: -20,
                background: "hsl(36 35% 70% / 0.28)",
                animation: "float 14s ease-in-out infinite",
              }}
            />
          </div>
          <Content>
            <div className="grid gap-14 md:grid-cols-2">
              <Reveal>
                <ExampleRotator />
              </Reveal>
              <div>
                <Reveal>
                  <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
                    What the app returns
                  </p>
                </Reveal>
                <Reveal delay={80}>
                  <h2 className="m-0 mb-5 font-serif text-[clamp(2.2rem,4.2vw,4rem)] leading-[0.95] tracking-[-0.05em]">
                    Clarity without performance.
                  </h2>
                </Reveal>
                <Reveal delay={160}>
                  <p className="mb-4 text-[clamp(1.05rem,1.8vw,1.5rem)] leading-[1.7] text-muted-foreground">
                    The point is not to sound insightful. The point is to feel
                    the situation get cleaner. Sift can help with emotional
                    knots, practical pressure, creative stalls, and messy
                    decisions that need a clearer read.
                  </p>
                </Reveal>
                <Reveal delay={220}>
                  <p className="max-w-[38rem] text-base leading-7 text-muted-foreground">
                    That is why the interface stays visually light, why the
                    answer narrows instead of expanding, and why the example
                    over there rotates through different kinds of real-world
                    questions.
                  </p>
                </Reveal>
              </div>
            </div>
          </Content>
        </Section>

        {/* Use cases */}
        <Section id="use-cases">
          <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
            <div
              className="absolute h-[300px] w-[300px] rounded-full blur-[70px]"
              style={{
                top: -50,
                left: "4%",
                background: "hsl(180 18% 50% / 0.12)",
                animation: "float 16s ease-in-out infinite",
              }}
            />
            <div
              className="absolute h-[260px] w-[260px] rounded-full blur-[70px]"
              style={{
                bottom: -50,
                right: "3%",
                background: "hsl(36 35% 70% / 0.24)",
                animation: "float 20s ease-in-out infinite",
              }}
            />
          </div>
          <Content className="text-center">
            <Reveal>
              <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
                When it helps most
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mx-auto m-0 max-w-[22ch] font-serif text-[clamp(2.2rem,4vw,2.8rem)] leading-[1.05] tracking-[-0.03em]">
                For emotional clutter, hard decisions, and recurring loops.
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: "Relationship confusion",
                  body: "When mixed signals and old wounds blur what is actually true.",
                },
                {
                  title: "Inner conflict",
                  body: "When two motives are competing and you cannot tell which one is real.",
                },
                {
                  title: "Decision pressure",
                  body: "When too many options make it harder, not easier, to move.",
                },
                {
                  title: "Thought loops",
                  body: "When your mind keeps circling but insight is not increasing.",
                },
              ].map((c, i) => (
                <Reveal key={c.title} delay={120 + i * 80}>
                  <div className="h-full rounded-3xl border border-border/60 bg-card/70 p-6 text-left shadow-[var(--shadow-md)] backdrop-blur-md">
                    <h3 className="m-0 mb-2 font-serif text-xl tracking-tight">
                      {c.title}
                    </h3>
                    <p className="m-0 leading-7 text-muted-foreground">
                      {c.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Content>
        </Section>

        {/* Founder — a single human voice on the page. Sift is calm,
            but it is also made by someone, and saying so quietly here
            is part of the trust the rest of the page asks for. */}
        <Section id="founder">
          <Content>
            <div className="mx-auto grid max-w-[960px] items-center gap-10 md:grid-cols-[260px_1fr] md:gap-14">
              <Reveal>
                {/* Portrait. Soft warm frame, rounded but not a circle
                    so the photograph reads as a photograph and not a
                    profile chip. */}
                <div className="relative mx-auto w-full max-w-[260px] md:max-w-none">
                  <div
                    aria-hidden="true"
                    className="absolute -inset-3 rounded-[1.6rem] bg-primary/8 blur-2xl"
                  />
                  <img
                    src="/founder-alejandro.jpg"
                    alt="Alejandro Hernandez, the founder of Sift, smiling outdoors with greenery behind him."
                    className="relative w-full rounded-[1.4rem] border border-border/60 object-cover shadow-[0_24px_60px_-30px_rgba(0,0,0,0.30)]"
                    style={{ aspectRatio: "3 / 4" }}
                    data-testid="img-founder"
                    loading="lazy"
                  />
                </div>
              </Reveal>
              <Reveal delay={120}>
                <div>
                  <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
                    The person behind it
                  </p>
                  <h2 className="m-0 mb-4 font-serif text-[clamp(2rem,3.4vw,2.8rem)] leading-[1.05] tracking-[-0.03em]">
                    Alejandro Hernandez
                  </h2>
                  <p className="mb-6 text-[14px] uppercase tracking-[0.18em] text-muted-foreground">
                    Father · Husband · Poet · Multi‑media entrepreneur
                  </p>
                  <div className="space-y-4 text-[16px] leading-[1.7] text-foreground/85 md:text-[17px]">
                    <p>
                      I built Sift because my mind doesn’t get quiet on
                      its own. Between the work, the family, and the
                      next thing, I write to find what I actually feel
                      underneath all of it.
                    </p>
                    <p>
                      I needed a tool that would meet me in the mess
                      and help me hear myself again — not louder, just
                      clearer. So I made one.
                    </p>
                    <p className="text-muted-foreground">
                      If Sift is useful to you, that’s the whole point.
                      If something is missing, tell me. This is built
                      slowly, by hand, for the kind of mind I have.
                    </p>
                  </div>
                  <p
                    className="mt-7 font-serif text-[18px] italic tracking-[-0.01em] text-foreground/70"
                    data-testid="text-founder-signature"
                  >
                    — Alejandro
                  </p>
                </div>
              </Reveal>
            </div>
          </Content>
        </Section>

        {/* FAQ */}
        <Section id="faq">
          <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
            <div
              className="absolute h-[300px] w-[300px] rounded-full blur-[70px]"
              style={{
                top: -60,
                right: "6%",
                background: "hsl(36 35% 70% / 0.22)",
                animation: "float 18s ease-in-out infinite",
              }}
            />
          </div>
          <Content>
            <div className="grid gap-12 md:grid-cols-[0.85fr_1.15fr]">
              <div>
                <Reveal>
                  <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
                    Questions
                  </p>
                </Reveal>
                <Reveal delay={80}>
                  <h2 className="m-0 mb-5 max-w-[14ch] font-serif text-[clamp(2.2rem,4vw,3.4rem)] leading-[1.02] tracking-[-0.04em]">
                    What people want to know before they start.
                  </h2>
                </Reveal>
                <Reveal delay={140}>
                  <p className="max-w-[28rem] text-[15px] leading-[1.7] text-muted-foreground">
                    Honest answers, not marketing. If something is missing, we
                    will say so.
                  </p>
                </Reveal>
              </div>
              <Reveal delay={120}>
                <div className="rounded-3xl border border-border/60 bg-card/70 px-6 py-1 shadow-[var(--shadow-md)] backdrop-blur-md">
                  <FaqItem q="Is what I write private?">
                    Yes. Your entries are stored against your account and are
                    not shared, sold, or used to train models. We are a small
                    team and we read aggregate signals to improve Sift, never
                    individual entries unless you explicitly send us one.
                  </FaqItem>
                  <FaqItem q="Does Sift use AI? Which model?">
                    Yes. Sift uses large language models from a major provider
                    to do the actual sifting — separating what matters from
                    noise, naming the deeper pattern. The prompt and the
                    structure around it are ours; the reasoning engine is not.
                  </FaqItem>
                  <FaqItem q="What does Sift do with sad or dark thoughts?">
                    Sift is not a crisis tool. If what you write suggests harm
                    to yourself or someone else, Sift stops the normal flow
                    and surfaces real resources — a hotline, a text line, a
                    plain note that talking to a person is the right next
                    step. It will not try to be your therapist.
                  </FaqItem>
                  <FaqItem q="Can I delete what I have written?">
                    Yes. Any entry can be deleted from your history, and
                    deleting your account removes your data from our systems.
                    There is no public profile, no shared feed, no archive
                    you cannot reach.
                  </FaqItem>
                  <FaqItem q="Does Sift store everything I write?">
                    Sift stores your entries so you can return to them and so
                    the next conversation can build on the last one. Storage
                    is encrypted at rest. You can delete entries one by one
                    or wipe the account.
                  </FaqItem>
                  <FaqItem q="What is Sift not?">
                    Sift is not a journal, not a chatbot, not therapy, not a
                    productivity app. It does not give advice, it does not
                    keep score, and it will not try to keep you on the page.
                    The goal is to send you back to your life with one
                    clearer thought.
                  </FaqItem>
                  <FaqItem q="Is it free?">
                    There is a free tier forever — three sifts a month,
                    full history, every feature. Plus is six dollars a
                    month or forty‑eight a year for unlimited sifts. If
                    you are using Sift before Plus launches, you get six
                    months of Plus free as a thank you. Pricing details
                    on the <a href="/#/pricing" className="underline decoration-primary/40 underline-offset-4 transition-colors hover:text-foreground">pricing page</a>.
                  </FaqItem>
                  <FaqItem q={`What happens when I hit the three\u2011sift limit?`}>
                    Nothing breaks. Your history stays visible, the
                    composer tells you when your next sift unlocks, and
                    there is a quiet upgrade option if you want more
                    now. The limit is a pace, not a paywall around what
                    you have already written.
                  </FaqItem>
                  <FaqItem q="Who is this for?">
                    People whose minds don’t get quiet on their own.
                    Parents holding too many roles in a day. Builders
                    and creatives stuck between the work that pays
                    and the work that’s theirs. Anyone who writes
                    or talks to themselves to figure out what they
                    actually feel — and wants a calmer place to
                    do it than a notes app or a feed. If that’s
                    you, Sift was built for you.
                  </FaqItem>
                </div>
              </Reveal>
            </div>
          </Content>
        </Section>

        {/* CTA */}
        <Section id="cta" className="overflow-hidden">
          <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
            <div
              className="absolute h-[420px] w-[420px] rounded-full blur-[70px]"
              style={{
                top: -120,
                left: -40,
                background: "hsl(36 35% 70% / 0.35)",
                animation: "float 18s ease-in-out infinite",
              }}
            />
            <div
              className="absolute h-[360px] w-[360px] rounded-full blur-[70px]"
              style={{
                bottom: -140,
                right: -60,
                background: "hsl(var(--primary) / 0.16)",
                animation: "float 22s ease-in-out infinite",
              }}
            />
          </div>
          <Content className="text-center">
            <Reveal>
              <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
                Clarity over comfort
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mx-auto m-0 max-w-[22ch] font-serif text-[clamp(2.4rem,4vw,3.4rem)] leading-[1.05] tracking-[-0.03em]">
                When you are ready to hear what is really going on, Sift is
                ready to listen.
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p className="mx-auto mt-5 max-w-[34rem] text-[clamp(1.05rem,1.8vw,1.4rem)] leading-[1.7] text-muted-foreground">
                Bring one live situation, one looping thought, or one decision
                that feels heavy. See what changes when the noise is stripped
                away.
              </p>
            </Reveal>
            <Reveal delay={220}>
              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <a
                  href={getAppHref()}
                  className="inline-flex h-12 min-w-[180px] items-center justify-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:-translate-y-px"
                  data-testid="link-cta-primary"
                >
                  Try Sift now
                </a>
              </div>
            </Reveal>
          </Content>
        </Section>
      </main>

      <footer
        className="relative z-[2] border-t border-border/60 py-10"
        style={{
          background: "color-mix(in srgb, hsl(var(--background)) 82%, transparent)",
        }}
      >
        <div className="mx-auto flex w-[min(1160px,calc(100vw-32px))] flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
          <a
            href="#what"
            className="transition-colors hover:text-foreground"
            data-testid="link-footer-what"
          >
            What it is for
          </a>
          <a
            href="#how"
            className="transition-colors hover:text-foreground"
            data-testid="link-footer-how"
          >
            How it works
          </a>
          <a
            href="#engine"
            className="transition-colors hover:text-foreground"
            data-testid="link-footer-engine"
          >
            The engine
          </a>
          <a
            href="#clarity"
            className="transition-colors hover:text-foreground"
            data-testid="link-footer-clarity"
          >
            Clarity
          </a>
          <a
            href="#use-cases"
            className="transition-colors hover:text-foreground"
            data-testid="link-footer-cases"
          >
            Use cases
          </a>
          <a
            href="/#/pricing"
            className="transition-colors hover:text-foreground"
            data-testid="link-footer-pricing"
          >
            Pricing
          </a>
          <a
            href="#faq"
            className="transition-colors hover:text-foreground"
            data-testid="link-footer-faq"
          >
            FAQ
          </a>
        </div>
      </footer>
    </div>
  );
}
