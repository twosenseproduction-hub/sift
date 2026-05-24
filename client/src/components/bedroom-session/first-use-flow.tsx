import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRedesignV3 } from "@/lib/use-redesign-v3";
import { RedesignV3EmptyComposer } from "@/components/redesign-v3/empty-composer";
import { SessionComposer } from "./session-composer";
import {
  DailyPromptCard,
  DailyPromptCardSkeleton,
  type DailyPromptCardModel,
} from "./daily-prompt-card";

export const FIRST_USE_STARTERS = [
  "Something's been sitting heavy",
  "I can't tell what matters most",
  "I keep replaying a conversation",
  "I feel off but I can't explain why",
] as const;

export function FirstUseWelcome({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 text-center", className)}>
      <p className="font-serif text-[30px] leading-none tracking-[-0.05em] text-[color:var(--color-text)] sm:text-[36px]">
        I&apos;m here.
      </p>
      <div className="mx-auto max-w-[25rem] space-y-2">
        <p className="text-[15px] leading-relaxed text-[color:var(--color-text)]/82">
          Share what feels loud, tangled, or hard to name.
        </p>
        <p className="text-[12px] leading-relaxed text-[color:var(--color-text-muted)]">
          Sift helps you tell what matters from what is only loud.
        </p>
      </div>
    </div>
  );
}

export function StarterPromptChips({
  onSelect,
  disabled,
  className,
}: {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap justify-center gap-2", className)}>
      {FIRST_USE_STARTERS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          className="rounded-full border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]/58 px-3 py-1.5 text-[12px] font-medium text-[color:var(--color-text-muted)] shadow-[0_12px_30px_-26px_rgba(0,0,0,0.55)] backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-[color:var(--color-surface)]/82 hover:text-[color:var(--color-text)] disabled:opacity-45"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}

export function EmptyConversationState({
  onStarterSelect,
  disabled,
  dailyPrompt,
  dailyPromptLoading,
  dailyPromptActive,
}: {
  onStarterSelect: (prompt: string) => void;
  disabled?: boolean;
  dailyPrompt?: DailyPromptCardModel | null;
  dailyPromptLoading?: boolean;
  dailyPromptActive?: boolean;
}) {
  const { enabled: redesignV3 } = useRedesignV3();
  const showDaily = dailyPromptLoading || Boolean(dailyPrompt?.promptText);

  if (redesignV3) {
    return (
      <RedesignV3EmptyComposer
        disabled={disabled}
        onStarterSelect={onStarterSelect}
        dailyPrompt={dailyPrompt}
        dailyPromptLoading={dailyPromptLoading}
        dailyPromptActive={dailyPromptActive}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-8">
      <FirstUseWelcome />
      <p className="mt-7 max-w-[24rem] text-center text-[12px] leading-relaxed text-[color:var(--color-text-muted)]">
        Speak or type the tangle. I&apos;ll help you find the signal underneath.
      </p>

      {showDaily ? (
        <div className="mt-6 flex w-full flex-col items-center gap-4">
          {dailyPromptLoading && !dailyPrompt ? (
            <DailyPromptCardSkeleton />
          ) : dailyPrompt ? (
            <DailyPromptCard
              prompt={dailyPrompt}
              disabled={disabled}
              active={dailyPromptActive}
              onSelect={onStarterSelect}
            />
          ) : null}
          <p className="text-[11px] text-[color:var(--color-text-muted)]">
            Or choose a softer entry
          </p>
        </div>
      ) : null}

      <StarterPromptChips
        className={cn("max-w-[25rem]", showDaily ? "mt-3" : "mt-5")}
        disabled={disabled}
        onSelect={onStarterSelect}
      />
    </div>
  );
}

export function VoiceEntryCTA({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border-soft)] px-3 py-1.5 text-[12px] font-medium text-[color:var(--color-text-muted)] transition hover:text-[color:var(--color-text)] disabled:opacity-45"
    >
      <Mic className="h-3.5 w-3.5" />
      Voice
    </button>
  );
}

export function Composer(props: Parameters<typeof SessionComposer>[0]) {
  return <SessionComposer {...props} />;
}

export function LowContextReplyPattern() {
  return null;
}

export function SiftReadyPrompt({
  onRequestSummary,
  onDismiss,
  busy,
}: {
  onRequestSummary: () => void;
  onDismiss: () => void;
  busy?: boolean;
}) {
  return (
    <div className="mx-3 mb-2 shrink-0 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]/90 px-3 py-2 shadow-[var(--bedroom-tray-shadow)] sm:mx-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-[color:var(--color-text)]">
          I think I can sift this now.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onRequestSummary}
            className="rounded-full bg-[color:var(--color-primary)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--color-surface)] transition hover:opacity-[0.96] disabled:opacity-45"
          >
            Pull it together
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            className="text-[11px] text-[color:var(--color-text-muted)] underline-offset-4 transition hover:text-[color:var(--color-text)] hover:underline disabled:opacity-45"
          >
            Not yet
          </button>
        </div>
      </div>
    </div>
  );
}

export function FirstClaritySheetTransition() {
  return null;
}
