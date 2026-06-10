import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand";

// Shared primitives used by both the landing page and the pricing page.
// Lifted out of landing.tsx so multiple marketing surfaces can share the
// same look without duplicating the components. Kept intentionally small
// — just the pieces that need to be reused.

// CTA target is host-aware: on the marketing domain (siftnow.io /
// www.siftnow.io) it cross-links to the app subdomain; on the app host
// or anywhere else (localhost, *.fly.dev, preview environments) it
// stays on the current host so previews don't bounce people away.
export function getAppHref() {
  if (typeof window === "undefined") return "/";
  const h = window.location.hostname;
  if (h === "siftnow.io" || h === "www.siftnow.io") {
    return "https://app.siftnow.io/";
  }
  return "/";
}

// Hash-route URL for a landing section. Wouter owns the hash, so bare
// anchors like #preview replace #/landing and 404; double hashes like
// /#/landing#preview parse as /landing#preview and also 404. Use a
// nested route segment instead: /#/landing/preview → /landing/preview.
export function landingAnchor(section: string, _current: "landing" | "other"): string {
  return `/#/landing/${section}`;
}

/** Section id from wouter location (`/landing/preview` → `preview`). */
export function landingSectionFromPath(location: string): string | null {
  if (!location.startsWith("/landing/")) return null;
  const segment = location.slice("/landing/".length).split("?")[0];
  return segment || null;
}

// Reveal-on-scroll: a small wrapper that fades + slides in once the
// element enters the viewport. Once revealed it stays revealed.
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ease-out ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// Section wrapper: full-height, content centered. The page reads as
// one continuous surface — ambient blobs and content rhythm provide
// the separation, no per-section vignette seams.
export function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`relative flex min-h-[100svh] items-center justify-center overflow-clip py-[clamp(88px,10vw,124px)] ${className}`}
    >
      {children}
    </section>
  );
}

// Container for section content — sits above the vignette and gradient
// mesh, capped to a comfortable reading width.
export function Content({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative z-[2] w-[min(1160px,calc(100vw-32px))] p-[clamp(1.5rem,4vw,4rem)] ${className}`}
    >
      {children}
    </div>
  );
}

// Pill — the small bordered tags used in the hero and the rotating
// example surface. Uses the primary teal as the bordered tint.
export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/15 bg-primary/[0.06] px-4 py-2 text-sm text-primary">
      {children}
    </span>
  );
}

// Sticky glass header — adds a faint border once the user scrolls past
// the top. CTA on the right. The `current` prop is kept for call-site
// clarity; section links always use /#/landing/:section routes.
export function LandingHeader({ current }: { current: "landing" | "other" }) {
  const brandHref = "/#/landing";
  return (
    <header className="landing-header" data-testid="landing-header">
      <div className="landing-header__inner">
        <a
          href={brandHref}
          className="inline-flex items-center gap-3"
          aria-label="Sift home"
          data-testid="link-landing-brand"
        >
          <Logo size={32} />
        </a>
        <nav className="landing-header__nav" aria-label="Primary navigation">
          <a href={landingAnchor("preview", current)} data-testid="link-nav-preview">
            Product
          </a>
          <a href={landingAnchor("how", current)} data-testid="link-nav-how">
            How it works
          </a>
          <a href={landingAnchor("outcomes", current)} data-testid="link-nav-outcomes">
            Outcomes
          </a>
          <a href={landingAnchor("founder", current)} data-testid="link-nav-founder">
            About
          </a>
          <a href="/#/pricing" data-testid="link-nav-pricing">
            Pricing
          </a>
        </nav>
        <a
          href={getAppHref()}
          className="landing-btn-primary landing-header__cta"
          data-testid="link-header-cta"
        >
          Start with Sift
        </a>
      </div>
    </header>
  );
}

// The shared marketing footer. Same nav rail used on the landing page,
// reused on /pricing so the pages feel like one site, not two.
export function LandingFooter({ current }: { current: "landing" | "other" }) {
  return (
    <footer className="landing-footer">
      <div className="landing-footer__links">
        <a href={landingAnchor("preview", current)} data-testid="link-footer-preview">
          Product
        </a>
        <a href={landingAnchor("how", current)} data-testid="link-footer-how">
          How it works
        </a>
        <a href={landingAnchor("outcomes", current)} data-testid="link-footer-outcomes">
          Outcomes
        </a>
        <a href={landingAnchor("founder", current)} data-testid="link-footer-founder">
          About
        </a>
        <a href="/#/pricing" data-testid="link-footer-pricing">
          Pricing
        </a>
      </div>
    </footer>
  );
}
