import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import { SIFT_LUMA_MOOD_EVENT, type LumaMood } from "@/lib/lumaGrainEngine";

export type CompanionPose = "idle" | "listening" | "thinking" | "speaking";

function moodToPose(m: LumaMood): CompanionPose {
  switch (m) {
    case "listen":
      return "listening";
    case "think":
    case "process":
    case "wait":
      return "thinking";
    case "complete":
      return "idle";
    default:
      return "idle";
  }
}

type PoseKey =
  | "standing"
  | "listening"
  | "thinking"
  | "smiling"
  | "peace"
  | "presenting"
  | "prayer"
  | "explaining"
  | "meditation";

/**
 * Each URL must be a string literal inside `new URL(..., import.meta.url)` so Vite
 * can resolve and emit hashed assets at build time. A helper like `poseAsset(path)`
 * breaks static analysis and breaks images in production.
 */
const POSE_SRC: Record<PoseKey, string> = {
  standing: new URL(
    "../../../Avatars and Scenes/Poses/Standing Pose.png",
    import.meta.url,
  ).href,
  /** No `Listening Attentive` asset in repo right now — neutral stance. */
  listening: new URL(
    "../../../Avatars and Scenes/Poses/Standing Pose.png",
    import.meta.url,
  ).href,
  thinking: new URL(
    "../../../Avatars and Scenes/Poses/Thinking Pose.png",
    import.meta.url,
  ).href,
  smiling: new URL(
    "../../../Avatars and Scenes/Poses/Smiling Pose.png",
    import.meta.url,
  ).href,
  peace: new URL(
    "../../../Avatars and Scenes/Poses/Peace sign pose.png",
    import.meta.url,
  ).href,
  presenting: new URL(
    "../../../Avatars and Scenes/Poses/Presenting Pose.png",
    import.meta.url,
  ).href,
  prayer: new URL(
    "../../../Avatars and Scenes/Poses/thank you prayer hands pose.png",
    import.meta.url,
  ).href,
  explaining: new URL(
    "../../../Avatars and Scenes/Poses/Explaining pose with one hand raised pose.png",
    import.meta.url,
  ).href,
  meditation: new URL(
    "../../../Avatars and Scenes/Poses/Calm Seated Meditation Pose.png",
    import.meta.url,
  ).href,
};

/** Order used for a lightweight “walk” — alternating stance + arm-shift poses. */
const WALK_CYCLE: PoseKey[] = [
  "standing",
  "listening",
  "standing",
  "smiling",
  "standing",
  "presenting",
];

const MOOD_POSE: Record<CompanionPose, PoseKey> = {
  idle: "standing",
  listening: "listening",
  thinking: "thinking",
  speaking: "explaining",
};

type CompanionAvatarProps = {
  className?: string;
  speaking?: boolean;
  /** When true, cycles walk poses + horizontal bob (e.g. crossing the room). */
  walking?: boolean;
  /**
   * `inRoom` — size scales with viewport / room band (sits on rug in layout).
   * `default` — compact tile for dense UI.
   */
  placement?: "default" | "inRoom";
};

/** Rendered box (default placement) in rem — room placement uses responsive classes. */
const DEFAULT_FRAME = "h-[10.5rem] w-[10.5rem] sm:h-44 sm:w-44";

function moodClass(active: CompanionPose) {
  return cn(
    "transition-transform duration-500 ease-out",
    active === "listening" && "scale-[1.04]",
    active === "thinking" && "translate-y-0.5",
    active === "speaking" && "scale-[1.06]",
  );
}

export function CompanionAvatar({
  className,
  speaking,
  walking = false,
  placement = "default",
}: CompanionAvatarProps) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [pose, setPose] = useState<CompanionPose>("idle");
  const [walkStep, setWalkStep] = useState(0);

  useEffect(() => {
    const onMood = (e: Event) => {
      const ce = e as CustomEvent<LumaMood>;
      if (ce.detail) setPose(moodToPose(ce.detail));
    };
    window.addEventListener(SIFT_LUMA_MOOD_EVENT, onMood);
    return () => window.removeEventListener(SIFT_LUMA_MOOD_EVENT, onMood);
  }, []);

  useEffect(() => {
    if (speaking) setPose("speaking");
  }, [speaking]);

  const active = speaking ? "speaking" : pose;

  useEffect(() => {
    if (!walking) setWalkStep(0);
  }, [walking]);

  useEffect(() => {
    if (!walking || reduceMotion) return;
    const id = window.setInterval(() => {
      setWalkStep((s) => (s + 1) % WALK_CYCLE.length);
    }, 220);
    return () => window.clearInterval(id);
  }, [walking, reduceMotion]);

  const src = useMemo(() => {
    if (walking && !reduceMotion) return POSE_SRC[WALK_CYCLE[walkStep]!]!;
    return POSE_SRC[MOOD_POSE[active]]!;
  }, [walking, reduceMotion, walkStep, active]);

  const breathe = !reduceMotion;
  const stride = walking && !reduceMotion;

  useLayoutEffect(() => {
    const root = rootRef.current;
    const frame = frameRef.current;
    if (!root || !frame || reduceMotion) return;

    const ctx = gsap.context(() => {
      if (stride) {
        gsap.to(frame, {
          x: 5,
          y: -2.5,
          duration: 0.55,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
      } else if (breathe) {
        gsap.to(frame, {
          y: -2.5,
          duration: 1.6,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
      }

      const img = imgRef.current;
      if (img && speaking) {
        gsap.to(img, {
          rotation: 1.1,
          duration: 0.85,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          transformOrigin: "50% 90%",
        });
      }
    }, root);

    return () => ctx.revert();
  }, [breathe, stride, reduceMotion, speaking]);

  const frameClass =
    placement === "inRoom"
      ? cn(
          "aspect-square bg-transparent",
          "w-[min(calc(42vmin*2.05),72vw,28rem)] h-[min(calc(42vmin*2.05),72vw,28rem)]",
          "max-h-[min(52dvh,28rem)] max-w-[min(92vw,28rem)]",
        )
      : DEFAULT_FRAME;

  const frameChrome =
    placement === "inRoom"
      ? "relative flex items-end justify-center overflow-visible bg-transparent"
      : "relative overflow-hidden rounded-lg border-2 border-primary shadow-[0_12px_0_rgba(0,0,0,0.35),0_0_24px_hsl(5_100%_69%_/_0.16)]";

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative flex flex-col items-center",
        moodClass(active),
        className,
      )}
      data-companion-pose={active}
      data-companion-walking={walking ? "yes" : "no"}
      aria-hidden
    >
      <div ref={frameRef} className={cn(frameChrome, frameClass)}>
        <img
          ref={imgRef}
          src={src}
          alt=""
          width={512}
          height={512}
          draggable={false}
          style={{
            imageRendering: placement === "inRoom" ? "auto" : "pixelated",
          }}
          className={cn(
            "h-full w-full max-w-none select-none pointer-events-none object-contain object-bottom bg-transparent",
            placement === "inRoom" && "drop-shadow-[0_14px_32px_rgba(0,0,0,0.5)]",
          )}
        />
      </div>
      {placement === "inRoom" ? null : (
        <p
          className={cn(
            "mt-2 tracking-[0.22em] uppercase text-muted-foreground/70 font-medium",
            "text-[9px]",
          )}
        >
          Companion
        </p>
      )}
    </div>
  );
}
