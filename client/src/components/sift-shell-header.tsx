import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import { LogoMark } from "@/components/brand";
import { cn } from "@/lib/utils";

/**
 * Minimal top chrome for the Sift Base shell — wordmark + settings only.
 * Primary navigation lives in {@link SiftBottomNav}.
 */
export function SiftShellHeader({
  className,
  onSettingsClick,
  settingsTestId = "button-settings",
  centerSlot,
}: {
  className?: string;
  onSettingsClick?: () => void;
  settingsTestId?: string;
  centerSlot?: ReactNode;
}) {
  return (
    <header className={cn("sift-shell-header bg-transparent py-2 sm:py-3", className)}>
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <div
          className="flex items-center gap-2 text-[color:var(--color-text)]"
          aria-label="Sift"
        >
          <LogoMark size={22} />
          <span className="font-serif text-[17px] tracking-[-0.03em]">Sift</span>
        </div>

        {centerSlot ? (
          <div className="flex flex-1 justify-center">{centerSlot}</div>
        ) : (
          <div className="flex-1" />
        )}

        <button
          type="button"
          onClick={() => onSettingsClick?.()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]/58 text-[color:var(--color-text-muted)] shadow-[0_14px_42px_-34px_rgba(0,0,0,0.55)] backdrop-blur-xl transition hover:bg-[color:var(--color-surface)]/78 hover:text-[color:var(--color-text)]"
          aria-label="Settings"
          data-testid={settingsTestId}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
