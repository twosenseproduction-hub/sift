import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

export function PrimaryTopNav({
  className,
  onSiftClick,
}: {
  className?: string;
  onSiftClick?: () => void;
}) {
  const [location, setLocation] = useLocation();
  const homeActive = location === "/" || location === "";
  const siftActive = location === "/sift";
  const libraryActive = location.startsWith("/library");

  const confirmLeavingUnsavedGuestSift = () => {
    try {
      if (typeof sessionStorage === "undefined") return true;
      if (!sessionStorage.getItem("sift.unsavedGuestSift")) return true;
    } catch {
      return true;
    }
    return window.confirm(
      "This Sift is only temporary right now. Leave without saving it?",
    );
  };

  const openHome = () => {
    if (location === "/sift" && !confirmLeavingUnsavedGuestSift()) return false;
    window.dispatchEvent(new CustomEvent("sift:home-reset"));
    return true;
  };

  const openSift = () => {
    if (siftActive) {
      onSiftClick?.();
      return;
    }

    setLocation("/sift");
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("sift:home-reset"));
      window.dispatchEvent(new CustomEvent("sift:focus-composer", { detail: { select: true } }));
    }, 80);
  };

  return (
    <nav
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]/74 p-1 shadow-[0_14px_42px_-32px_rgba(0,0,0,0.55)] backdrop-blur-xl",
        className,
      )}
      aria-label="Primary"
    >
      <PrimaryTopNavLink href="/" label="Home" active={homeActive} onClick={openHome} />
      <button
        type="button"
        onClick={openSift}
        className={primaryTopNavItemClass(siftActive)}
        aria-current={siftActive ? "page" : undefined}
      >
        Sift
      </button>
      <PrimaryTopNavLink
        href="/library"
        label="Library"
        active={libraryActive}
        onClick={() => {
          if (location === "/sift" && !confirmLeavingUnsavedGuestSift()) {
            return false;
          }
          return true;
        }}
      />
    </nav>
  );
}

function PrimaryTopNavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => boolean | void;
}) {
  return (
    <Link href={href}>
      <a
        className={primaryTopNavItemClass(active)}
        aria-current={active ? "page" : undefined}
        onClick={(event) => {
          const shouldContinue = onClick?.();
          if (shouldContinue === false) event.preventDefault();
        }}
      >
        {label}
      </a>
    </Link>
  );
}

function primaryTopNavItemClass(active: boolean) {
  return cn(
    "rounded-full px-3 py-1.5 text-[12px] font-medium tracking-[-0.01em] transition-colors sm:px-3.5",
    active
      ? "bg-[color:var(--color-text)]/[0.07] text-[color:var(--color-text)]"
      : "text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-text)]/[0.045] hover:text-[color:var(--color-text)]",
  );
}
