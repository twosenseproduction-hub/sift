import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LogOut, Shield } from "lucide-react";
import { useMe, useLogout } from "@/lib/auth";
import { AuthDialog } from "./auth-dialog";
import { CareScreen } from "./care-screen";
import { cn } from "@/lib/utils";
import { APP_SHELL_HEADER_COLUMN } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
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


function handleInitials(handle: string): string {
  const t = handle.trim().replace(/^@/, "");
  if (!t) return "?";
  const letters = t.replace(/[^a-zA-Z0-9]/g, "");
  if (letters.length >= 2) return (letters[0] + letters[1]).toUpperCase();
  return t.slice(0, 2).toUpperCase();
}

// Brand lockup (icon + wordmark). The colored version reads on light
// surfaces; the light gray version reads on dark surfaces. Both PNGs
// already include the wordmark, so callers should NOT render a
// separate "Sift" text next to this component.
//
// `size` controls the rendered HEIGHT in px. The native asset is
// 600×253 (≈2.37:1) so width is set automatically.
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/sift-logo-colored.png"
      alt="Sift"
      height={size}
      style={{ height: size, width: "auto" }}
      className="block select-none"
      draggable={false}
    />
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
  const { data } = useMe();
  const logout = useLogout();
  const [, setLocation] = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const me = data?.me;

  return (
    <header className="w-full">
      <div
        className={cn(
          APP_SHELL_HEADER_COLUMN,
          "py-4 md:py-5 flex items-center justify-between gap-3",
        )}
      >
        <Link href="/" data-testid="link-home">
          <a
            className="flex items-center gap-2.5 group min-w-0"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("sift:home-reset"));
              }
            }}
          >
            <Logo size={32} />
          </a>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {me ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    "bg-primary text-primary-foreground text-xs font-semibold tracking-tight",
                    "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "hover-elevate",
                  )}
                  data-testid="button-account"
                  aria-label={`Account, signed in as @${me.handle}`}
                >
                  {handleInitials(me.handle)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Signed in as <span className="font-mono text-foreground">@{me.handle}</span>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLocation("/privacy")}
                  data-testid="menuitem-privacy"
                  className="gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Privacy
                </DropdownMenuItem>
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
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => setAuthOpen(true)}
              data-testid="button-signin"
            >
              Sign in
            </Button>
          )}
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
      <div className={cn(APP_SHELL_HEADER_COLUMN, "py-10 text-center")}>
        <p className="text-xs text-muted-foreground">
          Sift is a quiet tool. It won't replace your thinking — it helps you find it.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/privacy">
            <a
              className="text-xs text-muted-foreground/80 hover:text-foreground underline underline-offset-4 decoration-border/70 hover:decoration-foreground transition-colors"
              data-testid="link-footnote-privacy"
            >
              Privacy
            </a>
          </Link>
          <span aria-hidden className="hidden sm:inline text-muted-foreground/30">
            ·
          </span>
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
