import type { OperatorLensArtifact } from "@shared/schema";
import { cn } from "@/lib/utils";

const SECTIONS: {
  key: keyof Omit<OperatorLensArtifact, "lens">;
  label: string;
}[] = [
  { key: "coreIssue", label: "Core issue" },
  { key: "drag", label: "Drag" },
  { key: "bottleneck", label: "Bottleneck" },
  { key: "nextDecisiveMove", label: "Next decisive move" },
];

const FOLLOW_UP_CHIPS = [
  { id: "clarify", label: "Clarify the decision" },
  { id: "breakdown", label: "Break this down" },
  { id: "priority", label: "Find the real priority" },
] as const;

export type OperatorFollowUpId = (typeof FOLLOW_UP_CHIPS)[number]["id"];

const FOLLOW_UP_PREFIX: Record<OperatorFollowUpId, string> = {
  clarify:
    "[Operator lens — clarify] Name the decision underneath this pressure in one sentence, then what would make it choosable today.",
  breakdown:
    "[Operator lens — breakdown] Break the next decisive move into the smallest sequence of moves — no motivation, just order.",
  priority:
    "[Operator lens — priority] If only one thread can move this week, name it and what gets demoted.",
};

export function operatorFollowUpMessage(id: OperatorFollowUpId): string {
  return FOLLOW_UP_PREFIX[id];
}

export function OperatorLensResult({
  artifact,
  busy,
  onFollowUp,
  className,
}: {
  artifact: OperatorLensArtifact;
  busy?: boolean;
  onFollowUp: (id: OperatorFollowUpId) => void;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "v3-operator-result rounded-[1rem] border border-[color:var(--v3-border)] bg-[color:var(--v3-surface-elevated)] px-5 py-5",
        className,
      )}
      aria-label="Operator Sift result"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--v3-text-muted)]">
        Operator
      </p>
      <p className="mt-1 text-[12px] font-light text-[color:var(--v3-text-secondary)]">
        Pressure converted into movement.
      </p>

      <div className="mt-5 space-y-4">
        {SECTIONS.map(({ key, label }) => (
          <div key={key}>
            <h3 className="text-[12px] font-medium text-[color:var(--v3-text-secondary)]">
              {label}
            </h3>
            <p className="mt-1 text-[15px] font-light leading-relaxed text-[color:var(--v3-text-primary)]">
              {artifact[key]}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FOLLOW_UP_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            disabled={busy}
            onClick={() => onFollowUp(chip.id)}
            className="v3-starter-chip disabled:opacity-45"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </section>
  );
}
