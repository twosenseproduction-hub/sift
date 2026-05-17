import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand";
import { Result, RedundancyGateCard } from "@/components/sift-ui";
import { FeedbackPrompt } from "@/components/feedback-prompt";
import type { SiftResult, SiftRedundancyGateResult } from "@shared/schema";

export type RoomChatTurn =
  | { id: string; role: "assistant"; variant: "welcome" }
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; variant: "result"; result: SiftResult }
  | { id: string; role: "assistant"; variant: "redundancy"; gate: SiftRedundancyGateResult };

export function makeWelcomeTurn(): RoomChatTurn {
  return { id: "welcome", role: "assistant", variant: "welcome" };
}

function AssistantRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full max-w-[min(100%,28rem)] mx-auto gap-2.5", className)}>
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600/12 text-teal-700 ring-1 ring-teal-600/18"
        aria-hidden
      >
        <LogoMark size={18} />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function TypingBubble() {
  return (
    <AssistantRow>
      <div
        className="inline-flex items-center gap-1 rounded-2xl border border-white/50 bg-[#fdf6e3]/95 px-3.5 py-2.5 shadow-sm backdrop-blur-sm"
        aria-live="polite"
        aria-label="Sift is thinking"
      >
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-teal-600/75" />
        <span className="typing-dot typing-dot-delay-1 h-1.5 w-1.5 rounded-full bg-teal-600/75" />
        <span className="typing-dot typing-dot-delay-2 h-1.5 w-1.5 rounded-full bg-teal-600/75" />
      </div>
    </AssistantRow>
  );
}

export function RoomChatThread({
  className,
  turns,
  typing,
  me,
  resultLead,
  onResultReset,
  onResultExpand,
  onResultCheckInLater,
  onResultSave,
  redundancyGateHandlers,
}: {
  className?: string;
  turns: RoomChatTurn[];
  typing: boolean;
  me: boolean;
  /** Optional banner above the latest result card (e.g. save thread for signed-out users). */
  resultLead?: ReactNode;
  onResultReset: () => void;
  onResultExpand: () => void;
  onResultCheckInLater: () => void;
  onResultSave?: () => void;
  redundancyGateHandlers: {
    onSomethingChanged: () => Promise<void>;
    onKnowThis: () => Promise<void>;
  };
}) {
  const endRef = useRef<HTMLDivElement>(null);

  const latestResultId = [...turns]
    .reverse()
    .find((t) => t.role === "assistant" && t.variant === "result")
    ?.id;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns, typing]);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-2 pb-3 pt-1",
        "[scrollbar-gutter:stable]",
        className,
      )}
      data-testid="room-chat-thread"
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3.5">
        {turns.map((turn) => {
          if (turn.role === "user") {
            return (
              <div key={turn.id} className="flex justify-end" data-testid="room-chat-user">
                <div className="max-w-[min(88%,22rem)] rounded-[1.25rem] rounded-br-md bg-teal-600 px-3.5 py-2.5 text-[15px] leading-snug text-white shadow-sm">
                  <p className="whitespace-pre-wrap break-words">{turn.text}</p>
                </div>
              </div>
            );
          }
          if (turn.variant === "welcome") {
            return (
              <div key={turn.id} data-testid="room-chat-welcome">
                <AssistantRow>
                  <div className="rounded-[1.75rem] border border-white/55 bg-[#fdf6e3] px-4 py-3.5 shadow-[0_12px_36px_-14px_rgba(15,70,70,0.14)]">
                    <p className="text-[1.0625rem] font-medium leading-snug text-teal-950/90">
                      Hey. How are you feeling as you settle in{" "}
                      <span className="whitespace-nowrap">today?</span>
                    </p>
                  </div>
                </AssistantRow>
              </div>
            );
          }
          if (turn.variant === "redundancy") {
            return (
              <div key={turn.id} data-testid="room-chat-redundancy">
                <AssistantRow>
                  <div className="rounded-2xl border border-border/45 bg-card/95 p-1 shadow-md">
                    <RedundancyGateCard
                      gate={turn.gate}
                      onSomethingChanged={redundancyGateHandlers.onSomethingChanged}
                      onKnowThis={redundancyGateHandlers.onKnowThis}
                    />
                  </div>
                </AssistantRow>
              </div>
            );
          }
          if (turn.variant === "result") {
            return (
              <div key={turn.id} data-testid="room-chat-result">
                <AssistantRow>
                  <div className="space-y-3">
                    {latestResultId === turn.id && resultLead ? resultLead : null}
                    <div className="rounded-2xl border border-border/45 bg-card/95 p-2 shadow-md sm:p-3">
                      <Result
                        result={turn.result}
                        onReset={onResultReset}
                        showFollowup
                        onExpand={onResultExpand}
                        onCheckInLater={onResultCheckInLater}
                        onSave={onResultSave}
                        quietChrome
                      />
                    </div>
                    {me ? (
                      <FeedbackPrompt stage="result" siftId={turn.result.id} />
                    ) : null}
                  </div>
                </AssistantRow>
              </div>
            );
          }
          return null;
        })}

        {typing ? <TypingBubble key="typing" /> : null}
        <div ref={endRef} className="h-px w-full shrink-0" aria-hidden />
      </div>
    </div>
  );
}
