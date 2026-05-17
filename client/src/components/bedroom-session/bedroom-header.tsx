import { Settings } from "lucide-react";
import { PrimaryTopNav } from "@/components/primary-top-nav";
import { cn } from "@/lib/utils";

export function BedroomHeader({
  className,
  companionLabel,
  status,
  avatarInitial,
  showIdentity = true,
  onBrandClick,
  onSettingsClick,
}: {
  className?: string;
  companionLabel?: string;
  status: "idle" | "listening";
  avatarInitial?: string;
  showIdentity?: boolean;
  /** e.g. reset session + focus composer */
  onBrandClick?: () => void;
  /** No-op stub by default — wire later. */
  onSettingsClick?: () => void;
}) {
  return (
    <header
      className={cn("bg-transparent py-2 sm:py-3", className)}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <PrimaryTopNav onSiftClick={onBrandClick} />

        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]/48 p-1 shadow-[0_14px_42px_-34px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          {showIdentity ? (
            <button
              type="button"
              onClick={() => onSettingsClick?.()}
              className="flex items-center gap-1.5 rounded-full px-1.5 py-0.5 transition hover:bg-[color:var(--color-text)]/[0.045]"
              title={companionLabel ?? "Companion"}
            >
              <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--color-text)]/[0.04] text-[10px] font-medium text-[color:var(--color-text-muted)]">
                {avatarInitial?.trim() ? avatarInitial.slice(0, 1).toUpperCase() : "·"}
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-2 ring-[color:var(--color-bg)]",
                    status === "listening" ? "bg-[color:var(--color-warm)]" : "bg-[color:var(--color-primary)]",
                  )}
                  aria-hidden
                />
              </span>
              <span className="hidden max-w-[5.5rem] truncate text-[10px] text-[color:var(--color-text-muted)] sm:inline">
                {companionLabel ?? "Here"}
              </span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onSettingsClick?.()}
            className="rounded-full p-1.5 text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-text)]/[0.05] hover:text-[color:var(--color-text)]"
            aria-label="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
