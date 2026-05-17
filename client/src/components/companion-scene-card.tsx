import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LofiRoomScene } from "@/components/lofi-room-scene";

/**
 * Single rounded “device” frame from the board: pixel room fills the card,
 * overlays (companion + bubble) sit inside the same clipped surface.
 */
export function CompanionSceneCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto flex w-full max-w-[min(100%,22rem)] flex-1 flex-col overflow-hidden rounded-[2rem] sm:max-w-md",
        "min-h-[min(46dvh,340px)] max-h-[min(56dvh,520px)]",
        "border border-white/45 bg-teal-950/[0.08] shadow-[0_22px_56px_-20px_rgba(12,48,48,0.45)]",
        "ring-1 ring-teal-950/[0.06]",
        className,
      )}
      data-testid="companion-scene-card"
    >
      <LofiRoomScene variant="framed" />
      <div className="pointer-events-none absolute inset-0 z-[3] flex flex-col p-3 sm:p-4">
        <div className="pointer-events-auto flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
