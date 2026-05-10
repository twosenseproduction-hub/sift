import { Link, useLocation } from "wouter";
import { Sparkles, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Primary mobile tabs — Sift / Threads / Garden. Styles mirror thread state pills
 * (threads.tsx): active uses primary border + tint; inactive is muted.
 */
export function AppBottomNav() {
  const [loc] = useLocation();
  const onSift = loc === "/" || loc === "";
  const onThreads = loc.startsWith("/threads");
  const onGarden = loc.startsWith("/garden");

  const tabClass = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[11px] font-medium tracking-wide transition-colors",
      active
        ? "text-primary border-t-2 border-primary -mt-px bg-primary/10"
        : "text-muted-foreground hover:text-foreground border-t-2 border-transparent",
    );

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-sm"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-3xl">
        <Link href="/">
          <a className={tabClass(onSift)} data-testid="nav-sift">
            <Sparkles className="h-4 w-4" aria-hidden />
            <span>Sift</span>
          </a>
        </Link>
        <Link href="/threads">
          <a className={tabClass(onThreads)} data-testid="nav-threads">
            <Bookmark className="h-4 w-4" aria-hidden />
            <span>Threads</span>
          </a>
        </Link>
        <Link href="/garden">
          <a className={tabClass(onGarden)} data-testid="nav-garden">
            <span className="text-base leading-none" aria-hidden>
              ◇
            </span>
            <span>Garden</span>
          </a>
        </Link>
      </div>
    </nav>
  );
}
