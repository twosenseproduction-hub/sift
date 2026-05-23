import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { BookOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type SiftNavTab = "sift" | "library";
export type SiftBottomNavVariant = "pill" | "fab";

/** Reserve space above the safe area when the bottom nav is visible. */
export const SIFT_BOTTOM_NAV_RESERVE =
  "pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-[calc(6.25rem+env(safe-area-inset-bottom))]";

function confirmLeavingUnsavedGuestSift() {
  try {
    if (typeof sessionStorage === "undefined") return true;
    if (!sessionStorage.getItem("sift.unsavedGuestSift")) return true;
  } catch {
    return true;
  }
  return window.confirm(
    "This Sift is only temporary right now. Leave without saving it?",
  );
}

export function SiftBottomNav({
  hidden = false,
  variant = "fab",
  onSiftClick,
  /** Preview/demo: drive active state without routing. */
  activeTab: controlledTab,
  onTabChange,
}: {
  hidden?: boolean;
  variant?: SiftBottomNavVariant;
  onSiftClick?: () => void;
  activeTab?: SiftNavTab;
  onTabChange?: (tab: SiftNavTab) => void;
}) {
  const [location, setLocation] = useLocation();
  const controlled = controlledTab != null && onTabChange != null;

  const siftActive = controlled
    ? controlledTab === "sift"
    : location === "/" || location === "" || location === "/sift";
  const libraryActive = controlled
    ? controlledTab === "library"
    : location.startsWith("/library");

  if (hidden) return null;

  const openLibrary = () => {
    if (controlled) {
      onTabChange!("library");
      return;
    }
    if ((location === "/sift" || location === "/" || location === "") && !confirmLeavingUnsavedGuestSift()) {
      return;
    }
    setLocation("/library");
  };

  const openSift = () => {
    if (controlled) {
      onTabChange!("sift");
      onSiftClick?.();
      return;
    }
    if (siftActive) {
      onSiftClick?.();
      return;
    }
    if (location.startsWith("/library") && !confirmLeavingUnsavedGuestSift()) return;
    window.dispatchEvent(new CustomEvent("sift:home-reset"));
    setLocation("/sift");
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("sift:focus-composer", { detail: { select: true } }));
    }, 80);
  };

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40"
      aria-label="Primary"
    >
      <div
        className={cn(
          "pointer-events-auto mx-auto flex max-w-lg items-end justify-center gap-2.5 px-4 sm:gap-3 sm:px-5",
          "pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-2",
        )}
      >
        {variant === "pill" ? (
          <div
            className={cn(
              "flex w-full max-w-[16rem] items-center justify-between gap-0.5 rounded-full border border-[color:var(--color-border-soft)]",
              "bg-[color:var(--color-surface)]/82 p-1 shadow-[0_16px_44px_-18px_rgba(0,0,0,0.35)] backdrop-blur-xl",
            )}
          >
            <NavTabButton
              label="Sift"
              active={siftActive}
              icon={<Sparkles className="h-[1.05rem] w-[1.05rem]" aria-hidden />}
              onClick={openSift}
              emphasized
            />
            <NavTabButton
              label="Library"
              active={libraryActive}
              icon={<BookOpen className="h-[1.05rem] w-[1.05rem]" aria-hidden />}
              onClick={openLibrary}
            />
          </div>
        ) : (
          <>
            <div
              className={cn(
                "flex shrink-0 items-stretch rounded-full border border-[color:var(--color-border-soft)]",
                "bg-[color:var(--color-surface)]/82 px-1.5 py-1.5 shadow-[0_16px_44px_-18px_rgba(0,0,0,0.35)] backdrop-blur-xl",
              )}
            >
              <NavTabButton
                label="Library"
                active={libraryActive}
                icon={<BookOpen className="h-[1.05rem] w-[1.05rem]" aria-hidden />}
                onClick={openLibrary}
                className="min-w-[5.5rem]"
              />
            </div>
            <button
              type="button"
              onClick={openSift}
              className={cn(
                "flex h-[3.35rem] w-[3.35rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-full",
                "border border-[color:var(--color-primary)]/25 bg-[color:var(--color-primary)] text-[color:var(--color-surface)]",
                "shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45)] transition hover:brightness-[1.03] active:scale-[0.98]",
                siftActive && "ring-2 ring-[color:var(--color-primary)]/30 ring-offset-2 ring-offset-[color:var(--color-bg)]",
              )}
              aria-current={siftActive ? "page" : undefined}
              aria-label="Sift"
            >
              <Sparkles className="h-5 w-5" aria-hidden />
              <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">
                Sift
              </span>
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

function NavTabButton({
  label,
  active,
  icon,
  onClick,
  emphasized = false,
  className,
}: {
  label: string;
  active: boolean;
  icon: ReactNode;
  onClick: () => void;
  emphasized?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 transition-colors",
        active
          ? "bg-[color:var(--color-text)]/[0.07] text-[color:var(--color-text)]"
          : "text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-text)]/[0.045] hover:text-[color:var(--color-text)]",
        emphasized && active && "font-medium",
        className,
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className="shrink-0 [&_svg]:stroke-[1.75]">{icon}</span>
      <span className="text-[9px] font-semibold tracking-tight">{label}</span>
    </button>
  );
}
