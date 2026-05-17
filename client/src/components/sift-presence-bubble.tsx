import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Sift line above the companion — matches the “main chat” board beat
 * (soft bubble over the room, not a full card stack).
 */
export function SiftPresenceBubble({
  className,
  tone = "solid",
  children,
}: {
  className?: string;
  /** `glass` — frosted chip over the scene (board reference). */
  tone?: "solid" | "glass";
  /** Override default settling-in line */
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-[min(94vw,21.5rem)] rounded-[1.75rem] px-4 py-4",
        tone === "glass"
          ? cn(
              "border border-white/50 bg-white/50 shadow-[0_14px_40px_-16px_rgba(15,50,50,0.35)]",
              "backdrop-blur-xl supports-[backdrop-filter]:bg-white/42",
            )
          : cn(
              "border border-white/55 bg-card",
              "shadow-[0_16px_48px_-18px_rgba(55,42,28,0.2),0_4px_14px_-6px_rgba(55,42,28,0.1)]",
            ),
        className,
      )}
      data-testid="sift-presence-bubble"
    >
      <p
        className="font-serif text-[1.0625rem] md:text-[1.125rem] leading-snug text-foreground font-normal tracking-[0.01em]"
        data-testid="text-journal-prompt"
      >
        {children ?? (
          <>
            Hey. How are you feeling as you settle in{" "}
            <span className="whitespace-nowrap">today?</span>
          </>
        )}
      </p>
    </div>
  );
}
