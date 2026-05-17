import type { SiftRedundancyGateResult } from "@shared/schema";

export function RedundancyGateCard({
  gate,
  busy,
  onSomethingChanged,
  onKnowThis,
}: {
  gate: SiftRedundancyGateResult;
  busy: boolean;
  onSomethingChanged: () => void | Promise<void>;
  onKnowThis: () => void | Promise<void>;
}) {
  return (
    <section
      className="bedroom-paper rounded-2xl border border-[color:var(--color-walnut)]/11 bg-[color:var(--color-surface)]/78 px-3 py-3 shadow-[var(--bedroom-paper-shadow)] sm:px-4"
      aria-live="polite"
    >
      <p className="text-[13px] leading-snug text-[color:var(--color-text)] mb-3">
        {gate.redundancyGate.message}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={busy}
          className="flex-1 rounded-full bg-[color:var(--color-primary)] px-3 py-2 text-[12px] font-medium text-[color:var(--color-surface)] disabled:opacity-45"
          onClick={() => void onSomethingChanged()}
        >
          Something changed
        </button>
        <button
          type="button"
          disabled={busy}
          className="flex-1 rounded-full border border-[color:var(--color-primary)] bg-transparent px-3 py-2 text-[12px] font-medium text-[color:var(--color-primary)] disabled:opacity-45"
          onClick={() => void onKnowThis()}
        >
          I think I know this
        </button>
      </div>
    </section>
  );
}
