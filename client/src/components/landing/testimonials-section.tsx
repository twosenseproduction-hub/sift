import { Content, Reveal, Section } from "@/pages/landing-shared";

type Testimonial = {
  quote: string;
  name: string;
  role: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Sift helped me separate the real issue from the story I kept layering on top of it. I left with one next move instead of six competing ones.",
    name: "Andrea",
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
      "The thing I keep coming back to is how calm it feels. It doesn't push more productivity at me. It helps me hear myself.",
    name: "Elena",
    role: "creative director",
  },
  {
    quote:
      "I brought a wall of context about my team. Sift named the one tension that was actually governing everything else.",
    name: "Sam",
    role: "engineering lead",
  },
  {
    quote:
      "It didn't try to fix me. It helped me see what was load-bearing and what was just loud.",
    name: "Priya",
    role: "parent and consultant",
  },
  {
    quote:
      "The next step was small enough to do before lunch. That mattered more than another perfect plan.",
    name: "Chris",
    role: "solo builder",
  },
  {
    quote:
      "I use it when my head is full at night. I leave with one line I can trust, not ten more questions.",
    name: "Noah",
    role: "writer",
  },
  {
    quote:
      "Operator mode felt like someone had read the thread once and handed me the move — not a deck of options.",
    name: "Taylor",
    role: "product manager",
  },
];

function TestimonialCard({ item }: { item: Testimonial }) {
  return (
    <figure
      className="landing-panel landing-testimonial-card flex h-full w-[min(88vw,340px)] shrink-0 flex-col p-7"
      data-testid={`testimonial-card-${item.name.toLowerCase()}`}
    >
      <blockquote className="landing-headline m-0 flex-1 text-[1.05rem] leading-[1.55] tracking-[-0.01em]">
        &ldquo;{item.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-6 border-t border-[var(--v3-border)] pt-4">
        <p className="m-0 text-sm font-medium text-[var(--v3-text-primary)]">{item.name}</p>
        <p className="landing-eyebrow mt-0.5">{item.role}</p>
      </figcaption>
    </figure>
  );
}

export function LandingTestimonialsSection() {
  const loop = [...TESTIMONIALS, ...TESTIMONIALS];

  return (
    <Section id="proof" className="flex-col !overflow-x-clip">
      <style>{`
        @keyframes landing-testimonials-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .landing-testimonials-track {
          animation: landing-testimonials-marquee 72s linear infinite;
        }
        .landing-testimonials-marquee:hover .landing-testimonials-track,
        .landing-testimonials-marquee:focus-within .landing-testimonials-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-testimonials-track {
            animation: none;
          }
          .landing-testimonials-marquee {
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
          }
          .landing-testimonial-card {
            scroll-snap-align: start;
          }
        }
      `}</style>

      <Content>
        <Reveal>
          <p className="landing-eyebrow mb-4 text-center">After a sift</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="landing-headline mx-auto m-0 mb-12 max-w-[22ch] text-center text-[clamp(2rem,3.6vw,3.2rem)] leading-[1.02]">
            What people feel after using Sift
          </h2>
        </Reveal>
      </Content>

      <Reveal delay={120}>
        <div
          className="landing-testimonials-marquee relative w-full"
          data-testid="landing-testimonials-marquee"
          aria-label="What people feel after using Sift"
        >
          <div aria-hidden className="landing-fade-edge landing-fade-edge--left" />
          <div aria-hidden className="landing-fade-edge landing-fade-edge--right" />

          <div className="landing-testimonials-track flex w-max gap-5 px-4 sm:px-8">
            {loop.map((item, i) => (
              <TestimonialCard key={`${item.name}-${i}`} item={item} />
            ))}
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
