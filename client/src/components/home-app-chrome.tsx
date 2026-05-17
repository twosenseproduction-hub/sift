import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, Home, LogOut, Settings, Shield, Sparkles } from "lucide-react";
import { CareScreen } from "@/components/care-screen";
import { PrimaryTopNav } from "@/components/primary-top-nav";
import { APP_SHELL_HEADER_COLUMN } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMe, useLogout } from "@/lib/auth";
import { useResume } from "@/lib/resume";
import { pickConversationSiftId } from "@/lib/pickConversationSift";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { SiftListItem } from "@shared/schema";

/** Bottom safe-area padding when `HomeBottomNav` is fixed — pair with `footer={null}` on `AppShell`. */
export const TAB_BAR_CONTENT_PADDING =
  "pb-[calc(8rem+env(safe-area-inset-bottom))] md:pb-[calc(9rem+env(safe-area-inset-bottom))]";

function initialsFromHandle(handle: string): string {
  const t = handle.trim().replace(/^@/, "");
  if (!t) return "?";
  const letters = t.replace(/[^a-zA-Z0-9]/g, "");
  if (letters.length >= 2) return (letters[0] + letters[1]).toUpperCase();
  return t.slice(0, 2).toUpperCase();
}

export function HomeTopBar({
  onRequestSignIn,
  variant = "default",
}: {
  onRequestSignIn: () => void;
  variant?: "default" | "journal" | "room" | "roomCozy";
}) {
  const { data } = useMe();
  const logout = useLogout();
  const me = data?.me;
  const [open, setOpen] = useState(false);
  const [careOpen, setCareOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [me?.id]);

  return (
    <header className="w-full">
      <div
        className={cn(
          APP_SHELL_HEADER_COLUMN,
          variant === "journal"
            ? "py-2 md:py-3 flex flex-col gap-2"
            : "py-3 md:py-4 flex items-center justify-between gap-3",
        )}
      >
        <PrimaryTopNav />

        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]/58 text-[color:var(--color-text-muted)] shadow-[0_14px_42px_-34px_rgba(0,0,0,0.55)] backdrop-blur-xl transition hover:bg-[color:var(--color-surface)]/78 hover:text-[color:var(--color-text)]",
            variant === "room" && "border-white/25 bg-white/15 text-white hover:bg-white/25 hover:text-white",
          )}
          aria-label="Settings"
          data-testid="button-home-settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-[1.75rem] border-t border-border/50 px-6 pb-10 pt-2 shadow-[0_-20px_48px_-12px_rgba(30,25,18,0.12)]">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" aria-hidden />
          <SheetHeader className="text-left pb-2 space-y-1">
            <SheetTitle className="font-serif text-xl">Settings</SheetTitle>
            <p className="text-sm text-muted-foreground font-normal leading-snug">
              Account and quiet preferences.
            </p>
          </SheetHeader>

          <nav className="flex flex-col gap-1 pt-4" aria-label="Settings">
            {me ? (
              <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/25 px-4 py-3 mb-3">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    "bg-primary text-primary-foreground text-xs font-semibold",
                  )}
                  aria-hidden
                >
                  {initialsFromHandle(me.handle)}
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Signed in</p>
                  <p className="font-mono text-sm text-foreground truncate">
                    @{me.handle}
                  </p>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                className="w-full justify-center mb-2"
                onClick={() => {
                  setOpen(false);
                  onRequestSignIn();
                }}
                data-testid="button-settings-signin"
              >
                Sign in or create account
              </Button>
            )}

            <Link href="/privacy">
              <a
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
                data-testid="link-settings-privacy"
              >
                <Shield className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
                Privacy
              </a>
            </Link>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setCareOpen(true);
              }}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-left text-foreground hover:bg-muted/60 transition-colors"
              data-testid="link-settings-crisis"
            >
              In crisis?
            </button>

            {me ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  logout.mutate();
                }}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors mt-1"
                data-testid="button-settings-signout"
              >
                <LogOut className="w-4 h-4 shrink-0" aria-hidden />
                Sign out
              </button>
            ) : null}
          </nav>

          <p className="mt-8 text-center text-[11px] text-muted-foreground/80 leading-relaxed px-2">
            Sift won&apos;t replace your thinking — it helps you sort signal from noise and name one next step.
          </p>
        </SheetContent>
      </Sheet>

      <Dialog open={careOpen} onOpenChange={setCareOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">Crisis resources</DialogTitle>
          <DialogDescription className="sr-only">
            Free, confidential lines available anytime if you or someone near you is in crisis.
          </DialogDescription>
          <div className="px-6 md:px-8 pb-8">
            <CareScreen informational onClose={() => setCareOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}

function NavItem({
  href,
  active,
  icon,
  label,
  testId,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  label: string;
  testId: string;
}) {
  return (
    <Link href={href} data-testid={testId}>
      <a
        className={cn(
          "flex flex-none flex-col items-center justify-center gap-1 rounded-xl py-2 px-3 sm:px-4 min-w-[4.25rem] sm:min-w-[4.75rem]",
          "transition-all duration-200 ease-smooth",
          active
            ? "text-foreground bg-background/95 shadow-md shadow-black/[0.08] ring-1 ring-black/[0.05] dark:ring-white/[0.08]"
            : "text-muted-foreground hover:text-foreground hover:bg-background/55",
        )}
      >
        <span className="shrink-0 [&_svg]:w-[1.125rem] [&_svg]:h-[1.125rem]">{icon}</span>
        <span className="text-[10px] sm:text-[11px] font-medium tracking-tight truncate max-w-full">
          {label}
        </span>
      </a>
    </Link>
  );
}

export function HomeBottomNav({
  onSiftFab,
}: {
  /**
   * Home / companion: flow-aware handler (reset result, then open conversation or focus composer).
   * Other routes: FAB opens `/s/:id/chat` when an open thread exists, else home + composer.
   */
  onSiftFab?: () => void;
}) {
  const [location, setLocation] = useLocation();
  const resume = useResume();
  const { data: meData } = useMe();
  const me = meData?.me;
  const { data: siftsData } = useQuery<{ sifts: SiftListItem[] }>({
    queryKey: ["/api/sifts"],
    enabled: !!me,
  });

  const isSiftChatRoute = /\/s\/[^/]+\/chat\/?$/.test(location);

  const homeActive = location === "/companion";
  const siftActive = location === "/" || location === "";
  const libraryActive = location.startsWith("/library");

  if (isSiftChatRoute) return null;

  const handleFab = () => {
    if ((homeActive || siftActive) && onSiftFab) {
      onSiftFab();
      return;
    }
    const chatId = pickConversationSiftId(resume, siftsData?.sifts);
    if (chatId) {
      setLocation(`/s/${chatId}/chat`);
      return;
    }
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
          APP_SHELL_HEADER_COLUMN,
          "pointer-events-auto flex items-end justify-center gap-3 md:gap-4",
          "pb-[max(1rem,env(safe-area-inset-bottom))] pt-3",
        )}
      >
        <div
          className={cn(
            "flex flex-1 items-stretch justify-between gap-0.5 sm:gap-1 rounded-full border border-border/45",
            "bg-background/88 dark:bg-card/92 backdrop-blur-xl",
            "shadow-[0_12px_40px_-10px_rgba(30,25,18,0.14)] dark:shadow-[0_14px_44px_-8px_rgba(0,0,0,0.55)]",
            "ring-1 ring-black/[0.04] dark:ring-white/[0.07]",
            "px-2 py-2 max-w-lg",
          )}
        >
          <NavItem
            href="/companion"
            active={homeActive}
            icon={<Home aria-hidden />}
            label="Home"
            testId="nav-home-bottom"
          />
          <NavItem
            href="/library"
            active={libraryActive}
            icon={<BookOpen aria-hidden />}
            label="Library"
            testId="nav-library-bottom"
          />
        </div>

        <button
          type="button"
          onClick={handleFab}
          className={cn(
            "shrink-0 flex flex-col items-center justify-center gap-1 rounded-full",
            "h-[3.25rem] w-[3.25rem] sm:h-14 sm:w-14",
            "bg-primary text-primary-foreground shadow-xl shadow-primary/30",
            "ring-2 ring-primary/15 ring-offset-2 ring-offset-background/80",
            "hover:brightness-[1.03] active:scale-[0.98] transition-all duration-200 ease-smooth",
            "border border-primary-border",
          )}
          aria-label="Sift — conversation or composer"
          aria-current={siftActive ? "page" : undefined}
          data-testid="button-sift-fab"
        >
          <Sparkles className="w-5 h-5 sm:w-[1.35rem] sm:h-[1.35rem]" aria-hidden />
          <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide leading-none">
            Sift
          </span>
        </button>
      </div>
    </nav>
  );
}
