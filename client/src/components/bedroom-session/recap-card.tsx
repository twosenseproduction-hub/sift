import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type RecapModel = {
  hearing: string;
  matters: string[];
  noise: string[];
  nextStep: string;
};

function TinyStepCircle({ done }: { done: boolean }) {
  return (
    <span
      className={cn(
        "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition",
        done
          ? "border-[color:var(--color-warm)] bg-[color:var(--color-warm)]/18 text-[color:var(--color-warm)]"
          : "border-[color:var(--color-walnut)]/12 bg-[color:var(--color-surface)]",
      )}
      aria-hidden
    >
      {done ? <Check className="h-2 w-2 stroke-[3]" /> : null}
    </span>
  );
}

/** Compact recap tucked under the latest Sift reply (not a separate hero card). */
export function RecapStrip({
  className,
  recap,
  nextStepDone,
  onToggleNextStep,
}: {
  className?: string;
  recap: RecapModel;
  nextStepDone: boolean;
  onToggleNextStep: () => void;
}) {
  return (
    <div
      className={cn(
        "bedroom-recap-strip mt-2 rounded-lg border border-[color:var(--color-walnut)]/10 bg-[color:var(--color-surface-alt)]/85 px-2.5 py-2 sm:px-3 sm:py-2.5",
        className,
      )}
      aria-label="Recap"
    >
      <div className="space-y-2 text-[color:var(--color-text)]">
        <div>
          <StripLabel>What I’m hearing</StripLabel>
          <p className="text-[12px] leading-snug text-[color:var(--color-text)]/90 line-clamp-2">
            {recap.hearing}
          </p>
        </div>

        <div>
          <StripLabel>What matters</StripLabel>
          {recap.matters.length ? (
            <ul className="mt-1 flex flex-wrap gap-1">
              {recap.matters.map((m, i) => (
                <li
                  key={`${i}-${m}`}
                  className="rounded-md border border-[color:var(--color-primary)]/16 bg-[color:var(--color-surface)]/65 px-2 py-0.5 text-[11px] font-medium leading-tight text-[color:var(--color-primary-deep)]"
                >
                  {m}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-0.5 text-[11px] text-[color:var(--color-text-muted)]">—</p>
          )}
        </div>

        {recap.noise.length ? (
          <div>
            <StripLabel>What’s noise</StripLabel>
            <ul className="mt-1 flex flex-wrap gap-1">
              {recap.noise.map((n, i) => (
                <li
                  key={`${i}-${n}`}
                  className="rounded-md bg-[color:var(--color-text)]/[0.05] px-2 py-0.5 text-[11px] leading-tight text-[color:var(--color-text-muted)]"
                >
                  {n}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onToggleNextStep}
          className={cn(
            "flex w-full items-start gap-2 rounded-lg px-1 py-0.5 text-left transition",
            nextStepDone ? "bg-[color:var(--color-warm)]/[0.08]" : "hover:bg-[color:var(--color-text)]/[0.04]",
          )}
        >
          <TinyStepCircle done={nextStepDone} />
          <div className="min-w-0 flex-1">
            <StripLabel className="mb-0.5">One next step</StripLabel>
            <p className="text-[13px] leading-snug text-[color:var(--color-text)]">
              {recap.nextStep}
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

function StripLabel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "text-[9px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]",
        className,
      )}
    >
      {children}
    </p>
  );
}
