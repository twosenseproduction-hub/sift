import { Content, Reveal, Section } from "@/pages/landing-shared";

const TESTIMONIALS = [
  {
    quote:
      "Sift helped me separate the real issue from the story I kept layering on top of it. I left with one next move instead of six competing ones.",
    name: "Maya",
    role: "founder",
  },
  {
    quote:
      "I expected journaling. What I got was a cleaner decision in ten minutes.",
    name: "Jordan",
    role: "operator with ADHD",
  },
  {
    quote:
      "The thing I keep coming back to is how calm it feels. It doesn’t push more productivity at me. It helps me hear myself.",
    name: "Elena",
    role: "creative director",
  },
] as const;

export function LandingTestimonialsSection() {
  return (
    <Section id="proof">
      <Content>
        <Reveal>
          <p className="mb-4 text-center text-[12px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
            After a sift
          </p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mx-auto m-0 mb-12 max-w-[22ch] text-center font-serif text-[clamp(2rem,3.6vw,3.2rem)] leading-[1.02] tracking-[-0.04em]">
            What people feel after using Sift
          </h2>
        </Reveal>

        <div className="grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((item, i) => (
            <Reveal key={item.name} delay={120 + i * 80}>
              <figure className="flex h-full flex-col rounded-3xl border border-border/60 bg-card/60 p-7 shadow-[var(--shadow-sm)] backdrop-blur-md">
                <blockquote className="m-0 flex-1 font-serif text-[1.05rem] leading-[1.55] tracking-[-0.01em] text-foreground/90">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 border-t border-border/50 pt-4">
                  <p className="m-0 text-sm font-medium text-foreground">
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {item.role}
                  </p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </Content>
    </Section>
  );
}
