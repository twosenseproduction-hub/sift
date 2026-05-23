import { useState } from "react";
import type { SupportProfileUpdateRequest } from "@shared/schema";
import { SiftBaseBackground } from "@/components/bedroom-session/sift-base-background";
import {
  SiftOnboardingFlow,
  type OnboardingStep,
  type SiftBaseVisualMode,
} from "@/components/onboarding/sift-onboarding-flow";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const STEPS: OnboardingStep[] = ["welcome", "choice", "personalize"];

/**
 * Standalone onboarding sample — review copy and flow before shipping to Home.
 * Route: #/onboarding-preview
 */
export default function OnboardingPreviewPage() {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [mode, setMode] = useState<SiftBaseVisualMode>("dark");
  const [draft, setDraft] = useState<SupportProfileUpdateRequest>({ mode: "base" });
  const [lastAction, setLastAction] = useState<string | null>(null);
  const dark = mode === "dark";

  return (
    <div
      className={cn(
        "bedroom-session sift-base-session relative min-h-[100dvh] overflow-x-hidden bg-[color:var(--color-bg)]",
        mode === "light" && "sift-base-light-session",
      )}
    >
      <SiftBaseBackground mode={mode} />

      <div
        className={cn(
          "pointer-events-auto fixed inset-x-0 top-0 z-[50] border-b px-4 py-3 backdrop-blur-md sm:px-5",
          dark
            ? "border-[rgba(120,200,110,0.12)] bg-[#1a3d28]/72"
            : "border-[#556b57]/12 bg-[#faf7f0]/88",
        )}
      >
        <div className="mx-auto flex max-w-[640px] flex-wrap items-center justify-between gap-3">
          <div>
            <p
              className={cn(
                "font-serif text-[10px] uppercase tracking-[0.28em]",
                dark ? "text-[rgba(195,240,190,0.48)]" : "text-[#556b57]/75",
              )}
            >
              Onboarding sample
            </p>
            <p
              className={cn(
                "font-serif text-[13px] italic",
                dark ? "text-[rgba(201,235,194,0.52)]" : "text-[#6e685d]",
              )}
            >
              Same look as Sift Base. Not wired to auth.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
              className={cn(
                "rounded-full border px-3 py-1.5 font-serif text-[11px] transition",
                dark
                  ? "border-[rgba(120,200,110,0.2)] text-[rgba(201,235,194,0.62)]"
                  : "border-[#556b57]/20 text-[#556b57]",
              )}
            >
              {mode === "dark" ? "Light" : "Dark"}
            </button>
            {STEPS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStep(s);
                  setLastAction(null);
                }}
                className={
                  step === s
                    ? cn(
                        "rounded-full px-3 py-1.5 font-serif text-[11px]",
                        dark
                          ? "border border-[rgba(120,200,110,0.28)] bg-black/20 text-[rgba(218,244,213,0.9)]"
                          : "border border-[#556b57]/28 bg-[#faf7f0] text-[#29261f]",
                      )
                    : cn(
                        "rounded-full border px-3 py-1.5 font-serif text-[11px]",
                        dark
                          ? "border-[rgba(120,200,110,0.14)] text-[rgba(201,235,194,0.48)]"
                          : "border-[#556b57]/14 text-[#6e685d]",
                      )
                }
              >
                {s}
              </button>
            ))}
            <Link href="/">
              <a
                className={cn(
                  "font-serif text-[12px] underline-offset-4 hover:underline",
                  dark ? "text-[rgba(201,235,194,0.58)]" : "text-[#556b57]",
                )}
              >
                Back to app
              </a>
            </Link>
          </div>
        </div>
        {lastAction ? (
          <p
            className={cn(
              "mx-auto mt-2 max-w-[640px] font-serif text-[12px] italic",
              dark ? "text-[rgba(195,240,190,0.62)]" : "text-[#556b57]",
            )}
          >
            Action: {lastAction}
          </p>
        ) : null}
      </div>

      <SiftOnboardingFlow
        step={step}
        draft={draft}
        mode={mode}
        onStepChange={setStep}
        onDraftChange={setDraft}
        previewLabel={step}
        onBegin={() => setStep("choice")}
        onTryFree={() => setLastAction("Try free sifts (would start live sift)")}
        onCreateAccount={() => setLastAction("Create account (would open auth dialog)")}
        onFinish={() => {
          setLastAction(
            `Finish with intent=${draft.primaryIntent ?? "none"}, style=${draft.supportStyle ?? "none"}`,
          );
        }}
      />
    </div>
  );
}
