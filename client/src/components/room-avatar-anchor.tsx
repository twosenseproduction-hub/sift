import { Children, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Anchors Sift + companion to the lower third of the room pane so scale and
 * placement read against the bedroom art (rug / floor).
 *
 * When there are two children (e.g. `SiftPresenceBubble` + `CompanionAvatar`),
 * the first is centered; the second is centered on small screens and
 * stage-right from `sm` up so the middle stays open for copy.
 * A single child is treated as the character only and aligned to the right.
 */
export function RoomAvatarAnchor({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const nodes = Children.toArray(children).filter(
    (node) => node !== null && node !== undefined,
  );
  const hasDialogue = nodes.length >= 2;
  const dialogue = hasDialogue ? nodes[0] : null;
  const character = hasDialogue ? nodes[1]! : nodes[0];

  if (character == null) {
    return (
      <div
        className={cn(
          "relative flex-1 w-full min-h-[min(36dvh,280px)] md:min-h-[min(38dvh,300px)]",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative flex-1 w-full min-h-[min(36dvh,280px)] md:min-h-[min(38dvh,300px)]",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 top-[4%] flex flex-col justify-end"
      >
        <div
          className={cn(
            "pointer-events-auto w-full px-2 sm:px-3",
            /* Sit on the rug: bias slightly above the bottom nav + safe area */
            "pb-[min(6dvh,2.25rem)] md:pb-[min(8dvh,2.75rem)]",
          )}
        >
          {hasDialogue ? (
            <div className="mx-auto flex w-full max-w-3xl flex-col items-stretch gap-3 sm:flex-row sm:items-end sm:gap-4">
              <div
                className="hidden min-w-0 flex-1 sm:block"
                aria-hidden
              />
              <div className="z-10 flex shrink-0 justify-center">{dialogue}</div>
              <div className="flex min-w-0 flex-1 justify-center sm:justify-end">
                {character}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-row justify-end pr-1 sm:pr-2">
              {character}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
