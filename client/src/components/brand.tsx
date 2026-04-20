import { useState } from "react";
import { Link } from "wouter";
import { Moon, Sun, Archive, LogOut, User as UserIcon } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useMe, useLogout } from "@/lib/auth";
import { AuthDialog } from "./auth-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function Logo({ size = 28 }: { size?: number }) {
  // Cyclone mark: four tapering horizontal strokes that sweep into a funnel,
  // with a single dot at the tip. The geometry is arranged so each row is
  // narrower than the one above it, and the left edge steps inward — reading
  // as wind shearing into a single point. Uses currentColor so it inherits
  // from the header's text/hover state.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-label="Sift"
      role="img"
    >
      {/* Row 1 — widest, thinnest */}
      <rect x="5" y="9" width="22" height="1.8" rx="0.9" />
      {/* Row 2 — slightly inset, thicker */}
      <rect x="7" y="13" width="18" height="2.1" rx="1.05" />
      {/* Row 3 — narrower, thicker still */}
      <rect x="9.5" y="17" width="13" height="2.1" rx="1.05" />
      {/* Row 4 — short tail */}
      <rect x="12" y="21" width="7" height="1.8" rx="0.9" />
      {/* Tip dot */}
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
          <a className="flex items-center gap-2.5 group">
            <span className="text-foreground/90 group-hover:text-primary transition-colors">
              <Logo />
            </span>
            <span className="font-serif text-xl tracking-tight">Sift</span>
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
  return (
    <div className="mx-auto max-w-3xl px-6 md:px-8 py-10 text-center">
      <p className="text-xs text-muted-foreground">
        Sift is a quiet tool. It won't replace your thinking — it helps you find it.
      </p>
    </div>
  );
}
