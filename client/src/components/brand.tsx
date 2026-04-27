import { useState } from "react";
import { Link } from "wouter";
import { Moon, Sun, Archive, LogOut, User as UserIcon } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useMe, useLogout } from "@/lib/auth";
import { AuthDialog } from "./auth-dialog";
import { CareScreen } from "./care-screen";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Brand lockup (icon + wordmark). The colored version reads on light
// surfaces; the light gray version reads on dark surfaces. Both PNGs
// already include the wordmark, so callers should NOT render a
// separate "Sift" text next to this component.
//
// `size` controls the rendered HEIGHT in px. The native asset is
// 600×253 (≈2.37:1) so width is set automatically.
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <>
      <img
        src="/sift-logo-colored-new.png"
        alt="Sift"
        height={size}
        style={{ height: size, width: "auto" }}
        className="block dark:hidden select-none"
        draggable={false}
      />
      <img
        src="/sift-logo-new.png"
        alt="Sift"
        height={size}
        style={{ height: size, width: "auto" }}
        className="hidden dark:block select-none"
        draggable={false}
      />
    </>
  );
}

// Icon-only mark, for places where the wordmark would be redundant
// (e.g. directly above the giant "Sift helps you find" headline on
// the landing hero). Inherits color from currentColor so it plays
// nicely with theme tokens — still SVG, not PNG.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-label="Sift"
      role="img"
    >
      <rect x="5" y="9" width="22" height="1.8" rx="0.9" />
      <rect x="7" y="13" width="18" height="2.1" rx="1.05" />
      <rect x="9.5" y="17" width="13" height="2.1" rx="1.05" />
      <rect x="12" y="21" width="7" height="1.8" rx="0.9" />
      <circle cx="14.5" cy="25.5" r="1.05" />
    </svg>
  );
}

export function Header() {
  const { theme, toggle } = useTheme();
  const { data } = useMe();
  const logout = useLogout();
  const [authOpen, setAuthOpen] = useState(false);
  const me = data?.me;

  return (
    <header className="w-full">
      <div className="mx-auto max-w-3xl px-6 md:px-8 py-6 flex items-center justify-between">
        <Link href="/" data-testid="link-home">
          <a
            className="flex items-center gap-2.5 group"
            onClick={() => {
              // Home owns its own flow/result state. If we're already on the
              // home route the <Link> is a no-op and that state would persist,
              // leaving the user on a stale result. Fire a small event so
              // Home can reset to the idle composer.
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("sift:home-reset"));
              }
            }}
          >
            <Logo size={32} />
          </a>
        </Link>

        <div className="flex items-center gap-1">
          {me ? (
            <>
              <Link href="/history" data-testid="link-history">
                <a className="hover-elevate inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Archive className="w-4 h-4" />
                  <span className="hidden sm:inline">History</span>
                </a>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="hover-elevate inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-account"
                    aria-label="Account"
                  >
                    <UserIcon className="w-4 h-4" />
                    <span className="hidden sm:inline font-mono text-xs">@{me.handle}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[180px]">
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Signed in as <span className="font-mono">@{me.handle}</span>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => logout.mutate()}
                    data-testid="menuitem-logout"
                    className="gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="hover-elevate inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-signin"
            >
              Sign in
            </button>
          )}

          <button
            onClick={toggle}
            aria-label="Toggle theme"
            data-testid="button-theme"
            className="hover-elevate p-2 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode="signup" />
    </header>
  );
}

export function Footnote() {
  const [careOpen, setCareOpen] = useState(false);
  return (
    <>
      <div className="mx-auto max-w-3xl px-6 md:px-8 py-10 text-center">
        <p className="text-xs text-muted-foreground">
          Sift is a quiet tool. It won't replace your thinking — it helps you find it.
        </p>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setCareOpen(true)}
            data-testid="link-in-crisis"
            className="text-xs text-muted-foreground/80 hover:text-foreground underline underline-offset-4 decoration-border/70 hover:decoration-foreground transition-colors"
          >
            In crisis?
          </button>
        </div>
      </div>
      <Dialog open={careOpen} onOpenChange={setCareOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">Crisis resources</DialogTitle>
          <DialogDescription className="sr-only">
            Free, confidential lines available anytime if you or someone near
            you is in crisis.
          </DialogDescription>
          <div className="px-6 md:px-8 pb-8">
            <CareScreen
              informational
              onClose={() => setCareOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
