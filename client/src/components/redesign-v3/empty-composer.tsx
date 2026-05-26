import { cn } from "@/lib/utils";
import { FIRST_USE_STARTERS } from "@/components/bedroom-session/first-use-flow";
import type { DailyPromptCardModel } from "@/components/bedroom-session/daily-prompt-card";
import { ComposerIntro } from "./composer-intro";
import { DailyPromptCardV3, DailyPromptCardV3Skeleton } from "./daily-prompt-card";

export function RedesignV3EmptyComposer({
  onStarterSelect,
  onDailyPromptShare,
  disabled,
  dailyPrompt,
  dailyPromptLoading,
  dailyPromptActive,
}: {
  onStarterSelect: (prompt: string) => void;
  onDailyPromptShare?: () => void;
  disabled?: boolean;
  dailyPrompt?: DailyPromptCardModel | null;
  dailyPromptLoading?: boolean;
  dailyPromptActive?: boolean;
}) {
  const showDaily = dailyPromptLoading || Boolean(dailyPrompt?.promptText);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-start justify-center px-5 py-8 text-left">
      <ComposerIntro className="mx-auto w-full max-w-[26rem]" />
      <p className="mx-auto mt-5 max-w-[26rem] text-[13px] font-light leading-relaxed text-[color:var(--v3-text-secondary)]">
        Type or paste the tangle. Unpolished is fine.
      </p>

      {showDaily ? (
        <div className="mx-auto mt-6 flex w-full max-w-[26rem] flex-col items-stretch gap-4">
          {dailyPromptLoading && !dailyPrompt ? (
            <DailyPromptCardV3Skeleton />
          ) : dailyPrompt ? (
            <DailyPromptCardV3
              prompt={dailyPrompt}
              disabled={disabled}
              active={dailyPromptActive}
              onSelect={onStarterSelect}
              onShare={onDailyPromptShare}
            />
          ) : null}
          <p className="text-center text-[11px] text-[color:var(--v3-text-muted)]">
            Or choose a softer entry
          </p>
        </div>
      ) : null}

      <div
        className={cn(
          "mx-auto flex max-w-[26rem] flex-wrap justify-center gap-2",
          showDaily ? "mt-3" : "mt-6",
        )}
      >
        {FIRST_USE_STARTERS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={disabled}
            onClick={() => onStarterSelect(prompt)}
            className="v3-starter-chip disabled:opacity-45"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
