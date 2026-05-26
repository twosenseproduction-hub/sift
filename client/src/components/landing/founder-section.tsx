import { Content, Reveal, Section } from "@/pages/landing-shared";

/**
 * Preserved founder block — layout, copy, and image treatment match the
 * existing landing implementation (screenshot fidelity).
 */
export function LandingFounderSection() {
  return (
    <Section id="founder">
      <Content>
        <div className="mx-auto grid max-w-[960px] items-center gap-10 md:grid-cols-[260px_1fr] md:gap-14">
          <Reveal>
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
  );
}
