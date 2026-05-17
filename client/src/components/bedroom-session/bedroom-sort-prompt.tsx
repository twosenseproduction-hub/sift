import type { SortPromptPayload } from "@shared/schema";
import { cn } from "@/lib/utils";

/**
 * Thin placeholder for the deepening sort beat — lets the user skip so the thread can continue.
 */
export function BedroomSortPromptCard({
  className,
  payload,
  busy,
  onSkip,
}: {
  className?: string;
  payload: SortPromptPayload;
  busy: boolean;
  onSkip: () => void;
}) {
  return (
    <section
      className={cn(
        "bedroom-paper rounded-2xl border border-[color:var(--color-walnut)]/11 bg-[color:var(--color-surface)]/78 px-3 py-3 shadow-[var(--bedroom-paper-shadow)] sm:px-4",
        className,
      )}
      aria-label="Signal and noise practice"
    >
      <p className="text-[13px] leading-relaxed text-[color:var(--color-text)] mb-4">
        {payload.intro}
      </p>
      <ul className="mb-4 flex flex-wrap gap-2">
        {payload.items.map((item) => (
          <li
            key={item}
            className="rounded-full border border-[color:var(--color-walnut)]/11 bg-[color:var(--color-surface-alt)]/80 px-3 py-1 text-[11px] text-[color:var(--color-text-muted)]"
          >
            {item}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-[color:var(--color-text-muted)] mb-3">
        Full sorting lives here soon. Skip for now to keep chatting.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={onSkip}
        className="w-full rounded-full border border-[color:var(--color-primary)] bg-transparent py-2 text-[12px] font-medium text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)]/[0.07] disabled:opacity-45"
      >
        {busy ? "Working…" : "Skip practice"}
      </button>
    </section>
  );
}
