import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Logo } from "@/components/brand";
import { useTheme } from "@/lib/theme";

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

// Build a hash-route URL pointing at a section on the landing page,
// from anywhere in the app. Wouter's hash routing means /#/landing is
// the route; the section anchor is appended after as #what / #faq.
// Same-page anchors are returned bare so the smooth-scroll handler in
// landing.tsx still picks them up.
export function landingAnchor(section: string, current: "landing" | "other"): string {
  if (current === "landing") return `#${section}`;
  return `/#/landing#${section}`;
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
// the top. Theme toggle and CTA on the right. The `current` prop tells
// it whether we are already on the landing page (use bare anchors that
// the smooth-scroll handler picks up) or somewhere else (build full
// hash-route URLs to the landing page sections).
export function LandingHeader({ current }: { current: "landing" | "other" }) {
  const { theme, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    document.addEventListener("scroll", onScroll, { passive: true });
    return () => document.removeEventListener("scroll", onScroll);
  }, []);
  const brandHref = current === "landing" ? "#top" : "/#/landing";
  return (
    <header
      className={`sticky top-0 z-[100] backdrop-blur-md transition-colors ${
        scrolled ? "border-b border-border/60" : "border-b border-transparent"
      }`}
      style={{
        background: "color-mix(in srgb, hsl(var(--background)) 76%, transparent)",
      }}
      data-testid="landing-header"
    >
      <div className="mx-auto flex min-h-[76px] w-[min(1180px,calc(100vw-24px))] items-center justify-between gap-4">
        <a
          href={brandHref}
          className="inline-flex items-center gap-3"
          aria-label="Sift home"
          data-testid="link-landing-brand"
        >
          <Logo size={32} />
        </a>
        <nav
          className="hidden gap-5 text-sm text-muted-foreground md:flex"
          aria-label="Primary navigation"
        >
          <a
            href={landingAnchor("what", current)}
            className="transition-colors hover:text-foreground"
            data-testid="link-nav-what"
          >
            What it is for
          </a>
          <a
            href={landingAnchor("how", current)}
            className="transition-colors hover:text-foreground"
            data-testid="link-nav-how"
          >
            How it works
          </a>
          <a
            href={landingAnchor("clarity", current)}
            className="transition-colors hover:text-foreground"
            data-testid="link-nav-clarity"
          >
            Clarity
          </a>
          <a
            href="/#/pricing"
            className="transition-colors hover:text-foreground"
            data-testid="link-nav-pricing"
          >
            Pricing
          </a>
          <a
            href={landingAnchor("faq", current)}
            className="transition-colors hover:text-foreground"
            data-testid="link-nav-faq"
          >
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            data-testid="button-theme"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-card/70 backdrop-blur-md transition-transform hover:-translate-y-px"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          <a
            href={getAppHref()}
            className="hidden h-11 items-center justify-center rounded-full border border-border/60 bg-card/70 px-5 text-sm font-semibold backdrop-blur-md transition-transform hover:-translate-y-px md:inline-flex"
            data-testid="link-header-cta"
          >
            Start with Sift
          </a>
        </div>
      </div>
    </header>
  );
}

// The shared marketing footer. Same nav rail used on the landing page,
// reused on /pricing so the pages feel like one site, not two.
export function LandingFooter({ current }: { current: "landing" | "other" }) {
  return (
    <footer
      className="relative z-[2] border-t border-border/60 py-10"
      style={{
        background: "color-mix(in srgb, hsl(var(--background)) 82%, transparent)",
      }}
    >
      <div className="mx-auto flex w-[min(1160px,calc(100vw-32px))] flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
        <a
          href={landingAnchor("what", current)}
          className="transition-colors hover:text-foreground"
          data-testid="link-footer-what"
        >
          What it is for
        </a>
        <a
          href={landingAnchor("how", current)}
          className="transition-colors hover:text-foreground"
          data-testid="link-footer-how"
        >
          How it works
        </a>
        <a
          href={landingAnchor("clarity", current)}
          className="transition-colors hover:text-foreground"
          data-testid="link-footer-clarity"
        >
          Clarity
        </a>
        <a
          href={landingAnchor("use-cases", current)}
          className="transition-colors hover:text-foreground"
          data-testid="link-footer-cases"
        >
          Use cases
        </a>
        <a
          href="/#/pricing"
          className="transition-colors hover:text-foreground"
          data-testid="link-footer-pricing"
        >
          Pricing
        </a>
        <a
          href={landingAnchor("faq", current)}
          className="transition-colors hover:text-foreground"
          data-testid="link-footer-faq"
        >
          FAQ
        </a>
      </div>
    </footer>
  );
}
