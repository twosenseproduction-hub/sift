import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Logo } from "@/components/brand";
import { useTheme } from "@/lib/theme";

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
      {/* Vignette — radial gradient that gently darkens the edges of
          each section so it feels held. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, hsl(var(--foreground) / 0.06) 100%)",
        }}
      />
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
          <span className="text-primary">
            <Logo size={36} />
          </span>
          <span className="font-serif text-xl tracking-tight">Sift</span>
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
function ComposerMock() {
  return (
    <div
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
          <div className="text-base text-muted-foreground/90">
            What's on your mind?
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

// The rotating example in the "Clarity" section. Cycles through three
// real-world prompts every 5s — emotional clarity, project pressure,
// decision overload — to show the breadth of what Sift handles.
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
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % EXAMPLES.length), 5000);
    return () => clearInterval(id);
  }, []);
  const ex = EXAMPLES[idx];
  return (
    <div
      className="overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-[var(--shadow-lg)]"
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
      <div className="grid gap-3.5 p-5">
        <div>
          <Pill key={`tag-${idx}`}>{ex.tag}</Pill>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Input
          </div>
          <div className="leading-7 text-foreground/80">{ex.input}</div>
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
          <Content className="text-center">
            <Reveal className="mx-auto max-w-[960px]">
              <div className="mx-auto mb-6 h-20 w-20 text-primary">
                <Logo size={80} />
              </div>
              <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
                A quiet tool for a noisy mind
              </p>
              <h1 className="m-0 mb-5 font-serif text-[clamp(3rem,6vw,5.6rem)] leading-[0.92] tracking-[-0.05em]">
                Sift helps you find
                <br />
                what actually matters.
              </h1>
              <p className="mx-auto max-w-[48rem] text-[clamp(1.05rem,1.8vw,1.5rem)] leading-[1.7] text-muted-foreground">
                You speak or type what you are holding. Sift separates signal
                from noise, returns the deeper pattern, and gives you one next
                step you can actually take.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Pill>Quiet clarity</Pill>
                <Pill>One next step</Pill>
                <Pill>No clutter</Pill>
              </div>
              <div className="mt-10">
                <a
                  href={getAppHref()}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:-translate-y-px"
                  data-testid="link-hero-cta"
                >
                  Start with Sift
                </a>
              </div>
            </Reveal>
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
                    Themes you keep returning to, what actually matters, what
                    is noise, and one next step you can take. Structured
                    enough to move, restrained enough to feel human.
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
              <h2 className="mx-auto m-0 max-w-[22ch] font-serif text-[clamp(2.2rem,4.2vw,4rem)] leading-[0.95] tracking-[-0.05em]">
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
        </div>
      </footer>
    </div>
  );
}
