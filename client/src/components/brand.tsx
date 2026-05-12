import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Moon, Sun, LogOut, Bookmark, BookOpen, Shield, Menu } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useMe, useLogout } from "@/lib/auth";
import { AuthDialog } from "./auth-dialog";
import { CareScreen } from "./care-screen";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

type WorkspaceKey = "threads" | "garden" | "field-notes";

function activeWorkspaceSegment(path: string): WorkspaceKey | null {
  if (path === "/threads" || path.startsWith("/thread/") || path === "/history") return "threads";
  if (path === "/garden") return "garden";
  if (path === "/field-notes") return "field-notes";
  return null;
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
    <>
      <img
        src="/sift-logo-colored.png"
        alt="Sift"
        height={size}
        style={{ height: size, width: "auto" }}
        className="block dark:hidden select-none"
        draggable={false}
      />
      <img
        src="/sift-logo-light.png"
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

function WorkspaceSegmentLink({
  href,
  active,
  children,
  "data-testid": testId,
  icon,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
  "data-testid"?: string;
  icon?: ReactNode;
}) {
  return (
    <Link href={href} data-testid={testId}>
      <a
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-md px-2 sm:px-2.5 py-1 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap",
          active
            ? "bg-background text-foreground border border-border/50"
            : "text-muted-foreground hover:text-foreground border border-transparent",
        )}
      >
        {icon}
        {children}
      </a>
    </Link>
  );
}

export function Header() {
  const { theme, toggle } = useTheme();
  const { data } = useMe();
  const logout = useLogout();
  const [location, setLocation] = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const me = data?.me;
  const workspaceActive = activeWorkspaceSegment(location);

  useEffect(() => {
    setWorkspaceOpen(false);
  }, [location]);

  return (
    <header className="w-full">
      <div className="mx-auto max-w-3xl px-6 md:px-8 py-4 md:py-5 flex items-center justify-between gap-3">
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
            <>
              <div
                className="hidden md:inline-flex items-center rounded-lg border border-border/60 bg-muted/35 p-0.5 gap-0.5"
                role="navigation"
                aria-label="Workspace"
              >
                <WorkspaceSegmentLink
                  href="/threads"
                  active={workspaceActive === "threads"}
                  data-testid="link-threads"
                  icon={<Bookmark className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-80" aria-hidden />}
                >
                  Threads
                </WorkspaceSegmentLink>
                <WorkspaceSegmentLink
                  href="/garden"
                  active={workspaceActive === "garden"}
                  data-testid="link-garden"
                  icon={
                    <span className="text-sm leading-none select-none opacity-80" aria-hidden>
                      ◇
                    </span>
                  }
                >
                  Garden
                </WorkspaceSegmentLink>
                <WorkspaceSegmentLink
                  href="/field-notes"
                  active={workspaceActive === "field-notes"}
                  data-testid="link-field-notes"
                  icon={<BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-80" aria-hidden />}
                >
                  Notes
                </WorkspaceSegmentLink>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="md:hidden h-9 w-9 shrink-0"
                aria-label="Open workspace navigation"
                data-testid="button-workspace-menu"
                onClick={() => setWorkspaceOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>

              <Sheet open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
                <SheetContent side="bottom" className="rounded-t-xl">
                  <SheetHeader className="text-left pb-2">
                    <SheetTitle className="text-base">Workspace</SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col gap-1 pt-2" aria-label="Workspace">
                    <Link href="/threads" data-testid="link-threads-mobile">
                      <a
                        onClick={() => setWorkspaceOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                          workspaceActive === "threads"
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <Bookmark className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
                        Threads
                      </a>
                    </Link>
                    <Link href="/garden" data-testid="link-garden-mobile">
                      <a
                        onClick={() => setWorkspaceOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                          workspaceActive === "garden"
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <span className="w-4 text-center text-base leading-none select-none opacity-80" aria-hidden>
                          ◇
                        </span>
                        Garden
                      </a>
                    </Link>
                    <Link href="/field-notes" data-testid="link-field-notes-mobile">
                      <a
                        onClick={() => setWorkspaceOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                          workspaceActive === "field-notes"
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <BookOpen className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
                        Field notes
                      </a>
                    </Link>
                  </nav>
                </SheetContent>
              </Sheet>

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
            </>
          ) : (
            <>
              <Link href="/field-notes" data-testid="link-field-notes-signed-out">
                <a
                  aria-label="Field notes"
                  className="hover-elevate inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <BookOpen className="w-4 h-4 shrink-0" aria-hidden />
                  <span className="sm:hidden">Notes</span>
                  <span className="hidden sm:inline">Field notes</span>
                </a>
              </Link>
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
            </>
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
          <Link href="/field-notes">
            <a
              className="text-xs text-muted-foreground/80 hover:text-foreground underline underline-offset-4 decoration-border/70 hover:decoration-foreground transition-colors"
              data-testid="link-footnote-field-notes"
            >
              Field notes
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
