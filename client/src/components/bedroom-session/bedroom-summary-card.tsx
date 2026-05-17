import { useEffect, useRef, useState } from "react";
import type { SiftSummary } from "@shared/schema";
import { cn } from "@/lib/utils";

type SummaryOption = SiftSummary["options"][number];

export type ActiveStepState = {
  optionId: string;
  title: string;
  description?: string;
  microSteps: string[];
  completed: boolean[];
  currentIndex: number;
  artifact?: {
    whatBecameClearer: string;
    signalCaptured: string;
    whatMattersNow: string;
  };
};

export function BedroomSummaryCard({
  summary,
  onToggleDone,
  done = false,
  inSummaryMode = false,
}: {
  summary?: SiftSummary | null;
  onToggleDone?: () => void;
  done?: boolean;
  inSummaryMode?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!summary) return null;

  return (
    <article
      className={cn(
        "mx-3 mb-2 flex max-h-[min(40dvh,45%)] min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]/95 px-3 py-2.5 shadow-[var(--bedroom-tray-shadow)] sm:mx-4 sm:max-h-[min(42dvh,48%)] sm:px-4",
        "transition-[opacity,transform] duration-300 ease-out",
        inSummaryMode && entered
          ? "translate-y-0 opacity-100"
          : "translate-y-2 opacity-0",
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
            Clarity drawer
          </p>
          <h2 className="font-serif text-[16px] leading-tight text-[color:var(--color-text)] sm:text-[17px]">
            What I&apos;m seeing
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-full border border-[color:var(--color-border-soft)] px-2.5 py-1 text-[10px] text-[color:var(--color-text-muted)] transition hover:text-[color:var(--color-text)]"
          aria-expanded={expanded}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {expanded ? (
        <div className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-[13px] leading-[1.45] text-[color:var(--color-text)] [-webkit-overflow-scrolling:touch]">
          <p className="text-[color:var(--color-text-muted)]">{summary.summary}</p>

          <SummaryList title="What matters most right now" items={summary.themes} />

          {summary.canWait?.length ? (
            <SummaryList title="What can probably wait" items={summary.canWait} />
          ) : null}

          <section>
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">
              Options from here
            </h3>
            <div className="space-y-1.5">
              {summary.options.map((option) => (
                <div
                  key={option.id}
                  className="rounded-xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]/70 px-2.5 py-2"
                >
                  <p className="text-[13px] font-medium">{option.label}</p>
                  {option.description ? (
                    <p className="mt-0.5 text-[12px] text-[color:var(--color-text-muted)]">
                      {option.description}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onToggleDone}
        className={cn(
          "flex w-full shrink-0 items-start gap-2 rounded-xl border border-[color:var(--color-primary)]/20 bg-[color:var(--color-primary)]/[0.06] px-2.5 py-2 text-left",
          expanded ? "mt-3" : "mt-2",
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px]",
            done
              ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-[color:var(--color-surface)]"
              : "border-[color:var(--color-primary)]/45 bg-transparent",
          )}
          aria-hidden
        >
          {done ? "✓" : ""}
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">
            My recommended next step
          </span>
          <span className="block text-[13px] font-medium text-[color:var(--color-text)]">
            {summary.recommendedNextStep.label}
          </span>
          {expanded && summary.recommendedNextStep.description ? (
            <span className="mt-0.5 block text-[12px] leading-[1.4] text-[color:var(--color-text-muted)]">
              {summary.recommendedNextStep.description}
            </span>
          ) : null}
        </span>
      </button>
    </article>
  );
}

export function BedroomSummarySheet({
  summary,
  onToggleDone,
  onDismiss,
  activeStep,
  onStartActiveStep,
  onCompleteActiveStepItem,
  done = false,
  minimized = false,
  onMinimizedChange,
}: {
  summary?: SiftSummary | null;
  onToggleDone?: () => void;
  onDismiss?: () => void;
  activeStep?: ActiveStepState | null;
  onStartActiveStep?: (option: SummaryOption) => void;
  onCompleteActiveStepItem?: (index: number) => void;
  done?: boolean;
  minimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
}) {
  const [entered, setEntered] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
    setSelectedOptionId(summary?.recommendedNextStep.id ?? null);
  }, [summary]);

  if (!summary) return null;

  const recommendedOptionId = summary.recommendedNextStep.id;
  const noiseItems = (summary.canWait?.length ? summary.canWait : summary.constraints ?? []).slice(0, 3);
  const selectedOption =
    summary.options.find((option) => option.id === selectedOptionId) ??
    summary.options.find((option) => option.id === recommendedOptionId) ??
    summary.recommendedNextStep;
  const selectedIsRecommended = selectedOption.id === recommendedOptionId;
  const displayedActiveStep =
    activeStep && activeStep.optionId === selectedOption.id ? activeStep : null;

  if (minimized) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(calc(6.25rem+env(safe-area-inset-bottom,0px)),6.75rem)] z-[26] flex justify-center px-4">
        <button
          type="button"
          onClick={() => onMinimizedChange?.(false)}
          className="pointer-events-auto max-w-[min(92vw,420px)] rounded-full border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]/95 px-4 py-2 text-[12px] font-medium text-[color:var(--color-text)] shadow-[var(--bedroom-tray-shadow)] backdrop-blur-sm transition hover:bg-[color:var(--color-surface)]"
        >
          {activeStep
            ? `Current step: ${activeStep.microSteps[activeStep.currentIndex] ?? activeStep.title}`
            : "Open clarity"}
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-[25] bg-[linear-gradient(180deg,rgba(41,38,31,0.04)_0%,rgba(41,38,31,0.14)_48%,rgba(244,240,230,0.72)_100%)] transition-opacity duration-300",
          entered ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      />
      <aside
        className={cn(
          "pointer-events-auto fixed inset-x-0 bottom-0 z-[26] mx-auto flex max-h-[min(78dvh,720px)] min-h-0 w-full max-w-[680px] flex-col overflow-hidden rounded-t-[2rem] border border-b-0 border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] px-4 pb-[max(calc(1rem+env(safe-area-inset-bottom,0px)),1.25rem)] pt-3 shadow-[0_-24px_70px_-34px_rgba(41,38,31,0.5)] sm:bottom-4 sm:max-h-[min(78dvh,680px)] sm:rounded-[2rem] sm:border-b sm:px-5 sm:pb-5",
          "transition-[opacity,transform] duration-300 ease-out",
          entered ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        )}
        aria-label="Clarity summary"
      >
        <div className="mx-auto mb-3 h-1 w-11 shrink-0 rounded-full bg-[color:var(--color-walnut)]/20" />
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[color:var(--color-border-soft)] pb-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
              CLARITY SHEET
            </p>
            <h2 className="mt-2 font-serif text-[25px] leading-[1.05] tracking-[-0.03em] text-[color:var(--color-text)] sm:text-[28px]">
              What I&apos;m seeing in all of this
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onMinimizedChange?.(true)}
              className="rounded-full border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-alt)]/45 px-2.5 py-1 text-[10px] font-medium text-[color:var(--color-text-muted)] transition hover:text-[color:var(--color-text)]"
            >
              Minimize
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-full border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-alt)]/45 px-2.5 py-1 text-[10px] font-medium text-[color:var(--color-text-muted)] transition hover:text-[color:var(--color-text)]"
            >
              Dismiss
            </button>
          </div>
        </div>

        <div
          ref={contentRef}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain py-4 pr-1 text-[14px] leading-[1.55] text-[color:var(--color-text)] [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]"
        >
          <section className="border-b border-[color:var(--color-border-soft)] pb-4">
            <p className="text-[16px] leading-[1.55] tracking-[-0.01em] text-[color:var(--color-text)] sm:text-[17px]">
              {summary.summary}
            </p>
          </section>

          <ClarityMattersSection items={summary.themes.slice(0, 4)} />

          {noiseItems.length ? (
            <ClarityNoiseSection items={noiseItems} />
          ) : null}

          <section ref={optionsRef}>
            <SectionLabel>OPTIONS FROM HERE</SectionLabel>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {summary.options.slice(0, 3).map((option) => {
                const isRecommended = option.id === recommendedOptionId;
                const isSelected = option.id === selectedOption.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedOptionId(option.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex min-h-[8.5rem] w-full flex-col rounded-2xl border px-3 py-3 text-left transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]/35",
                      isSelected
                        ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)]/[0.07] shadow-[0_10px_28px_-24px_rgba(41,38,31,0.42)]"
                        : "border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-alt)]/35 hover:border-[color:var(--color-primary)]/35 hover:bg-[color:var(--color-surface-alt)]/55",
                    )}
                  >
                    <span className="flex flex-1 flex-col">
                      <span className="flex min-w-0 items-start justify-between gap-2">
                        <span className="block text-[14px] font-semibold leading-snug text-[color:var(--color-text)]">
                          {option.label}
                        </span>
                        {isRecommended ? (
                          <span className="shrink-0 rounded-full bg-[color:var(--color-primary)]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[color:var(--color-primary-deep)]">
                            Rec
                          </span>
                        ) : null}
                      </span>
                      {option.description ? (
                        <span className="mt-2 block text-[12px] leading-[1.45] text-[color:var(--color-text-muted)]">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-3 block text-[15px] leading-none text-[color:var(--color-primary)]">
                      -&gt;
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            {displayedActiveStep ? (
              <ActiveStepCard
                activeStep={displayedActiveStep}
                onCompleteItem={onCompleteActiveStepItem}
                onKeepTalking={() => onMinimizedChange?.(true)}
                onChooseAnother={() =>
                  optionsRef.current?.scrollIntoView({
                    block: "nearest",
                    behavior: "smooth",
                  })
                }
              />
            ) : (
              <RecommendedStepCard
                done={done}
                selectedIsRecommended={selectedIsRecommended}
                selectedOption={selectedOption}
                onStart={() => onStartActiveStep?.(selectedOption)}
                onKeepTalking={() => onMinimizedChange?.(true)}
                onChooseAnother={() =>
                  optionsRef.current?.scrollIntoView({
                    block: "nearest",
                    behavior: "smooth",
                  })
                }
              />
            )}
          </section>
        </div>
      </aside>
    </>
  );
}

function RecommendedStepCard({
  done,
  selectedIsRecommended,
  selectedOption,
  onStart,
  onChooseAnother,
  onKeepTalking,
}: {
  done: boolean;
  selectedIsRecommended: boolean;
  selectedOption: SummaryOption;
  onStart: () => void;
  onChooseAnother: () => void;
  onKeepTalking: () => void;
}) {
  return (
    <>
      <SectionLabel>
        {selectedIsRecommended ? "MY RECOMMENDED NEXT STEP" : "MY CHOSEN NEXT STEP"}
      </SectionLabel>
      <div className="rounded-[1.35rem] border border-[color:var(--color-primary)]/20 p-3 shadow-[0_18px_48px_-34px_rgba(41,38,31,0.52)]">
        <div className="rounded-[1.1rem] border border-[color:var(--color-primary)]/16 bg-[color:var(--color-surface-alt)]/65 p-3">
          <div className="flex gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--color-primary)]/12 bg-[color:var(--color-primary)]/[0.09] text-[22px] text-[color:var(--color-primary-deep)]">
              {done ? "✓" : "o"}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-serif text-[21px] leading-tight tracking-[-0.03em] text-[color:var(--color-text)]">
                {selectedOption.label}
              </h3>
              {selectedOption.description ? (
                <p className="mt-1.5 text-[13px] leading-[1.45] text-[color:var(--color-text-muted)]">
                  {selectedOption.description}
                </p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onStart}
            className="mt-4 flex w-full items-center justify-between rounded-xl bg-[color:var(--color-primary)] px-4 py-3 text-[14px] font-semibold text-[color:var(--color-surface)] transition hover:bg-[color:var(--color-primary-deep)]"
          >
            <span>Take this step</span>
            <span aria-hidden>-&gt;</span>
          </button>

          <SecondaryStepActions
            onChooseAnother={onChooseAnother}
            onKeepTalking={onKeepTalking}
          />
        </div>
      </div>
    </>
  );
}

function ActiveStepCard({
  activeStep,
  onCompleteItem,
  onChooseAnother,
  onKeepTalking,
}: {
  activeStep: ActiveStepState;
  onCompleteItem?: (index: number) => void;
  onChooseAnother: () => void;
  onKeepTalking: () => void;
}) {
  const completedCount = activeStep.completed.filter(Boolean).length;
  const total = activeStep.microSteps.length;
  const allComplete = completedCount >= total;
  const currentStep = activeStep.microSteps[activeStep.currentIndex] ?? activeStep.microSteps[total - 1];

  return (
    <>
      <SectionLabel>ACTIVE STEP</SectionLabel>
      <div className="rounded-[1.35rem] border border-[color:var(--color-primary)]/24 bg-[color:var(--color-primary)]/[0.055] p-3 shadow-[0_18px_48px_-34px_rgba(41,38,31,0.52)]">
        <div className="rounded-[1.1rem] border border-[color:var(--color-primary)]/18 bg-[color:var(--color-surface-alt)]/78 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-primary-deep)]/70">
                Current focus
              </p>
              <h3 className="mt-1 font-serif text-[22px] leading-tight tracking-[-0.03em] text-[color:var(--color-text)]">
                {activeStep.title}
              </h3>
            </div>
            <span className="shrink-0 rounded-full border border-[color:var(--color-primary)]/18 bg-[color:var(--color-surface)]/70 px-2.5 py-1 text-[11px] font-medium text-[color:var(--color-primary-deep)]">
              {completedCount}/{total}
            </span>
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color:var(--color-text)]/[0.06]">
            <div
              className="h-full rounded-full bg-[color:var(--color-primary)] transition-[width] duration-300 ease-out"
              style={{ width: `${Math.round((completedCount / total) * 100)}%` }}
            />
          </div>

          <ol className="mt-4 space-y-2">
            {activeStep.microSteps.map((step, index) => {
              const isComplete = activeStep.completed[index];
              const isCurrent = index === activeStep.currentIndex && !allComplete;
              return (
                <li
                  key={`${index}-${step}`}
                  className={cn(
                    "flex items-start gap-2 rounded-xl border px-3 py-2 transition",
                    isCurrent
                      ? "border-[color:var(--color-primary)]/24 bg-[color:var(--color-surface)]"
                      : "border-transparent bg-transparent",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
                      isComplete
                        ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-[color:var(--color-surface)]"
                        : isCurrent
                          ? "border-[color:var(--color-primary)]/55 text-[color:var(--color-primary-deep)]"
                          : "border-[color:var(--color-walnut)]/16 text-[color:var(--color-text-muted)]",
                    )}
                  >
                    {isComplete ? "✓" : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-[13px] leading-[1.4]",
                        isCurrent ? "font-semibold text-[color:var(--color-text)]" : "text-[color:var(--color-text-muted)]",
                      )}
                    >
                      {step}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>

          {allComplete && activeStep.artifact ? (
            <div className="mt-4 rounded-xl border border-[color:var(--color-primary)]/14 bg-[color:var(--color-surface)]/72 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
                Signal captured
              </p>
              <p className="mt-1 text-[13px] leading-[1.45] text-[color:var(--color-text)]">
                {activeStep.artifact.signalCaptured}
              </p>
              <p className="mt-2 text-[12px] leading-[1.45] text-[color:var(--color-text-muted)]">
                {activeStep.artifact.whatBecameClearer}
              </p>
              <p className="mt-2 text-[12px] font-medium leading-[1.45] text-[color:var(--color-primary-deep)]">
                {activeStep.artifact.whatMattersNow}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-[color:var(--color-primary)]/14 bg-[color:var(--color-surface)]/72 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
                Start here
              </p>
              <p className="mt-1 text-[14px] leading-[1.45] text-[color:var(--color-text)]">
                {currentStep}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => onCompleteItem?.(activeStep.currentIndex)}
            disabled={allComplete}
            className={cn(
              "mt-4 flex w-full items-center justify-between rounded-xl px-4 py-3 text-[14px] font-semibold transition",
              allComplete
                ? "bg-[color:var(--color-primary-deep)]/80 text-[color:var(--color-surface)]"
                : "bg-[color:var(--color-primary)] text-[color:var(--color-surface)] hover:bg-[color:var(--color-primary-deep)]",
            )}
          >
            <span>{allComplete ? "Progress captured" : "Mark this small step"}</span>
            <span aria-hidden>{allComplete ? "✓" : "-&gt;"}</span>
          </button>

          <SecondaryStepActions
            onChooseAnother={onChooseAnother}
            onKeepTalking={onKeepTalking}
          />
        </div>
      </div>
    </>
  );
}

function SecondaryStepActions({
  onChooseAnother,
  onKeepTalking,
}: {
  onChooseAnother: () => void;
  onKeepTalking: () => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 divide-x divide-[color:var(--color-border-soft)] text-[12px] text-[color:var(--color-text-muted)]">
      <button
        type="button"
        onClick={onChooseAnother}
        className="px-2 py-1.5 text-center transition hover:text-[color:var(--color-text)]"
      >
        Choose another option
      </button>
      <button
        type="button"
        onClick={onKeepTalking}
        className="px-2 py-1.5 text-center transition hover:text-[color:var(--color-text)]"
      >
        Keep talking
      </button>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">
      {children}
    </h3>
  );
}

function ClarityMattersSection({ items }: { items: string[] }) {
  return (
    <section>
      <SectionLabel>WHAT MATTERS MOST RIGHT NOW</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full border border-[color:var(--color-primary)]/14 bg-[color:var(--color-primary)]/[0.07] px-3 py-2 text-[12px] font-medium leading-tight text-[color:var(--color-primary-deep)]"
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function ClarityNoiseSection({ items }: { items: string[] }) {
  return (
    <section>
      <SectionLabel>WHAT&apos;S NOISE</SectionLabel>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-[13px] leading-[1.45] text-[color:var(--color-text-muted)]">
            <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full border border-[color:var(--color-walnut)]/25" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">
        {title}
      </h3>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-[color:var(--color-primary)]/55" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
