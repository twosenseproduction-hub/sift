export function BedroomSummaryPrompt({
  onRequestSummary,
  onDismiss,
  busy,
  phase,
}: {
  onRequestSummary: () => void;
  onDismiss: () => void;
  busy?: boolean;
  phase: "warmup" | "structured";
}) {
  if (phase === "warmup") return null;

  return (
    <div className="mx-3 mb-2 shrink-0 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]/90 px-3 py-2 shadow-[var(--bedroom-tray-shadow)] sm:mx-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[color:var(--color-text)]">
            Want me to pull this together?
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onRequestSummary}
            className="rounded-full bg-[color:var(--color-primary)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--color-surface)] transition hover:opacity-[0.96] disabled:opacity-45"
          >
            Summarize this
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            className="text-[11px] text-[color:var(--color-text-muted)] underline-offset-4 transition hover:text-[color:var(--color-text)] hover:underline disabled:opacity-45"
          >
            Not yet
          </button>
        </div>
      </div>
    </div>
  );
}
