import { cn } from "@/lib/utils";

export type DailyPromptCardModel = {
  promptId: number;
  themeName: string;
  promptText: string;
  promptType?: string;
};

/**
 * Primary daily prompt surface for Sift Base — one tappable card from
 * `/api/daily-prompt`, styled with bedroom session tokens.
 */
export function DailyPromptCard({
  prompt,
  onSelect,
  disabled,
  active,
  className,
}: {
  prompt: DailyPromptCardModel;
  onSelect: (text: string) => void;
  disabled?: boolean;
  /** Composer already holds this prompt (email deep link, etc.). */
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(prompt.promptText)}
      data-testid="card-daily-prompt"
      className={cn(
        "group w-full max-w-[26rem] rounded-2xl border px-4 py-4 text-left shadow-[0_18px_44px_-34px_rgba(0,0,0,0.45)] backdrop-blur-md transition",
        "border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]/72",
        "hover:-translate-y-0.5 hover:bg-[color:var(--color-surface)]/92 hover:shadow-[var(--bedroom-tray-shadow)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]/35",
        active &&
          "border-[color:var(--color-primary)]/28 bg-[color:var(--color-surface)]/88 ring-1 ring-[color:var(--color-primary)]/18",
        disabled && "pointer-events-none opacity-45",
        className,
      )}
    >
      <p
        className="text-[10px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]"
        data-testid="text-daily-prompt-eyebrow"
      >
        Today from Sift
        <span className="text-[color:var(--color-text-muted)]/70"> · </span>
        {prompt.themeName}
      </p>
      <p
        className="mt-2.5 font-serif text-[17px] leading-snug tracking-[-0.02em] text-[color:var(--color-text)] sm:text-[18px]"
        data-testid="text-daily-prompt-body"
      >
        {prompt.promptText}
      </p>
      <p className="mt-3 text-[11px] text-[color:var(--color-text-muted)]">
        {active
          ? "In the composer — edit or send when ready."
          : "Tap to start with this prompt."}
      </p>
    </button>
  );
}

export function DailyPromptCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-full max-w-[26rem] animate-pulse rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]/45 px-4 py-4",
        className,
      )}
      aria-hidden
    >
      <div className="h-2.5 w-28 rounded bg-[color:var(--color-border-soft)]/80" />
      <div className="mt-3 space-y-2">
        <div className="h-3.5 w-full rounded bg-[color:var(--color-border-soft)]/60" />
        <div className="h-3.5 w-[88%] rounded bg-[color:var(--color-border-soft)]/50" />
      </div>
    </div>
  );
}
