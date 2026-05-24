import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { microStepsForNextStep, type MicroStep } from "@/lib/energy-canvas";

export function NextStepCommitOverlay({
  stepText,
  open,
  onCarry,
  onDismiss,
}: {
  stepText: string;
  open: boolean;
  onCarry: () => void;
  onDismiss: () => void;
}) {
  if (!open) return null;

  return (
    <div className="v3-commit-overlay" role="dialog" aria-modal="true" aria-label="Commit to next step">
      <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--v3-text-muted)]">
        One next step
      </p>
      <p className="v3-overlay-step-text mt-6">&ldquo;{stepText}&rdquo;</p>
      <button type="button" className="v3-carry-btn" onClick={onCarry}>
        I&apos;ll carry this
      </button>
      <button type="button" className="v3-overlay-dismiss" onClick={onDismiss}>
        Not yet
      </button>
    </div>
  );
}

export function NextStepReleasePanel({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="v3-commit-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Release ritual"
    >
      <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--v3-text-muted)]">
        Release
      </p>
      <p className="v3-overlay-step-text mt-6">
        Set this down for now. The thread stays — you do not have to keep carrying it.
      </p>
      <button type="button" className="v3-carry-btn" onClick={onConfirm}>
        Set it down
      </button>
      <button type="button" className="v3-overlay-dismiss" onClick={onClose}>
        Keep carrying
      </button>
    </div>
  );
}

type NextStepSystemProps = {
  nextStep: string;
  busy?: boolean;
  microSteps?: MicroStep[];
  onDidIt?: () => void;
  onDidNot?: () => void;
  onKeepGoing?: () => void;
  className?: string;
  /** Lift commit + micro progress for sidebar sync */
  onCommitChange?: (committed: boolean) => void;
  onMicroProgress?: (done: number, total: number) => void;
  releaseOpen?: boolean;
  onReleaseOpenChange?: (open: boolean) => void;
};

export function NextStepSystem({
  nextStep,
  busy,
  microSteps: microStepsProp,
  onDidIt,
  onDidNot,
  onKeepGoing,
  className,
  onCommitChange,
  onMicroProgress,
  releaseOpen = false,
  onReleaseOpenChange,
}: NextStepSystemProps) {
  const microSteps = microStepsProp ?? microStepsForNextStep(nextStep);
  const [committed, setCommitted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [lineDrawn, setLineDrawn] = useState(false);
  const [doneIndexes, setDoneIndexes] = useState<Set<number>>(() => new Set());
  const [visibleSteps, setVisibleSteps] = useState(0);

  const doneCount = doneIndexes.size;
  const allDone = doneCount >= microSteps.length;

  useEffect(() => {
    onMicroProgress?.(doneCount, microSteps.length);
  }, [doneCount, microSteps.length, onMicroProgress]);

  useEffect(() => {
    onCommitChange?.(committed);
  }, [committed, onCommitChange]);

  const handleCommitClick = useCallback(() => {
    if (committed) return;
    setShowOverlay(true);
  }, [committed]);

  const handleCarry = useCallback(() => {
    setShowOverlay(false);
    setCommitted(true);
    setLineDrawn(true);
    window.setTimeout(() => setVisibleSteps(1), 120);
    microSteps.forEach((_, i) => {
      window.setTimeout(() => setVisibleSteps((v) => Math.max(v, i + 1)), 180 + i * 120);
    });
  }, [microSteps]);

  const toggleMicro = useCallback((index: number) => {
    if (!committed) return;
    setDoneIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, [committed]);

  const handleRelease = useCallback(() => {
    onReleaseOpenChange?.(true);
  }, [onReleaseOpenChange]);

  const handleReleaseConfirm = useCallback(() => {
    onReleaseOpenChange?.(false);
    onDidIt?.();
  }, [onDidIt, onReleaseOpenChange]);

  return (
    <>
      <div className={cn("v3-next-step-system", className)} data-testid="next-step-system">
        <div className="v3-nss-header">
          <span className="v3-nss-label">One next step</span>
          <span className="font-serif text-[11px] italic text-[color:var(--v3-text-muted)]">
            from this entry
          </span>
        </div>
        <div className="v3-nss-body">
          <p className="v3-nss-step-text" data-testid="text-next-step">
            &ldquo;{nextStep}&rdquo;
          </p>
        </div>
        <div className="v3-nss-line-wrap">
          <div className={cn("v3-nss-line-fill", lineDrawn && "drawn")} />
        </div>
        <div className="v3-nss-commit-row">
          <p className="v3-nss-subtext">
            One small act. You do not need more than this right now.
          </p>
          <button
            type="button"
            disabled={busy || committed}
            onClick={handleCommitClick}
            className={cn("v3-commit-btn", committed && "committed")}
          >
            {committed ? "Committed" : "Commit to this"}
          </button>
        </div>

        <div className={cn("v3-micro-steps", committed && "open")}>
          <p className="v3-micro-steps-label">How to do it</p>
          {microSteps.map((step, index) => (
            <div
              key={index}
              role="button"
              tabIndex={committed ? 0 : -1}
              onClick={() => toggleMicro(index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleMicro(index);
                }
              }}
              className={cn(
                "v3-micro-step",
                index < visibleSteps && "visible",
                doneIndexes.has(index) && "done",
              )}
            >
              <div className="v3-micro-step-marker">
                <span>{index + 1}</span>
              </div>
              <div>
                <p className="v3-micro-step-text">{step.text}</p>
                <p className="v3-micro-step-hint">{step.hint}</p>
              </div>
            </div>
          ))}
          <div className="v3-micro-steps-footer">
            <p className={cn("v3-micro-progress", allDone && "all-done")}>
              {allDone
                ? "All micro-steps done."
                : `${doneCount} of ${microSteps.length} done`}
            </p>
            <button
              type="button"
              className={cn("v3-micro-release-hint", allDone && "visible")}
              onClick={handleRelease}
            >
              Release →
            </button>
          </div>
        </div>

        {committed && !allDone ? (
          <div className="flex flex-wrap gap-2 border-t border-[color:var(--v3-border)] px-4 py-3">
            {onKeepGoing ? (
              <button
                type="button"
                disabled={busy}
                onClick={onKeepGoing}
                className="text-[11px] text-[color:var(--v3-text-muted)] underline-offset-4 hover:underline disabled:opacity-45"
              >
                Still in progress
              </button>
            ) : null}
            {onDidNot ? (
              <button
                type="button"
                disabled={busy}
                onClick={onDidNot}
                className="text-[11px] text-[color:var(--v3-text-muted)] underline-offset-4 hover:underline disabled:opacity-45"
              >
                Did not do it
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <NextStepCommitOverlay
        stepText={nextStep}
        open={showOverlay}
        onCarry={handleCarry}
        onDismiss={() => setShowOverlay(false)}
      />
      <NextStepReleasePanel
        open={releaseOpen}
        onClose={() => onReleaseOpenChange?.(false)}
        onConfirm={handleReleaseConfirm}
      />
    </>
  );
}
