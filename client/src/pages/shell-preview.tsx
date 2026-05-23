import { useState } from "react";
import { Link } from "wouter";
import { Mic } from "lucide-react";
import { SiftBaseBackground } from "@/components/bedroom-session/sift-base-background";
import {
  SiftBottomNav,
  SIFT_BOTTOM_NAV_RESERVE,
  type SiftBottomNavVariant,
} from "@/components/sift-bottom-nav";
import { SiftShellHeader } from "@/components/sift-shell-header";
import type { SiftBaseVisualMode } from "@/components/onboarding/sift-onboarding-flow";
import { cn } from "@/lib/utils";

type PreviewScreen = "home" | "sift" | "library";

const SCREENS: { id: PreviewScreen; label: string }[] = [
  { id: "home", label: "Sift idle" },
  { id: "sift", label: "Active sift" },
  { id: "library", label: "Library" },
];

const VARIANTS: { id: SiftBottomNavVariant; label: string }[] = [
  { id: "fab", label: "FAB + pill" },
  { id: "pill", label: "Single pill" },
];

/**
 * Shell preview — bottom-centered nav + simplified header (no avatar/companion).
 * Review before wiring Home and Library.
 * Route: #/shell-preview
 */
export default function ShellPreviewPage() {
  const [mode, setMode] = useState<SiftBaseVisualMode>("dark");
  const [screen, setScreen] = useState<PreviewScreen>("home");
  const [variant, setVariant] = useState<SiftBottomNavVariant>("fab");
  const [navHiddenDuringSift, setNavHiddenDuringSift] = useState(true);
  const dark = mode === "dark";

  const navHidden = screen === "sift" && navHiddenDuringSift;

  return (
    <div
      className={cn(
        "bedroom-session sift-base-session relative min-h-[100dvh] overflow-x-hidden bg-[color:var(--color-bg)] text-[color:var(--color-text)]",
        mode === "light" && "sift-base-light-session",
      )}
    >
      <SiftBaseBackground mode={mode} />

      <PreviewControls
        dark={dark}
        mode={mode}
        screen={screen}
        variant={variant}
        navHiddenDuringSift={navHiddenDuringSift}
        onModeToggle={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
        onScreenChange={setScreen}
        onVariantChange={setVariant}
        onNavHiddenToggle={() => setNavHiddenDuringSift((v) => !v)}
      />

      <SiftShellHeader
        className="pointer-events-auto fixed inset-x-0 z-[30] px-4 sm:px-5 top-[calc(env(safe-area-inset-top,0px)+7.5rem)]"
        onSettingsClick={() => undefined}
      />

      <main
        className={cn(
          "relative z-10 flex min-h-[100dvh] flex-col pt-[calc(env(safe-area-inset-top,0px)+11rem)]",
          !navHidden && SIFT_BOTTOM_NAV_RESERVE,
        )}
      >
        {screen === "home" ? <HomeIdleMock dark={dark} /> : null}
        {screen === "sift" ? <ActiveSiftMock navHidden={navHidden} /> : null}
        {screen === "library" ? <LibraryMock /> : null}
      </main>

      <SiftBottomNav
        hidden={navHidden}
        variant={variant}
        activeTab={screen === "library" ? "library" : "sift"}
        onTabChange={(tab) => setScreen(tab === "library" ? "library" : "home")}
        onSiftClick={() => setScreen("sift")}
      />
    </div>
  );
}

function PreviewControls({
  dark,
  mode,
  screen,
  variant,
  navHiddenDuringSift,
  onModeToggle,
  onScreenChange,
  onVariantChange,
  onNavHiddenToggle,
}: {
  dark: boolean;
  mode: SiftBaseVisualMode;
  screen: PreviewScreen;
  variant: SiftBottomNavVariant;
  navHiddenDuringSift: boolean;
  onModeToggle: () => void;
  onScreenChange: (screen: PreviewScreen) => void;
  onVariantChange: (variant: SiftBottomNavVariant) => void;
  onNavHiddenToggle: () => void;
}) {
  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-2.5 py-1 font-serif text-[11px] transition",
      active
        ? dark
          ? "border-[rgba(120,200,110,0.28)] bg-black/20 text-[rgba(218,244,213,0.9)]"
          : "border-[#556b57]/28 bg-[#faf7f0] text-[#29261f]"
        : dark
          ? "border-[rgba(120,200,110,0.14)] text-[rgba(201,235,194,0.48)] hover:text-[rgba(218,244,213,0.78)]"
          : "border-[#556b57]/14 text-[#6e685d] hover:text-[#29261f]",
    );

  return (
    <div
      className={cn(
        "pointer-events-auto fixed inset-x-0 top-[max(env(safe-area-inset-top),0px)] z-[50] border-b px-3 py-2 backdrop-blur-md sm:px-4",
        dark
          ? "border-[rgba(120,200,110,0.12)] bg-[#1a3d28]/78"
          : "border-[#556b57]/12 bg-[#faf7f0]/92",
      )}
    >
      <div className="mx-auto flex max-w-[640px] flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p
              className={cn(
                "font-serif text-[10px] uppercase tracking-[0.28em]",
                dark ? "text-[rgba(195,240,190,0.48)]" : "text-[#556b57]/75",
              )}
            >
              Shell preview
            </p>
            <p
              className={cn(
                "font-serif text-[12px] italic",
                dark ? "text-[rgba(201,235,194,0.52)]" : "text-[#6e685d]",
              )}
            >
              Not deployed — review nav + header before shipping
            </p>
          </div>
          <Link href="/">
            <a
              className={cn(
                "font-serif text-[12px] underline-offset-4 hover:underline",
                dark ? "text-[rgba(201,235,194,0.58)]" : "text-[#556b57]",
              )}
            >
              Live app
            </a>
          </Link>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={onModeToggle} className={chip(false)}>
            {mode === "dark" ? "Light" : "Dark"}
          </button>
          {SCREENS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onScreenChange(s.id)}
              className={chip(screen === s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onVariantChange(v.id)}
              className={chip(variant === v.id)}
            >
              {v.label}
            </button>
          ))}
          <button type="button" onClick={onNavHiddenToggle} className={chip(navHiddenDuringSift)}>
            {navHiddenDuringSift ? "Hide nav in sift" : "Keep nav in sift"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HomeIdleMock({ dark }: { dark: boolean }) {
  return (
    <section
      className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center"
      aria-label="Sift idle preview"
    >
      <p
        className={cn(
          "font-serif text-[12px] uppercase tracking-[0.38em]",
          dark ? "text-[rgba(195,240,190,0.54)]" : "text-[#556b57]/80",
        )}
      >
        Sift
      </p>
      <div
        className={cn("mt-4 h-px w-10", dark ? "bg-[rgba(195,240,190,0.28)]" : "bg-[#7a5e49]/35")}
        aria-hidden
      />
      <h1
        className={cn(
          "mt-7 max-w-[340px] font-serif text-[40px] leading-[1.18] tracking-[-0.035em] sm:text-[46px]",
          dark ? "text-[rgba(218,244,213,0.9)]" : "text-[#29261f]",
        )}
      >
        What&apos;s on your mind right now?
      </h1>
      <p
        className={cn(
          "mt-5 font-serif text-[18px] italic tracking-[0.01em] sm:text-[20px]",
          dark ? "text-[rgba(201,235,194,0.58)]" : "text-[#6e685d]",
        )}
      >
        Start typing or paste something...
      </p>
      <p className="mt-10 max-w-xs text-[11px] leading-relaxed text-[color:var(--color-text-muted)]">
        Bottom nav visible. Top bar is wordmark + settings only — no avatar or companion chip.
      </p>
    </section>
  );
}

function ActiveSiftMock({ navHidden }: { navHidden: boolean }) {
  return (
    <div className="flex flex-1 flex-col px-4 pb-4 pt-6 sm:px-5">
      <p className="mb-3 text-center text-[11px] text-[color:var(--color-text-muted)]">
        {navHidden
          ? "Nav hidden while sift is active — composer owns the lower edge."
          : "Nav kept visible — chat card sits above it with extra bottom padding."}
      </p>
      <div
        className={cn(
          "mx-auto flex w-full max-w-[720px] flex-1 flex-col overflow-hidden rounded-3xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-[var(--bedroom-paper-shadow)]",
          navHidden ? "max-h-[min(72dvh,640px)]" : "max-h-[min(62dvh,560px)]",
        )}
      >
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <MockBubble role="user" text="I keep bouncing between three priorities and none of them feel finished." />
          <MockBubble
            role="sift"
            text="What I'm hearing is throughput pressure — not that the work is unclear, but that nothing has been allowed to finish."
          />
        </div>
        <div className="border-t border-[color:var(--color-border-soft)] p-3">
          <div className="flex items-end gap-2 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-alt)]/35 px-3 py-2">
            <p className="flex-1 py-1.5 text-left text-[14px] text-[color:var(--color-text-muted)]">
              Share anything that feels loud right now.
            </p>
            <button
              type="button"
              className="rounded-full p-2 text-[color:var(--color-text-muted)]"
              aria-label="Voice input"
            >
              <Mic className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockBubble({ role, text }: { role: "user" | "sift"; text: string }) {
  return (
    <div
      className={cn(
        "max-w-[88%] px-3.5 py-2.5 text-[14px] leading-relaxed",
        "rounded-[1rem] border border-[color:var(--color-walnut)]/11 bg-[color:var(--color-surface)]/80 text-[color:var(--color-text)]",
        role === "user" ? "ml-auto rounded-br-sm" : "mr-auto rounded-bl-sm",
      )}
    >
      {text}
    </div>
  );
}

function LibraryMock() {
  const items = [
    { title: "Launch sequencing", preview: "Next: Name the one blocker that unlocks the rest." },
    { title: "Conversation replay", preview: "Next: Send the two-sentence version, not the rehearsed one." },
    { title: "Too many open loops", preview: "Next: Pick one thread that changes the others if moved this week." },
  ];

  return (
    <div className="mx-auto w-full max-w-[560px] flex-1 px-4 pb-6 pt-4 sm:px-6">
      <section className="rounded-[2rem] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-4 shadow-[var(--bedroom-paper-shadow)] sm:p-6">
        <h1 className="font-serif text-3xl tracking-[-0.04em] text-[color:var(--color-text)]">
          Library
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-text-muted)]">
          Saved clarity — same shell tokens, bottom nav for wayfinding.
        </p>
        <ul className="mt-5 space-y-2">
          {items.map((item) => (
            <li
              key={item.title}
              className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-alt)]/25 px-4 py-3"
            >
              <p className="font-serif text-[17px] text-[color:var(--color-text)]">{item.title}</p>
              <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">{item.preview}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
