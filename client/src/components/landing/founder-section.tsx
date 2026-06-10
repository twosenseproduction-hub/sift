import { Content, Reveal, Section } from "@/pages/landing-shared";

/**
 * Preserved founder block — layout, copy, and image treatment match the
 * existing landing implementation (screenshot fidelity).
 */
export function LandingFounderSection() {
  return (
    <Section id="founder">
      <Content>
        <Reveal>
          <p className="landing-eyebrow mb-4 text-center">The person behind it</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="landing-headline mx-auto m-0 mb-4 max-w-[20ch] text-center text-[clamp(2rem,3.4vw,2.8rem)] leading-[1.05]">
            Alejandro Hernandez
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p className="landing-eyebrow mb-12 text-center text-[14px] tracking-[0.18em]">
            Father · Husband · Poet · Multi‑media entrepreneur
          </p>
        </Reveal>
        <div className="mx-auto grid max-w-[960px] items-center gap-10 md:grid-cols-[260px_1fr] md:gap-14">
          <Reveal delay={160}>
            <div className="relative mx-auto w-full max-w-[260px] md:max-w-none">
              <div
                aria-hidden="true"
                className="landing-founder-glow absolute -inset-3"
              />
              <img
                src="/founder-alejandro.jpg"
                alt="Alejandro Hernandez, the founder of Sift, smiling outdoors with greenery behind him."
                className="landing-founder-photo relative w-full object-cover"
                style={{ aspectRatio: "3 / 4" }}
                data-testid="img-founder"
                loading="lazy"
              />
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div>
              <div className="landing-lead space-y-4 text-[16px] md:text-[17px]">
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
                <p>
                  If Sift is useful to you, that’s the whole point.
                  If something is missing, tell me. This is built
                  slowly, by hand, for the kind of mind I have.
                </p>
              </div>
              <p
                className="landing-headline mt-7 text-[18px] italic tracking-[-0.01em] opacity-80"
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
