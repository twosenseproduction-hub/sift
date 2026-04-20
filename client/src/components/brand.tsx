import { Link } from "wouter";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-label="Sift"
      role="img"
    >
      {/* A sieve: stacked lines narrowing to a single drop */}
      <path
        d="M8 8h16M8 13h16M9 18h14M11 23h10M14 28h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Header() {
  const { theme, toggle } = useTheme();
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
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          data-testid="button-theme"
          className="hover-elevate p-2 rounded-md text-muted-foreground hover:text-foreground transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
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
