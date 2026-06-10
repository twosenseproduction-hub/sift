import { Check } from "lucide-react";
import { EnergyCanvas } from "@/components/redesign-v3/energy-canvas";
import {
  Content,
  LandingFooter,
  LandingHeader,
  Reveal,
  Section,
  getAppHref,
} from "./landing-shared";

// Pricing — small marketing surface. Two tiers, no feature gates, only
// volume differs. Free is genuine, not a downsell. Plus is the default
// path for people who use Sift weekly. The honest framing at the top
// names where we are: Plus is built but not yet billable, so during
// the launch window everyone is on free with no enforcement.

function FeatureRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="m-0 flex items-start gap-3 text-[15px] leading-[1.55]">
      <Check
        className="mt-[5px] h-4 w-4 shrink-0 text-[var(--v3-leaf-mid)]"
        aria-hidden="true"
      />
      <span className="text-[var(--v3-text-secondary)]">{children}</span>
    </li>
  );
}

export default function Pricing() {
  return (
    <div className="sift-redesign-v3-theme sift-landing-page relative min-h-screen">
      <EnergyCanvas text="" />
      <LandingHeader current="other" />

      <main>
        <Section id="pricing-top" className="min-h-0 py-[clamp(96px,12vw,140px)]">
          <Content>
            <Reveal>
              <div className="mx-auto max-w-[640px] text-center">
                <p className="landing-eyebrow mb-4">Pricing</p>
                <h1 className="landing-headline mb-5 text-[clamp(2.4rem,4.6vw,3.8rem)]">
                  Honest pricing.
                </h1>
                <p className="landing-lead text-[clamp(1.05rem,1.3vw,1.2rem)]">
                  Two tiers. Same product, same features, same care.
                  The only difference is how often you sift.
                </p>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="mx-auto mt-12 grid max-w-[920px] gap-5 md:grid-cols-2 md:gap-6">
                {/* Free */}
                <div
                  className="landing-panel flex flex-col p-7 md:p-8"
                  data-testid="pricing-card-free"
                >
                  <p className="landing-eyebrow m-0">Free</p>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="landing-headline text-[3rem] leading-none tracking-[-0.03em]">
                      $0
                    </span>
                    <span className="landing-lead text-sm">forever</span>
                  </div>
                  <p className="landing-lead mt-4 text-[15px] leading-[1.6]">
                    Three sifts a month. Enough for the moments that
                    really need it.
                  </p>
                  <ul className="mt-6 list-none space-y-3.5 p-0">
                    <FeatureRow>3 sifts every month</FeatureRow>
                    <FeatureRow>
                      Full history, never expires
                    </FeatureRow>
                    <FeatureRow>Voice or text input</FeatureRow>
                    <FeatureRow>
                      Mirror, Matters, Noise, and one next step
                    </FeatureRow>
                    <FeatureRow>
                      Deepening threads and throughline memory
                    </FeatureRow>
                  </ul>
                  <a
                    href={getAppHref()}
                    className="landing-btn-secondary mt-8 w-full"
                    data-testid="link-pricing-free-cta"
                  >
                    Start with free
                  </a>
                </div>

                {/* Plus — same panel shape with a quiet sage accent on
                    the left edge so it reads as the main path. */}
                <div
                  className="landing-panel landing-preview-highlight flex flex-col p-7 md:p-8"
                  data-testid="pricing-card-plus"
                >
                  <p className="landing-eyebrow landing-preview-step-label m-0">
                    Plus
                  </p>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="landing-headline text-[3rem] leading-none tracking-[-0.03em]">
                      $6
                    </span>
                    <span className="landing-lead text-sm">
                      per month
                    </span>
                  </div>
                  <p className="landing-lead mt-1.5 text-[13px]">
                    or $48 a year — two months on us.
                  </p>
                  <p className="landing-lead mt-4 text-[15px] leading-[1.6]">
                    Unlimited sifts for the seasons of life that ask
                    more of you.
                  </p>
                  <ul className="mt-6 list-none space-y-3.5 p-0">
                    <FeatureRow>Unlimited sifts</FeatureRow>
                    <FeatureRow>
                      Everything in Free, no feature gates
                    </FeatureRow>
                    <FeatureRow>
                      Cancel any time — your history stays
                    </FeatureRow>
                    <FeatureRow>
                      Support a small independent team
                    </FeatureRow>
                  </ul>
                  <button
                    type="button"
                    disabled
                    className="landing-btn-primary mt-8 w-full cursor-default opacity-75"
                    data-testid="button-pricing-plus-cta"
                  >
                    Plus opens soon
                  </button>
                </div>
              </div>
            </Reveal>

            {/* Honest note about where we are. Same calm voice. */}
            <Reveal delay={240}>
              <div className="landing-panel-muted mx-auto mt-10 max-w-[620px] px-6 py-5 text-center text-[14px] leading-[1.7] text-[var(--v3-text-secondary)]">
                Plus is built and being readied. Until billing opens,
                everyone is on the free tier with no limit enforced —
                the way it has been since the beta. When Plus goes
                live, anyone who joined before launch gets six months
                of Plus free, automatically.
              </div>
            </Reveal>

            {/* Tiny FAQ-style row for the obvious questions — kept
                short so the page does not turn into a sales surface. */}
            <Reveal delay={320}>
              <div className="mx-auto mt-12 grid max-w-[820px] gap-x-10 gap-y-7 sm:grid-cols-2">
                <div>
                  <p className="landing-eyebrow mb-1.5">
                    What counts as a sift?
                  </p>
                  <p className="m-0 text-[14px] leading-[1.65] text-[var(--v3-text-secondary)]">
                    Each new entry you submit. Following up inside the
                    same thread does not use another one — only a new
                    starting thought does.
                  </p>
                </div>
                <div>
                  <p className="landing-eyebrow mb-1.5">
                    What if I hit the limit?
                  </p>
                  <p className="m-0 text-[14px] leading-[1.65] text-[var(--v3-text-secondary)]">
                    Your history stays open. The composer shows when
                    the next sift unlocks. Upgrading is a button, not
                    a wall.
                  </p>
                </div>
                <div>
                  <p className="landing-eyebrow mb-1.5">
                    Are any features Plus‑only?
                  </p>
                  <p className="m-0 text-[14px] leading-[1.65] text-[var(--v3-text-secondary)]">
                    No. Free has every feature Plus has. The only
                    difference is how often you can start a new sift.
                  </p>
                </div>
                <div>
                  <p className="landing-eyebrow mb-1.5">
                    Can I cancel?
                  </p>
                  <p className="m-0 text-[14px] leading-[1.65] text-[var(--v3-text-secondary)]">
                    Any time, from inside the app. Your history and
                    threads remain — you simply move back to the free
                    pace.
                  </p>
                </div>
              </div>
            </Reveal>
          </Content>
        </Section>
      </main>

      <LandingFooter current="other" />
    </div>
  );
}
