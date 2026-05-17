import { cn } from "@/lib/utils";
import {
  CompanionAvatar,
  type CompanionAvatarStatus,
} from "@/components/bedroom-session/companion-avatar";

const BEDROOM_SRC = "/room/bedroom.png";
const DESK_SRC = "/room/computer-desk.png";
const ROOFTOP_SRC = "/room/rooftop.png";
const LIBRARY_SRC = "/room/library.png";

/** Placement + size of the bedroom art (shared by image and avatar slot). */
const SCENE_PLACEMENT =
  "absolute left-1/2 top-0 w-full min-w-[100%] -translate-x-1/2 h-[min(68dvh,560px)] sm:h-[min(62dvh,600px)]";

/**
 * Full-bleed bedroom art with a feathered lower wash so the room stays visible
 * and blends into the page without a hard seam.
 *
 * The companion sits in a scene-sized slot (same box as the art) so it stays on
 * the rug inside the image — not anchored to the full viewport / tray.
 *
 * The overlay is height-clamped (not full-screen): the chat column sits below in
 * z-order and must stay visible; only the upper band stacks above the paper card.
 */
export function BedroomBackdrop({
  className,
  companionStatus = "idle",
  inSummaryMode = false,
  scene = "bedroom",
  showCompanion = true,
}: {
  className?: string;
  companionStatus?: CompanionAvatarStatus;
  inSummaryMode?: boolean;
  scene?: "bedroom" | "desk" | "rooftop" | "library";
  showCompanion?: boolean;
}) {
  const sceneSources = [
    ["bedroom", BEDROOM_SRC],
    ["desk", DESK_SRC],
    ["rooftop", ROOFTOP_SRC],
    ["library", LIBRARY_SRC],
  ] as const;
  return (
    <>
      <div
        className={cn(
          "bedroom-scene-overlay pointer-events-none fixed inset-x-0 top-0 z-[20] overflow-hidden",
          /* Match scene art height only; below this band there is no overlay so z-10 chat is visible. */
          "h-[min(68dvh,560px)] sm:h-[min(62dvh,600px)]",
          className,
        )}
        aria-hidden
      >
        <div
          className={cn(
            SCENE_PLACEMENT,
            "z-0 transition-[filter,opacity] duration-300 ease-out",
            inSummaryMode && "brightness-[.93] opacity-[.94]",
          )}
        >
          {sceneSources.map(([name, src]) => (
            <img
              key={name}
              src={src}
              alt=""
              className={cn(
                "bedroom-scene-img absolute inset-0 z-0 h-full w-full select-none transition-opacity duration-500 ease-out",
                scene === name ? "opacity-100" : "opacity-0",
              )}
              draggable={false}
            />
          ))}
        </div>
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-[1] opacity-0 transition-opacity duration-300 ease-out",
            inSummaryMode && "opacity-100",
          )}
          style={{
            background:
              "radial-gradient(circle at 50% 72%, rgba(244,240,230,0.16), rgba(244,240,230,0.05) 46%, transparent 74%)",
          }}
          aria-hidden
        />
        <div className="bedroom-atmosphere-feather absolute inset-0 z-[1]" />
        <div className="bedroom-scene-chat-bridge" aria-hidden />
      </div>

      {showCompanion ? (
        <div
          className={cn(
            "pointer-events-none fixed inset-x-0 top-0 overflow-visible",
            "h-[min(68dvh,560px)] sm:h-[min(62dvh,600px)]",
            inSummaryMode ? "z-[24]" : "z-[20]",
          )}
          aria-hidden
        >
          <div className={cn(SCENE_PLACEMENT, "z-[2]")}>
            <div
              className={cn(
                "absolute left-1/2 -translate-x-1/2 transition-[bottom,height] duration-300 ease-out",
                inSummaryMode
                  ? "bottom-[2%] h-[78%] sm:bottom-[2%] sm:h-[62%] lg:h-[68%]"
                  : "bottom-[7%] h-[42%] sm:bottom-[10%] sm:h-[36%]",
              )}
            >
              <CompanionAvatar
                variant="room"
                status={companionStatus}
                className={cn(
                  "h-full origin-bottom",
                  inSummaryMode && "scale-[1.9] sm:scale-[1.35] lg:scale-[1.42]",
                )}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
