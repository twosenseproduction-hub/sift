import { useEffect, useLayoutEffect, useRef } from "react";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_TA_HEIGHT = 120;
const MIN_TA_HEIGHT = 40;

export function SessionComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = "Share anything that feels loud right now.",
  onVoiceClick,
  onFocus,
  voiceListening = false,
  className,
  variant = "sticky",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  onVoiceClick: () => void;
  onFocus?: () => void;
  voiceListening?: boolean;
  className?: string;
  /** sticky: page footer tray. Embedded: bottom of conversation shell (non-sticky, no page gradient). */
  variant?: "sticky" | "embedded";
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = `${MIN_TA_HEIGHT}px`;
    const next = Math.min(Math.max(el.scrollHeight, MIN_TA_HEIGHT), MAX_TA_HEIGHT);
    el.style.height = `${next}px`;
  }, [value]);

  useEffect(() => {
    function onComposerFocus(e: Event) {
      const ce = e as CustomEvent<{ select?: boolean }>;
      window.setTimeout(() => {
        taRef.current?.focus();
        if (ce.detail?.select) taRef.current?.select();
      }, 0);
    }

    window.addEventListener(
      "sift:focus-composer",
      onComposerFocus as EventListener,
    );
    return () =>
      window.removeEventListener(
        "sift:focus-composer",
        onComposerFocus as EventListener,
      );
  }, []);

  const trimmed = value.trim();
  const primaryLabel = trimmed.length ? "Send" : "Start a sift";

  const isEmbedded = variant === "embedded";

  return (
    <div
      className={cn(
        "pointer-events-none",
        isEmbedded
          ? "bedroom-composer-embedded shrink-0 w-full border-t border-[color:var(--color-border-soft)] px-2 pb-2 pt-2 sm:px-3"
          : "bedroom-writing-tray sticky bottom-0 z-10 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-0.5",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-auto mx-auto flex w-full items-end gap-2 rounded-2xl border border-[color:var(--color-walnut)]/11 bg-[color:var(--color-surface)]/82 px-2 py-1.5 shadow-[var(--bedroom-tray-shadow)] backdrop-blur-[5px]",
          !isEmbedded && "max-w-[640px]",
        )}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={onVoiceClick}
          className={cn(
            "mb-[1px] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-45",
            voiceListening
              ? "border-[color:var(--color-primary)]/35 bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]"
              : "border-[color:var(--color-walnut)]/11 bg-transparent text-[color:var(--color-text-muted)] hover:border-[color:var(--color-walnut)]/18 hover:bg-[color:var(--color-text)]/[0.04] hover:text-[color:var(--color-text)]",
          )}
          aria-label={voiceListening ? "Stop voice input" : "Start voice input"}
          aria-pressed={voiceListening}
        >
          <Mic className="h-3.5 w-3.5 stroke-[1.75]" />
        </button>

        <textarea
          ref={taRef}
          value={value}
          disabled={disabled}
          rows={1}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (!disabled && trimmed) onSubmit();
            }
          }}
          placeholder={placeholder}
          className="min-h-[40px] max-h-[120px] min-w-0 flex-1 resize-none bg-transparent py-2 pl-0.5 pr-1 text-[15px] leading-[1.4] text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)] focus:outline-none focus:ring-0 disabled:opacity-55"
          data-testid="bedroom-composer-input"
        />

        <button
          type="button"
          disabled={disabled || !trimmed}
          onClick={() => trimmed && onSubmit()}
          className="mb-[1px] shrink-0 rounded-full bg-[color:var(--color-primary)] px-3.5 py-1.5 text-[12px] font-medium text-[color:var(--color-surface)] shadow-sm transition hover:opacity-[0.96] disabled:opacity-45"
          data-testid="button-sift"
        >
          {primaryLabel}
        </button>
      </div>
      <p
        className={cn(
          "mx-auto mt-1.5 text-center text-[9px] text-[color:var(--color-text-muted)]/90",
          isEmbedded ? "w-full" : "max-w-[640px]",
        )}
      >
        {voiceListening ? "Listening..." : "⌘ Enter to send"}
      </p>
    </div>
  );
}
