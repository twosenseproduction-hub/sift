import type { SupportProfileUpdateRequest } from "@shared/schema";
import { cn } from "@/lib/utils";
import { isRedesignV3Enabled } from "@/lib/use-redesign-v3";

export type OnboardingStep = "welcome" | "choice" | "personalize";
export type SiftBaseVisualMode = "dark" | "light";
export type OnboardingVariant = "bedroom" | "v3";

export type SiftOnboardingFlowProps = {
  step: OnboardingStep;
  draft: SupportProfileUpdateRequest;
  mode?: SiftBaseVisualMode;
  /** v3 uses cream editorial tokens; bedroom keeps legacy dark/light palette. */
  variant?: OnboardingVariant;
  onStepChange: (step: OnboardingStep) => void;
  onDraftChange: (draft: SupportProfileUpdateRequest) => void;
  onBegin: () => void;
  onTryFree: () => void;
  onCreateAccount: () => void;
  onFinish: () => void;
  previewLabel?: string;
};

function useOnboardingTheme(mode: SiftBaseVisualMode, variant: OnboardingVariant) {
  if (variant === "v3") {
    return {
      v3: true as const,
      kicker: "v3-onboarding-kicker",
      rule: "v3-onboarding-rule",
      headline: "v3-onboarding-headline",
      sub: "v3-onboarding-sub",
      link: "v3-onboarding-link",
      primaryBtn: "v3-sift-btn v3-onboarding-primary",
      card: "v3-onboarding-card",
      cardDesc: "v3-onboarding-card-desc",
      chip: "v3-onboarding-chip",
      chipSelected: "v3-onboarding-chip selected",
      label: "v3-onboarding-label",
    };
  }

  const dark = mode === "dark";
  return {
    v3: false as const,
    kicker: dark ? "text-[rgba(195,240,190,0.54)]" : "text-[#556b57]/80",
    rule: dark ? "bg-[rgba(195,240,190,0.28)]" : "bg-[#7a5e49]/35",
    headline: dark ? "text-[rgba(218,244,213,0.9)]" : "text-[#29261f]",
    sub: dark ? "text-[rgba(201,235,194,0.58)]" : "text-[#6e685d]",
    link: dark
      ? "text-[rgba(201,235,194,0.58)] hover:text-[rgba(218,244,213,0.9)]"
      : "text-[#6e685d] hover:text-[#29261f]",
    primaryBtn: dark
      ? "border border-[rgba(120,200,110,0.2)] bg-black/15 text-[rgba(210,240,202,0.88)] hover:bg-black/22 focus:ring-[rgba(180,235,170,0.42)] focus:ring-offset-[#2d6640]"
      : "border border-[#556b57]/20 bg-[#faf7f0]/72 text-[#556b57] hover:bg-[#faf7f0]/92 focus:ring-[#556b57]/40 focus:ring-offset-[#f4f0e6]",
    card: dark
      ? "border border-[rgba(120,200,110,0.18)] bg-black/12 text-[rgba(218,244,213,0.88)] hover:border-[rgba(120,200,110,0.32)] hover:bg-black/18"
      : "border border-[#556b57]/18 bg-[#faf7f0]/55 text-[#29261f] hover:border-[#556b57]/28 hover:bg-[#faf7f0]/78",
    cardDesc: dark ? "text-[rgba(201,235,194,0.52)]" : "text-[#6e685d]",
    chip: dark
      ? "border-[rgba(120,200,110,0.16)] bg-black/10 text-[rgba(201,235,194,0.62)] hover:border-[rgba(120,200,110,0.28)] hover:text-[rgba(218,244,213,0.88)]"
      : "border-[#556b57]/16 bg-[#faf7f0]/45 text-[#6e685d] hover:border-[#556b57]/28 hover:text-[#29261f]",
    chipSelected: dark
      ? "border-[rgba(120,200,110,0.38)] bg-black/22 text-[rgba(218,244,213,0.92)]"
      : "border-[#556b57]/32 bg-[#faf7f0]/88 text-[#29261f]",
    label: dark ? "text-[rgba(195,240,190,0.44)]" : "text-[#556b57]/75",
    shell: dark ? "text-[rgba(216,242,210,0.9)]" : "text-[#29261f]",
  };
}

