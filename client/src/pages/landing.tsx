import { useEffect } from "react";
import { EngineDemo } from "@/components/engine-demo";
import { LandingFounderSection } from "@/components/landing/founder-section";
import { LandingOutcomesSection } from "@/components/landing/outcomes-section";
import { LandingProductPreviewSection } from "@/components/landing/product-preview";
import { LandingTestimonialsSection } from "@/components/landing/testimonials-section";
import {
  Content,
  getAppHref,
  LandingFooter,
  LandingHeader,
  Reveal,
  Section,
} from "@/pages/landing-shared";

function NoiseBlob({
  top,
  right,
  bottom,
  left,
  color,
  size = 300,
  duration = 16,
  opacity = 0.14,
}: {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  color: string;
  size?: number;
  duration?: number;
  opacity?: number;
}) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div
        className="absolute rounded-full blur-[70px]"
        style={{
          top,
          right,
          bottom,
          left,
          height: size,
          width: size,
          background: color,
          opacity,
          animation: `float ${duration}s ease-in-out infinite`,
        }}
      />
    </div>
  );
}

function AuroraBackground() {
  return (
    <>
      <NoiseBlob top="-120px" right="-80px" color="hsl(var(--primary) / 0.14)" size={420} duration={14} />
      <NoiseBlob bottom="-80px" left="-60px" color="hsl(36 35% 70% / 0.32)" size={320} duration={18} opacity={0.32} />
      <NoiseBlob top="30%" left="12%" color="hsl(180 18% 50% / 0.14)" size={240} duration={22} />
      <NoiseBlob top="15%" left="55%" color="hsl(36 35% 70% / 0.18)" size={180} duration={20} opacity={0.18} />
      <NoiseBlob top="60%" right="8%" color="hsl(var(--primary) / 0.12)" size={260} duration={17} opacity={0.12} />
      <NoiseBlob bottom="20%" left="40%" color="hsl(180 18% 50% / 0.10)" size={200} duration={24} opacity={0.10} />
      <NoiseBlob top="75%" right="25%" color="hsl(36 35% 70% / 0.20)" size={220} duration={19} opacity={0.20} />
      <NoiseBlob top="45%" right="35%" color="hsl(var(--primary) / 0.10)" size={280} duration={21} opacity={0.10} />
    </>
  );
}

const HOW_STEPS = [
  {
    label: "Step one",
    title: "Capture the tangle",
    body: "Type or speak what’s occupying your mind — unfinished, emotional, unclear, real.",
  },
  {
    label: "Step two",
    title: "Receive the signal",
    body: "Sift identifies what actually matters beneath the spiral, the comparison, and the overthinking.",
  },
  {
    label: "Step three",
    title: "One next step",
    body: "Leave with one precise step forward, not a list that creates more pressure.",
  },
] as const;

export default function Landing() {
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

  const appHref = getAppHref();

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -35px) scale(1.08); }
          66% { transform: translate(-35px, 30px) scale(0.94); }
        }
      `}</style>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.18] mix-blend-multiply dark:opacity-[0.10] dark:mix-blend-screen"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
          backgroundSize: "220px 220px",
        }}
      />

      <AuroraBackground />
      <LandingHeader current="landing" />

      <main className="relative z-[1]">
        {/* 1. Hero */}
        <Section id="top" className="min-h-[92svh]">
          <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
            <NoiseBlob top="-80px" right="-70px" color="hsl(var(--primary) / 0.14)" size={380} duration={14} />
            <NoiseBlob bottom="-60px" left="-40px" color="hsl(36 35% 70% / 0.28)" size={280} duration={18} opacity={0.28} />
          </div>
          <Content>
            <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
              <div className="text-left">
                <Reveal>
                  <p
                    className="mb-5 text-[12px] font-medium uppercase tracking-[0.26em] text-muted-foreground"
                    data-testid="text-hero-eyebrow"
                  >
                    A quiet tool for a noisy mind
                  </p>
                </Reveal>
                <Reveal delay={60}>
                  <h1
                    className="m-0 mb-6 font-serif text-[clamp(2.4rem,5.2vw,4.4rem)] leading-[0.95] tracking-[-0.045em]"
                    data-testid="text-hero-headline"
                  >
                    Noise in. Signal out. One next step.
                  </h1>
                </Reveal>
                <Reveal delay={120}>
                  <p className="mb-8 max-w-[34rem] text-[clamp(1.05rem,1.8vw,1.35rem)] leading-[1.7] text-muted-foreground">
                    Speak or type the tangle. Sift separates what matters from
                    what doesn&apos;t, and gives you one clear next move.
                  </p>
                </Reveal>
                <Reveal delay={180}>
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={appHref}
                      className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:-translate-y-px"
                      data-testid="link-hero-cta"
                    >
                      Begin sifting
                    </a>
                    <a
                      href="#how"
                      className="inline-flex h-12 items-center justify-center rounded-full border border-border/60 bg-card/50 px-7 text-sm font-semibold text-foreground backdrop-blur-md transition-colors hover:bg-card/80"
                      data-testid="link-hero-secondary"
                    >
                      See how it works
                    </a>
                  </div>
                </Reveal>
              </div>
              <Reveal delay={140}>
                <div data-testid="hero-engine-demo">
                  <EngineDemo compact showSelector />
                </div>
              </Reveal>
            </div>
          </Content>
        </Section>

        {/* 2. Product preview */}
        <LandingProductPreviewSection />

        {/* 3. How it works */}
        <Section id="how">
          <Content className="text-center">
            <Reveal>
              <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
                How it works
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mx-auto m-0 mb-12 max-w-[20ch] font-serif text-[clamp(2.2rem,4.2vw,3.6rem)] leading-[0.95] tracking-[-0.05em]">
                Three quiet steps, end to end.
              </h2>
            </Reveal>
            <div className="mx-auto grid max-w-[1080px] gap-5 md:grid-cols-3">
              {HOW_STEPS.map((step, i) => (
                <Reveal key={step.title} delay={120 + i * 80}>
                  <div className="h-full rounded-3xl border border-border/60 bg-card/70 p-7 text-left shadow-[var(--shadow-md)] backdrop-blur-md">
                    <div className="mb-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {step.label}
                    </div>
                    <h3 className="m-0 mb-3 font-serif text-2xl tracking-tight">
                      {step.title}
                    </h3>
                    <p className="m-0 leading-7 text-muted-foreground">{step.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Content>
        </Section>

        {/* 4. Outcomes */}
        <LandingOutcomesSection />

        {/* 5. Social proof */}
        <LandingTestimonialsSection />

        {/* 6. About the developer — preserved */}
        <LandingFounderSection />

        {/* 7. Final CTA */}
        <Section id="cta" className="min-h-[70svh]">
          <Content className="text-center">
            <Reveal>
              <h2 className="mx-auto m-0 mb-5 max-w-[14ch] font-serif text-[clamp(2.2rem,4vw,3.4rem)] leading-[1.02] tracking-[-0.04em]">
                Find what matters.
              </h2>
            </Reveal>
            <Reveal delay={80}>
              <p className="mx-auto mb-8 max-w-[32rem] text-[clamp(1.05rem,1.8vw,1.3rem)] leading-[1.7] text-muted-foreground">
                Bring the noise. Sift will help you hear the signal.
              </p>
            </Reveal>
            <Reveal delay={140}>
              <a
                href={appHref}
                className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-full bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:-translate-y-px"
                data-testid="link-cta-final"
              >
                Begin your first sift
              </a>
            </Reveal>
          </Content>
        </Section>
      </main>

      <LandingFooter current="landing" />
    </div>
  );
}
