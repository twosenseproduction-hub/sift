import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, Home, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_SHELL_HEADER_COLUMN } from "@/components/app-shell";

/**
 * Primary bottom navigation: Home · Sift · Library.
 */
export function RoomBottomNav() {
  const [loc, setLocation] = useLocation();
  const homeActive = loc === "/companion";
  const siftActive = loc === "/" || loc === "";
  const libraryActive = loc.startsWith("/library");

  const openSift = () => {
    setLocation("/");
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("sift:home-reset"));
      window.dispatchEvent(new CustomEvent("sift:focus-composer"));
    }, 80);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      aria-label="Primary"
    >
      <div
        className={cn(
          "pointer-events-auto w-full rounded-t-[1.85rem] border-t border-teal-950/8 bg-[#fdf6e3]",
          "shadow-[0_-10px_36px_-14px_rgba(15,70,70,0.12)]",
        )}
      >
        <div
          className={cn(
            APP_SHELL_HEADER_COLUMN,
            "flex items-stretch justify-between gap-1 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2.5",
          )}
        >
          <Tab href="/companion" label="Home" active={homeActive} icon={<Home className="h-5 w-5" />} />
          <ActionTab label="Sift" active={siftActive} onClick={openSift} />
          <Tab href="/library" label="Library" active={libraryActive} icon={<BookOpen className="h-5 w-5" />} />
        </div>
      </div>
    </nav>
  );
}

function Tab({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: ReactNode;
}) {
  return (
    <Link href={href} className="flex-1 min-w-0">
      <a
        className={cn(
          "flex flex-col items-center justify-center gap-0.5 rounded-full py-1.5 transition-colors",
          active
            ? "text-teal-600"
            : "text-neutral-500 hover:text-neutral-600 hover:bg-teal-950/[0.04]",
        )}
        aria-current={active ? "page" : undefined}
      >
        <span className={cn("[&_svg]:shrink-0 [&_svg]:transition-colors", active ? "[&_svg]:stroke-[2.15]" : "[&_svg]:stroke-[1.65]")}>
          {icon}
        </span>
        <span
          className={cn(
            "text-[9px] font-semibold tracking-tight",
            active ? "text-teal-600" : "text-current",
          )}
        >
          {label}
        </span>
      </a>
    </Link>
  );
}

function ActionTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 transition-colors",
        active
          ? "text-teal-600"
          : "text-neutral-500 hover:text-neutral-600 hover:bg-teal-950/[0.04]",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Sparkles className={cn("h-5 w-5 shrink-0", active ? "fill-teal-600/10 stroke-[2.15]" : "stroke-[1.65]")} />
      <span className={cn("text-[9px] font-semibold tracking-tight", active ? "text-teal-600" : "text-current")}>
        {label}
      </span>
    </button>
  );
}
