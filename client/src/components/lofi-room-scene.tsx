import { cn } from "@/lib/utils";
import { RoomWindowAtmosphere } from "@/components/room-window-atmosphere";

const BEDROOM_SRC = "/room/bedroom.png";

export type LofiRoomVariant = "fullscreen" | "framed";

type LofiRoomSceneProps = {
  className?: string;
  /**
   * `fullscreen` — fixed viewport layer behind the whole shell (legacy).
   * `framed` — fills a positioned parent (e.g. rounded scene card); use with `overflow-hidden` + `rounded-*` on the parent.
   */
  variant?: LofiRoomVariant;
};

/**
 * Bedroom art from repo `Avatars and Scenes/Bedroom.png` (served as `/room/bedroom.png`).
 */
export function LofiRoomScene({
  className,
  variant = "fullscreen",
}: LofiRoomSceneProps) {
  const framed = variant === "framed";
  return (
    <div
      className={cn(
        framed
          ? "pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
          : "pointer-events-none fixed inset-0 z-0 h-[100dvh] w-full overflow-hidden",
        className,
      )}
      data-scene="lofi-room"
      data-variant={variant}
      aria-hidden
    >
      <img
        src={BEDROOM_SRC}
        alt=""
        className="absolute inset-0 z-0 h-full w-full object-cover object-[50%_72%] md:object-[50%_68%] select-none"
        draggable={false}
      />
      <RoomWindowAtmosphere />
      {/* Warm floor bias + soft bottom fade so dock/composer stay readable without crushing the art */}
      <div
        className="absolute inset-0 z-[2] bg-gradient-to-t from-teal-950/40 via-teal-950/10 to-transparent"
        aria-hidden
      />
    </div>
  );
}
