import { useEffect } from "react";
import { Check } from "lucide-react";
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
    <li className="flex items-start gap-3 text-[15px] leading-[1.55] text-foreground/85">
      <Check
        className="mt-[5px] h-4 w-4 shrink-0 text-primary/75"
        aria-hidden="true"
      />
      <span>{children}</span>
    </li>
  );
}

export default function Pricing() {
  // Smooth-scroll any in-page anchors (matches landing.tsx behavior so
  // header anchors that point at sections on /#/landing degrade nicely
  // when they happen to land here).
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
      {/* Faint grain — same texture as the landing page so the two
          surfaces feel like one site. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.18] mix-blend-multiply dark:opacity-[0.10] dark:mix-blend-screen"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
          backgroundSize: "220px 220px",
        }}
      />

      <LandingHeader current="other" />

      <main className="relative z-[1]">
        <Section id="pricing-top">
          <Content>
            <Reveal>
              <div className="mx-auto max-w-[640px] text-center">
                <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
                  Pricing
                </p>
                <h1 className="m-0 mb-5 font-serif text-[clamp(2.4rem,4.6vw,3.8rem)] leading-[1.02] tracking-[-0.04em]">
                  Honest pricing.
                </h1>
                <p className="text-[clamp(1.05rem,1.3vw,1.2rem)] leading-[1.65] text-muted-foreground">
                  Two tiers. Same product, same features, same care.
                  The only difference is how often you sift.
                </p>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="mx-auto mt-12 grid max-w-[920px] gap-5 md:grid-cols-2 md:gap-6">
                {/* Free */}
                <div
                  className="flex flex-col rounded-3xl border border-border/60 bg-card/80 p-7 shadow-[0_18px_48px_-30px_rgba(0,0,0,0.16)] backdrop-blur-md md:p-8"
                  data-testid="pricing-card-free"
                >
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    Free
                  </p>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="font-serif text-[3rem] leading-none tracking-[-0.03em]">
                      $0
                    </span>
                    <span className="text-sm text-muted-foreground">forever</span>
                  </div>
                  <p className="mt-4 text-[15px] leading-[1.6] text-muted-foreground">
                    Three sifts a month. Enough for the moments that
                    really need it.
                  </p>
                  <ul className="mt-6 space-y-3.5">
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
                    className="mt-8 inline-flex h-12 items-center justify-center rounded-full border border-border/60 bg-background/60 px-6 text-sm font-semibold transition-transform hover:-translate-y-px"
                    data-testid="link-pricing-free-cta"
                  >
                    Start with free
                  </a>
                </div>

                {/* Plus — same shape, slightly warmer surface and a
                    quiet primary border on the left edge so it reads
                    as the main path without shouting. */}
                <div
                  className="relative flex flex-col rounded-3xl border border-primary/30 bg-card p-7 shadow-[0_22px_60px_-30px_rgba(0,0,0,0.22)] backdrop-blur-md md:p-8"
                  data-testid="pricing-card-plus"
                  style={{
                    background:
                      "linear-gradient(180deg, hsl(var(--primary) / 0.04) 0%, hsl(var(--card)) 60%)",
                  }}
                >
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary/80">
                    Plus
                  </p>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="font-serif text-[3rem] leading-none tracking-[-0.03em]">
                      $6
                    </span>
                    <span className="text-sm text-muted-foreground">
                      per month
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-muted-foreground">
                    or $48 a year — two months on us.
                  </p>
                  <p className="mt-4 text-[15px] leading-[1.6] text-muted-foreground">
                    Unlimited sifts for the seasons of life that ask
                    more of you.
                  </p>
                  <ul className="mt-6 space-y-3.5">
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
                    className="mt-8 inline-flex h-12 cursor-default items-center justify-center rounded-full bg-primary/90 px-6 text-sm font-semibold text-primary-foreground opacity-90"
                    data-testid="button-pricing-plus-cta"
                  >
                    Plus opens soon
                  </button>
                </div>
              </div>
            </Reveal>

            {/* Honest note about where we are. Same calm voice. */}
            <Reveal delay={240}>
              <div className="mx-auto mt-10 max-w-[620px] rounded-2xl border border-border/60 bg-card/60 px-6 py-5 text-center text-[14px] leading-[1.7] text-muted-foreground backdrop-blur-md">
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
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    What counts as a sift?
                  </p>
                  <p className="m-0 text-[14px] leading-[1.65] text-foreground/85">
                    Each new entry you submit. Following up inside the
                    same thread does not use another one — only a new
                    starting thought does.
                  </p>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    What if I hit the limit?
                  </p>
                  <p className="m-0 text-[14px] leading-[1.65] text-foreground/85">
                    Your history stays open. The composer shows when
                    the next sift unlocks. Upgrading is a button, not
                    a wall.
                  </p>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    Are any features Plus‑only?
                  </p>
                  <p className="m-0 text-[14px] leading-[1.65] text-foreground/85">
                    No. Free has every feature Plus has. The only
                    difference is how often you can start a new sift.
                  </p>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    Can I cancel?
                  </p>
                  <p className="m-0 text-[14px] leading-[1.65] text-foreground/85">
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
