import { Fragment, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { CompanionAvatar } from "@/components/bedroom-session/companion-avatar";
import type { RecapModel } from "./recap-card";
import { RecapStrip } from "./recap-card";

export type ChatBubble = {
  id: string;
  role: "user" | "sift";
  text: string;
};

/** Same Sift styling for welcome and replies; soft outline ~10%. */
function bubbleShell(role: ChatBubble["role"]) {
  return role === "user"
    ? "rounded-[1rem] rounded-br-sm border border-[color:var(--color-walnut)]/11 bg-[color:var(--color-surface)]/80 text-[color:var(--color-text)]"
    : "rounded-[1rem] rounded-bl-sm border border-[color:var(--color-walnut)]/11 bg-[color:var(--color-surface)]/80 text-[color:var(--color-text)]";
}

export function ConversationCard({
  bubbles,
  thinking,
  recap,
  phase,
  showCompanion = true,
  nextStepDone,
  onToggleNextStep,
  footerVisible = false,
}: {
  bubbles: ChatBubble[];
  thinking: boolean;
  recap: RecapModel | null;
  phase: "warmup" | "structured";
  showCompanion?: boolean;
  nextStepDone: boolean;
  onToggleNextStep: () => void;
  footerVisible?: boolean;
}) {
  const hasSift = useMemo(
    () => bubbles.some((b) => b.role === "sift"),
    [bubbles],
  );

  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [bubbles.length, footerVisible, recap, thinking]);

  return (
    <>
      <div
        ref={listRef}
        className={cn(
          "bedroom-conversation-messages flex-1 min-h-0 overflow-y-auto overflow-x-hidden touch-pan-y space-y-2.5 overscroll-y-contain px-3 py-2 [-webkit-overflow-scrolling:touch] sm:space-y-3 sm:px-4 sm:py-2.5",
        )}
      >
        {bubbles.map((b, i) => (
          <Fragment key={b.id}>
            <div className="w-full space-y-1">
              <div
                className={cn(
                  "flex w-full",
                  b.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "flex max-w-[92%] items-center gap-1.5 sm:max-w-[90%] sm:gap-2",
                    b.role === "user" ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  {showCompanion && b.role === "sift" ? (
                    <CompanionAvatar variant="chip" status="idle" />
                  ) : null}
                  <div
                    className={cn(
                      "min-w-0 flex-1 px-2.5 py-2 text-[16px] leading-[1.45] tracking-[-0.01em] whitespace-pre-wrap sm:px-3 sm:text-[17px]",
                      bubbleShell(b.role),
                    )}
                  >
                    {b.text}
                  </div>
                </div>
              </div>
              {thinking && b.role === "user" && i === bubbles.length - 1 ? (
                <p className="ml-auto max-w-[92%] pl-2 text-[11px] text-[color:var(--color-text-muted)]">
                  Sift is listening…
                </p>
              ) : null}
            </div>
          </Fragment>
        ))}

        {thinking &&
        bubbles.length > 0 &&
        bubbles[bubbles.length - 1]?.role !== "user" ? (
          <p className="text-center text-[11px] text-[color:var(--color-text-muted)]">
            Sift is listening…
          </p>
        ) : null}
      </div>

      {phase === "structured" && recap && hasSift ? (
        <div className="max-h-[min(34dvh,38%)] min-h-0 shrink overflow-y-auto px-3 sm:px-4 [-webkit-overflow-scrolling:touch]">
          <RecapStrip
            recap={recap}
            nextStepDone={nextStepDone}
            onToggleNextStep={onToggleNextStep}
          />
        </div>
      ) : null}

    </>
  );
}
