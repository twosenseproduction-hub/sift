import type { WritingSiftArtifact } from "@shared/schema";
import { cn } from "@/lib/utils";

const SECTIONS: {
  key: keyof Omit<WritingSiftArtifact, "mode">;
  label: string;
}[] = [
  { key: "whatThisPieceIsCarrying", label: "What this piece is carrying" },
  { key: "liveImage", label: "The live image" },
  { key: "whatLingers", label: "What lingers" },
  { key: "oneInvitation", label: "One invitation" },
];

const FOLLOW_UP_CHIPS = [
  { id: "deeper", label: "Go deeper" },
  { id: "strengthen", label: "Strengthen the piece" },
  { id: "continue", label: "Continue writing" },
] as const;

export type WritingFollowUpId = (typeof FOLLOW_UP_CHIPS)[number]["id"];

const FOLLOW_UP_PREFIX: Record<WritingFollowUpId, string> = {
  deeper:
    "[Writing Sift — go deeper] Stay with this piece. Name what is still unsaid beneath the surface, without fixing it.",
  strengthen:
    "[Writing Sift — strengthen] Point to one place the piece could gain tension or clarity — no full rewrite.",
  continue:
    "[Writing Sift — continue] Offer one line or image I might write toward next, as an invitation only.",
};

export function writingFollowUpMessage(id: WritingFollowUpId): string {
  return FOLLOW_UP_PREFIX[id];
}

export function WritingSiftResult({
  artifact,
  busy,
  onFollowUp,
  className,
}: {
  artifact: WritingSiftArtifact;
  busy?: boolean;
  onFollowUp: (id: WritingFollowUpId) => void;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "v3-writing-result rounded-[1rem] border border-[color:var(--v3-border)] bg-[color:var(--v3-surface-elevated)] px-5 py-5",
        className,
      )}
      aria-label="Writing Sift result"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--v3-text-muted)]">
        Writing Sift
      </p>
      <p className="mt-1 text-[12px] font-light text-[color:var(--v3-text-secondary)]">
        Met as a piece, not a problem.
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
