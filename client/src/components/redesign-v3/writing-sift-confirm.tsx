import { cn } from "@/lib/utils";

export function WritingSiftConfirm({
  onMeetAsWriting,
  onNormalSift,
  disabled,
  className,
}: {
  onMeetAsWriting: () => void;
  onNormalSift: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "v3-writing-confirm rounded-[1rem] border border-[color:var(--v3-border)] bg-[color:var(--v3-surface-elevated)] px-4 py-4",
        className,
      )}
      role="region"
      aria-label="Writing Sift confirmation"
    >
      <p className="text-[14px] font-light leading-relaxed text-[color:var(--v3-text-primary)]">
        This feels more like writing than a problem to solve. Want me to meet it
        as a piece?
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onMeetAsWriting}
          className="v3-btn-primary text-[13px] disabled:opacity-45"
        >
          Meet it as writing
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onNormalSift}
          className="v3-starter-chip disabled:opacity-45"
        >
          Use normal Sift
        </button>
      </div>
    </div>
  );
}
