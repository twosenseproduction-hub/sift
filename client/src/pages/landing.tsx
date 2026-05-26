import { useEffect } from "react";
import { EngineDemo } from "@/components/engine-demo";
import { LandingFounderSection } from "@/components/landing/founder-section";
import { LandingOutcomesSection } from "@/components/landing/outcomes-section";
import { LandingProductPreviewSection } from "@/components/landing/product-preview";
import { LandingTestimonialsSection } from "@/components/landing/testimonials-section";
import { EnergyCanvas } from "@/components/redesign-v3/energy-canvas";
import {
  Content,
  getAppHref,
  LandingFooter,
  LandingHeader,
  Reveal,
  Section,
} from "@/pages/landing-shared";

const HOW_STEPS = [
  {
    label: "Step one",
    title: "Capture the tangle",
    body: "Type or speak what's occupying your mind — unfinished, emotional, unclear, real.",
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
    <div className="sift-redesign-v3-theme sift-landing-page relative min-h-screen">
      <EnergyCanvas text="" />
      <LandingHeader current="landing" />

      <main>
        {/* 1. Hero */}
        <Section id="top" className="min-h-[92svh]">
          <Content>
            <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
              <div className="text-left">
                <Reveal>
                  <p className="landing-eyebrow mb-5" data-testid="text-hero-eyebrow">
                    A quiet tool for a noisy mind
                  </p>
                </Reveal>
                <Reveal delay={60}>
                  <h1
                    className="landing-headline mb-6 text-[clamp(2.4rem,5.2vw,4.4rem)]"
                    data-testid="text-hero-headline"
                  >
                    Noise in. Signal out. One next step.
                  </h1>
                </Reveal>
                <Reveal delay={120}>
                  <p className="landing-lead mb-8 max-w-[34rem] text-[clamp(1.05rem,1.8vw,1.35rem)]">
                    Speak or type the tangle. Sift separates what matters from
                    what doesn&apos;t, and gives you one clear next move.
                  </p>
                </Reveal>
                <Reveal delay={180}>
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={appHref}
                      className="landing-btn-primary"
                      data-testid="link-hero-cta"
                    >
                      Begin sifting
                    </a>
                    <a
                      href="#how"
                      className="landing-btn-secondary"
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
              <p className="landing-eyebrow mb-4">How it works</p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="landing-headline mx-auto mb-12 max-w-[20ch] text-[clamp(2.2rem,4.2vw,3.6rem)]">
                Three quiet steps, end to end.
              </h2>
            </Reveal>
            <div className="mx-auto grid max-w-[1080px] gap-5 md:grid-cols-3">
              {HOW_STEPS.map((step, i) => (
                <Reveal key={step.title} delay={120 + i * 80}>
                  <div className="landing-panel h-full p-7 text-left">
                    <div className="landing-eyebrow mb-4">{step.label}</div>
                    <h3 className="landing-headline m-0 mb-3 text-2xl tracking-tight">
                      {step.title}
                    </h3>
                    <p className="landing-lead m-0 text-[15px]">{step.body}</p>
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
              <h2 className="landing-headline mx-auto mb-5 max-w-[14ch] text-[clamp(2.2rem,4vw,3.4rem)] leading-[1.02]">
                Find what matters.
              </h2>
            </Reveal>
            <Reveal delay={80}>
              <p className="landing-lead mx-auto mb-8 max-w-[32rem] text-[clamp(1.05rem,1.8vw,1.3rem)]">
                Bring the noise. Sift will help you hear the signal.
              </p>
            </Reveal>
            <Reveal delay={140}>
              <a
                href={appHref}
                className="landing-btn-primary min-w-[200px]"
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
