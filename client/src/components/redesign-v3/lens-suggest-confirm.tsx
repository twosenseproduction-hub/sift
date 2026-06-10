import type { SiftLens } from "@shared/schema";
import { cn } from "@/lib/utils";

export function LensSuggestConfirm({
  suggestLens,
  disabled,
  onUseSuggested,
  onKeepCurrent,
  className,
}: {
  suggestLens: "writer" | "operator";
  disabled?: boolean;
  onUseSuggested: () => void;
  onKeepCurrent: () => void;
  className?: string;
}) {
  const copy =
    suggestLens === "writer"
      ? {
          body: "This feels more like writing than a problem to solve. Want me to meet it as a piece?",
          primary: "Meet it as writing",
          secondary: "Use current lens",
        }
      : {
          body: "This feels more operational than personal. Want an Operator Sift?",
          primary: "Use Operator",
          secondary: "Stay in current lens",
        };

  return (
    <div
      className={cn(
        "v3-lens-suggest rounded-[1rem] border border-[color:var(--v3-border)] bg-[color:var(--v3-surface-elevated)] px-4 py-4",
        className,
      )}
      data-testid={`lens-suggest-${suggestLens}`}
      role="status"
    >
      <p className="m-0 text-[14px] font-light leading-relaxed text-[color:var(--v3-text-primary)]">
        {copy.body}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          className="v3-sift-btn"
          onClick={onUseSuggested}
        >
          {copy.primary}
        </button>
        <button
          type="button"
          disabled={disabled}
          className="v3-starter-chip"
          onClick={onKeepCurrent}
        >
          {copy.secondary}
        </button>
      </div>
    </div>
  );
}
