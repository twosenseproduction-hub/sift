import { cn } from "@/lib/utils";
import type { RecapModel } from "@/components/bedroom-session/recap-card";
import { NextStepSystem } from "./next-step-system";

export function RedesignV3RecapOutput({
  recap,
  busy,
  onDidIt,
  onDidNot,
  onKeepGoing,
  onCommitChange,
  onMicroProgress,
  releaseOpen,
  onReleaseOpenChange,
  className,
}: {
  recap: RecapModel;
  busy?: boolean;
  onDidIt?: () => void;
  onDidNot?: () => void;
  onKeepGoing?: () => void;
  onCommitChange?: (committed: boolean) => void;
  onMicroProgress?: (done: number, total: number) => void;
  releaseOpen?: boolean;
  onReleaseOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const signal =
    recap.matters[0]?.trim() ||
    recap.hearing.trim() ||
    "The signal is still forming.";

  return (
    <div className={cn("px-1 pb-2", className)} aria-label="What Sift found">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--v3-text-muted)]">
        What Sift found
      </p>

      <div className="mt-5 space-y-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--v3-leaf-accent)]">
            Signal
          </p>
          <p className="mt-2 font-serif text-[21px] font-light leading-snug text-[color:var(--v3-text-primary)]">
            {signal}
          </p>
        </div>

        {recap.noise.length ? (
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--v3-leaf-accent)]">
              Noise
            </p>
            <ul className="mt-2 list-none space-y-2">
              {recap.noise.map((item, i) => (
                <li
                  key={`${i}-${item}`}
                  className="flex gap-3 text-[13px] font-light leading-relaxed text-[color:var(--v3-text-secondary)]"
                >
                  <span className="shrink-0 text-[color:var(--v3-text-muted)]">—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {recap.nextStep?.trim() ? (
        <NextStepSystem
          className="mt-4"
          nextStep={recap.nextStep}
          busy={busy}
          onDidIt={onDidIt}
          onDidNot={onDidNot}
          onKeepGoing={onKeepGoing}
          onCommitChange={onCommitChange}
          onMicroProgress={onMicroProgress}
          releaseOpen={releaseOpen}
          onReleaseOpenChange={onReleaseOpenChange}
        />
      ) : null}
    </div>
  );
}
