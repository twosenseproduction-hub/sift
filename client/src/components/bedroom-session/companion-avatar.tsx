import { cn } from "@/lib/utils";

const STANDING_SRC = new URL(
  "../../../../Avatars and Scenes/Poses/Standing Pose.png",
  import.meta.url,
).href;

const THINKING_SRC = new URL(
  "../../../../Avatars and Scenes/Poses/Thinking Pose.png",
  import.meta.url,
).href;

const PRESENTING_SRC = new URL(
  "../../../../Avatars and Scenes/Poses/Presenting Pose.png",
  import.meta.url,
).href;

const CELEBRATING_SRC = new URL(
  "../../../../Avatars and Scenes/Poses/Celebrating Pose.png",
  import.meta.url,
).href;

const CHAT_HEAD_SRC = new URL(
  "../../../../Avatars and Scenes/Poses/Chat head.png",
  import.meta.url,
).href;

export type CompanionAvatarStatus =
  | "idle"
  | "thinking"
  | "presenting"
  | "listening"
  | "celebrating";

export function CompanionAvatar({
  variant,
  status = "idle",
  className,
}: {
  variant: "room" | "chip";
  /** Reserved for future assets; adjusts micro-motion only. */
  status?: CompanionAvatarStatus;
  className?: string;
}) {
  const mood =
    variant === "room"
      ? cn(
          "transition-transform duration-500 ease-out will-change-transform",
          status === "thinking" && "scale-[1.035] -translate-y-1",
          status === "presenting" && "scale-[1.04]",
          status === "listening" && "scale-[1.04]",
          status === "celebrating" && "scale-[1.07]",
        )
      : cn(
          "transition-transform duration-500 ease-out",
          status === "thinking" && "scale-[1.04]",
          status === "presenting" && "scale-[1.05]",
          status === "listening" && "scale-[1.06]",
          status === "celebrating" && "scale-[1.09]",
        );

  const imgShared =
    "select-none bg-transparent pointer-events-none object-contain object-bottom";
  const roomSrc =
    status === "thinking"
      ? THINKING_SRC
      : status === "presenting"
        ? PRESENTING_SRC
      : status === "celebrating"
        ? CELEBRATING_SRC
        : STANDING_SRC;

  if (variant === "room") {
    return (
      <div
        className={cn(
          mood,
          "relative flex items-end justify-center",
          "[filter:drop-shadow(0_12px_28px_rgba(41,38,31,0.28))]",
          className,
        )}
        aria-hidden
      >
        <div
          className="pointer-events-none absolute bottom-[0.125rem] left-1/2 z-0 h-[min(0.85rem,13px)] w-[min(62%,11.5rem)] max-w-[220px] -translate-x-1/2 rounded-[100%] bg-[color:rgba(41,38,31,0.2)] blur-[14px] sm:bottom-0 sm:h-3.5 sm:w-[min(58%,12rem)] sm:blur-[18px]"
          aria-hidden
        />
        <img
          src={roomSrc}
          alt=""
          width={512}
          height={512}
          draggable={false}
          className={cn(
            imgShared,
            "relative z-[1] h-full min-h-[154px] max-h-full w-auto max-w-[min(74vw,340px)] sm:min-h-[168px] sm:max-w-[min(52.5vw,340px)]",
          )}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        mood,
        "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden sm:h-[3.75rem] sm:w-[3.75rem]",
        className,
      )}
      aria-hidden
    >
      <img
        src={CHAT_HEAD_SRC}
        alt=""
        width={128}
        height={128}
        draggable={false}
        style={{ imageRendering: "pixelated" }}
        className={cn(
          "h-full w-full select-none bg-transparent object-cover object-center pointer-events-none",
          "[filter:drop-shadow(0_2px_6px_rgba(41,38,31,0.22))]",
        )}
      />
    </div>
  );
}
