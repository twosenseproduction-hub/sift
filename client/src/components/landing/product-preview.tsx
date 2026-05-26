import { Content, Reveal, Section } from "@/pages/landing-shared";

const PREVIEW = {
  input:
    "I keep telling myself I'm going to do it, but every time I sit down I end up doing something else. Then I feel worse.",
  hearing:
    "The fear of not being good enough is sitting underneath the avoidance — not laziness.",
  matters: [
    "Starting feels like a verdict on whether you are capable",
    "The shame after avoiding is becoming its own loop",
  ],
  noise: [
    "Replaying every past time you did not follow through",
    "Waiting for the perfect plan before the first move",
  ],
  nextStep:
    "Set a 20-minute block for one small piece only — no outcome required, just contact with the work.",
};

export function LandingProductPreviewMock({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`landing-panel overflow-hidden ${className}`}
      data-testid="landing-product-preview"
    >
      <div className="border-b border-[var(--v3-border)] px-5 py-3.5">
        <div className="landing-eyebrow mb-2">Composer</div>
        <div className="landing-preview-inner px-4 py-3.5 text-[15px] leading-relaxed text-[var(--v3-text-primary)]">
          {PREVIEW.input}
        </div>
      </div>

      <div className="space-y-3 p-5">
        <div className="landing-preview-highlight p-4">
          <div className="landing-eyebrow mb-2">What I&apos;m hearing</div>
          <p className="m-0 text-[15px] leading-relaxed text-[var(--v3-text-primary)]">
            {PREVIEW.hearing}
          </p>
        </div>

        <div className="landing-preview-inner p-4">
          <div className="landing-eyebrow mb-2">What matters now</div>
          <ul className="m-0 list-none space-y-2 pl-0">
            {PREVIEW.matters.map((item) => (
              <li
                key={item}
                className="flex gap-2 text-[14px] leading-relaxed text-[var(--v3-text-primary)] before:mt-2 before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-[var(--v3-sage)] before:content-['']"
              >
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="landing-preview-inner p-4">
          <div className="landing-eyebrow mb-2">What may be noise now</div>
          <ul className="m-0 list-none space-y-2 pl-0">
            {PREVIEW.noise.map((item) => (
              <li
                key={item}
                className="flex gap-2 text-[14px] leading-relaxed text-[var(--v3-text-muted)] before:mt-2 before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-[var(--v3-text-muted)] before:opacity-50 before:content-['']"
              >
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="landing-preview-step p-4">
          <div className="landing-eyebrow landing-preview-step-label mb-2">
            One next step
          </div>
          <p className="m-0 text-[15px] font-medium leading-relaxed text-[var(--v3-text-primary)]">
            {PREVIEW.nextStep}
          </p>
        </div>
      </div>
    </div>
  );
}

export function LandingProductPreviewSection() {
  return (
    <Section id="preview">
      <Content>
        <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
          <div>
            <Reveal>
              <p className="landing-eyebrow mb-4">The experience</p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="landing-headline m-0 mb-5 text-[clamp(2.2rem,4.2vw,3.6rem)]">
                Bring the tangle. Leave with clarity.
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p className="landing-lead max-w-[34rem] text-[clamp(1.05rem,1.8vw,1.35rem)]">
                Sift does not ask you to organize your thoughts first. It helps
                you find what matters inside the mess.
              </p>
            </Reveal>
          </div>
          <Reveal delay={120}>
            <LandingProductPreviewMock />
          </Reveal>
        </div>
      </Content>
    </Section>
  );
}
