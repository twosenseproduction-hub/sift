import { cn } from "@/lib/utils";
import type { DailyPromptCardModel } from "@/components/bedroom-session/daily-prompt-card";

export function DailyPromptCardV3({
  prompt,
  onSelect,
  disabled,
  active,
  className,
}: {
  prompt: DailyPromptCardModel;
  onSelect: (text: string) => void;
  disabled?: boolean;
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
        "v3-daily-prompt-card group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--v3-sage)]/35",
        active && "ring-1 ring-[color:var(--v3-sage)]/25 border-[color:var(--v3-border-hover)]",
        disabled && "pointer-events-none opacity-45",
        className,
      )}
    >
      <p className="v3-daily-prompt-eyebrow" data-testid="text-daily-prompt-eyebrow">
        Today from Sift
        <span className="opacity-70"> · </span>
        {prompt.themeName}
      </p>
      <p className="v3-daily-prompt-body" data-testid="text-daily-prompt-body">
        {prompt.promptText}
      </p>
      <p className="mt-3 text-[11px] text-[color:var(--v3-text-muted)]">
        {active ? "In the composer — edit or send when ready." : "Tap to start with this prompt."}
      </p>
    </button>
  );
}

export function DailyPromptCardV3Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "v3-daily-prompt-card animate-pulse pointer-events-none opacity-70",
        className,
      )}
      aria-hidden
    >
      <div className="h-2.5 w-32 rounded bg-[color:var(--v3-border)]" />
      <div className="mt-4 space-y-2">
        <div className="h-4 w-full rounded bg-[color:var(--v3-border)]/80" />
        <div className="h-4 w-[90%] rounded bg-[color:var(--v3-border)]/60" />
      </div>
    </div>
  );
}