export function SiftOnboardingFlow({
  step,
  draft,
  mode = "light",
  variant = isRedesignV3Enabled() ? "v3" : "bedroom",
  onStepChange,
  onDraftChange,
  onBegin,
  onTryFree,
  onCreateAccount,
  onFinish,
  previewLabel,
}: SiftOnboardingFlowProps) {
  const t = useOnboardingTheme(mode, variant);
  const setDraft = (patch: SupportProfileUpdateRequest) => {
    onDraftChange({ ...draft, ...patch });
  };

  return (
    <section
      className="pointer-events-none flex min-h-full w-full items-center justify-center overflow-y-auto px-5 py-[max(env(safe-area-inset-top),1.5rem)] pb-8"
      aria-label="Sift onboarding"
    >
      <div
        className={cn(
          "pointer-events-auto my-auto flex w-full max-w-[480px] flex-col items-center text-center transition-[opacity,transform] duration-500 ease-out",
          !t.v3 && "shell" in t && t.shell,
        )}
      >
        {previewLabel ? (
          <p className={cn("mb-4 font-serif text-[11px] uppercase tracking-[0.28em]", t.kicker)}>
            Preview · {previewLabel}
          </p>
        ) : null}

        {step === "welcome" ? (
          <div className="flex w-full flex-col items-center">
            <p className={cn(t.kicker)}>Sift</p>
            <div className={cn("mt-4", t.rule)} aria-hidden />
            <h1
              className={cn(
                "mt-7 max-w-[400px] text-[36px] leading-[1.12] tracking-[-0.035em] sm:text-[44px]",
                t.headline,
              )}
            >
              Tell what matters from what is only loud.
            </h1>
            <p className={cn("mt-5 max-w-[360px] text-[17px] leading-[1.45] sm:text-[19px]", t.sub)}>
              Speak or type the tangle. Get back the signal underneath, and one next step you can actually take.
            </p>
            <button
              type="button"
              onClick={onBegin}
              className={cn(
                "mt-8 w-full max-w-[300px] px-6 py-4 tracking-[0.01em] transition focus:outline-none focus:ring-2 focus:ring-offset-2",
                !t.v3 && "rounded-xl font-serif text-[18px] shadow-[0_18px_44px_-34px_rgba(0,0,0,0.45)] hover:-translate-y-0.5",
                t.primaryBtn,
              )}
            >
              Begin
            </button>
          </div>
        ) : null}

        {step === "choice" ? (
          <div className="w-full text-left">
            <p className={cn("text-center", t.kicker)}>Get started</p>
            <div className={cn("mx-auto mt-4", t.rule)} aria-hidden />
            <h2
              className={cn(
                "mt-6 text-center text-[32px] leading-[1.12] tracking-[-0.035em] sm:text-[38px]",
                t.headline,
              )}
            >
              How would you like to begin?
            </h2>
            <p className={cn("mt-4 text-center text-[16px] leading-[1.5] sm:text-[17px]", t.sub)}>
              Try Sift for free right now, or create an account so your clarity stays with you.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <OnboardingChoiceCard
                title="Try free sifts"
                description="Start a sift right away. No account needed."
                onClick={onTryFree}
                theme={t}
              />
              <OnboardingChoiceCard
                title="Create an account"
                description="Save your sifts and return to past clarity."
                onClick={onCreateAccount}
                theme={t}
              />
            </div>
            <div className="mt-6 flex items-center justify-between gap-3 px-1">
              <button type="button" onClick={() => onStepChange("welcome")} className={cn("transition", t.link)}>
                Back
              </button>
              <button
                type="button"
                onClick={() => onStepChange("personalize")}
                className={cn("underline-offset-4 transition hover:underline", t.link)}
              >
                Tune support first
              </button>
            </div>
          </div>
        ) : null}

        {step === "personalize" ? (
          <div className="w-full text-left">
            <p className={cn("text-center", t.kicker)}>Optional</p>
            <div className={cn("mx-auto mt-4", t.rule)} aria-hidden />
            <h2
              className={cn(
                "mt-6 text-center text-[32px] leading-[1.12] tracking-[-0.035em] sm:text-[38px]",
                t.headline,
              )}
            >
              A little shape, if you want.
            </h2>
            <p className={cn("mt-4 text-center text-[16px] leading-[1.5]", t.sub)}>
              Fast answers only. You can change this later.
            </p>

            <div className="mt-7 space-y-5">
              <OnboardingSegmentGroup
                label="What would help most right now?"
                value={draft.primaryIntent}
                options={[
                  { value: "sort_thoughts", label: "Sort my thoughts" },
                  { value: "calm_noise", label: "Calm the noise" },
                  { value: "understand_feelings", label: "Understand what I'm feeling" },
                  { value: "find_next_step", label: "Find a next step" },
                ]}
                onChange={(primaryIntent) => setDraft({ primaryIntent })}
                theme={t}
              />
              <OnboardingSegmentGroup
                label="How should I support you?"
                value={draft.supportStyle}
                options={[
                  { value: "gentle", label: "Gently" },
                  { value: "clear", label: "Clearly" },
                  { value: "direct", label: "Directly" },
                  { value: "step_by_step", label: "Step by step" },
                ]}
                onChange={(supportStyle) => setDraft({ supportStyle })}
                theme={t}
              />
            </div>

            <OnboardingFooter
              backLabel="Back"
              nextLabel="Start first sift"
              onBack={() => onStepChange("choice")}
              onNext={onFinish}
              secondaryLabel="Skip"
              onSecondary={onFinish}
              theme={t}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

type Theme = ReturnType<typeof useOnboardingTheme>;

function OnboardingChoiceCard({
  title,
  description,
  onClick,
  theme: t,
}: {
  title: string;
  description: string;
  onClick: () => void;
  theme: Theme;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "p-4 text-left transition",
        !t.v3 && "rounded-xl shadow-[0_18px_44px_-34px_rgba(0,0,0,0.45)] hover:-translate-y-0.5",
        t.card,
      )}
    >
      <span className="block font-serif text-[21px] leading-tight tracking-[-0.03em]">{title}</span>
      <span className={cn("mt-2 block text-[14px] leading-[1.45]", t.cardDesc)}>{description}</span>
    </button>
  );
}

function OnboardingSegmentGroup<TValue extends string>({
  label,
  value,
  options,
  onChange,
  theme: t,
}: {
  label: string;
  value?: TValue | null;
  options: Array<{ value: TValue; label: string }>;
  onChange: (value: TValue | undefined) => void;
  theme: Theme;
}) {
  return (
    <div className="space-y-2">
      <p className={cn(t.label)}>{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(selected ? undefined : option.value)}
              className={cn(
                "px-3 py-2.5 text-left text-[13px] transition",
                !t.v3 && "rounded-xl border font-serif",
                selected ? t.chipSelected : t.chip,
              )}
              aria-pressed={selected}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OnboardingFooter({
  backLabel,
  nextLabel,
  onBack,
  onNext,
  secondaryLabel,
  onSecondary,
  theme: t,
}: {
  backLabel: string;
  nextLabel: string;
  onBack: () => void;
  onNext: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  theme: Theme;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3 px-1">
      <button type="button" onClick={onBack} className={cn("transition", t.link)}>
        {backLabel}
      </button>
      <div className="flex items-center gap-3">
        {secondaryLabel && onSecondary ? (
          <button type="button" onClick={onSecondary} className={cn("transition", t.link)}>
            {secondaryLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onNext}
          className={cn(
            "px-5 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-offset-2",
            !t.v3 && "rounded-xl font-serif text-[15px] shadow-[0_18px_44px_-34px_rgba(0,0,0,0.45)] hover:-translate-y-0.5",
            t.primaryBtn,
          )}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
