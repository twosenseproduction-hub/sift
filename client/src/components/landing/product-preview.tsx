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
      className={`overflow-hidden rounded-[28px] border border-border/60 bg-card/70 shadow-[var(--shadow-lg)] backdrop-blur-md ${className}`}
      data-testid="landing-product-preview"
    >
      <div className="border-b border-border/60 px-5 py-3.5">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Composer
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/40 px-4 py-3.5 text-[15px] leading-relaxed text-foreground/85">
          {PREVIEW.input}
        </div>
      </div>

      <div className="space-y-3 p-5">
        <div className="rounded-2xl border border-l-[3px] border-border/60 border-l-primary/55 bg-muted/40 p-4">
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            What I&apos;m hearing
          </div>
          <p className="m-0 text-[15px] leading-relaxed text-foreground/85">
            {PREVIEW.hearing}
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            What matters now
          </div>
          <ul className="m-0 space-y-2 pl-0 list-none">
            {PREVIEW.matters.map((item) => (
              <li
                key={item}
                className="flex gap-2 text-[14px] leading-relaxed text-foreground/85 before:mt-2 before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-primary/70 before:content-['']"
              >
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            What may be noise now
          </div>
          <ul className="m-0 space-y-2 pl-0 list-none">
            {PREVIEW.noise.map((item) => (
              <li
                key={item}
                className="flex gap-2 text-[14px] leading-relaxed text-muted-foreground before:mt-2 before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-muted-foreground/50 before:content-['']"
              >
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-4">
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-primary/80">
            One next step
          </div>
          <p className="m-0 font-medium text-[15px] leading-relaxed text-foreground">
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
              <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
                The experience
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="m-0 mb-5 font-serif text-[clamp(2.2rem,4.2vw,3.6rem)] leading-[0.95] tracking-[-0.05em]">
                Bring the tangle. Leave with clarity.
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p className="max-w-[34rem] text-[clamp(1.05rem,1.8vw,1.35rem)] leading-[1.7] text-muted-foreground">
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
