import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Soft motion clipped to the bedroom window (see `public/room/bedroom.png`).
 * Percents are tuned for `object-cover` + `object-center`; nudge if art changes.
 */
export function RoomWindowAtmosphere({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-[1] overflow-hidden rounded-[2px]",
        /* Back wall window — center band, upper third */
        "left-[17%] top-[10%] h-[31%] w-[66%]",
        "min-[480px]:left-[19%] min-[480px]:top-[9.5%] min-[480px]:h-[30%] min-[480px]:w-[62%]",
        "md:left-[21%] md:top-[9%] md:h-[29%] md:w-[58%]",
        className,
      )}
      aria-hidden
    >
      {/* Drifting haze — warm tints to sit on sunset sky */}
      <div
        className="absolute -left-[8%] top-[8%] h-[42%] w-[55%] rounded-full bg-orange-100/25 blur-2xl animate-room-cloud-a"
        style={{ willChange: "transform" }}
      />
      <div
        className="absolute right-[-5%] top-[22%] h-[38%] w-[48%] rounded-full bg-rose-200/20 blur-2xl animate-room-cloud-b"
        style={{ willChange: "transform" }}
      />
      <div
        className="absolute left-[25%] top-[38%] h-[35%] w-[45%] rounded-full bg-primary-foreground/14 blur-xl animate-room-cloud-c"
        style={{ willChange: "transform" }}
      />
      {/* Occasional birds — long cycles, opposite directions */}
      <div
        className="absolute inset-0 text-[0.55rem] leading-none text-orange-950/75 sm:text-[0.65rem]"
        style={{ willChange: "transform, opacity" }}
      >
        <span className="absolute left-0 top-0 inline-block animate-room-bird-1">
          <BirdGlyph />
        </span>
        <span
          className="absolute left-0 top-0 inline-block animate-room-bird-2 [animation-delay:34s]"
        >
          <BirdGlyph />
        </span>
      </div>
    </div>
  );
}

function BirdGlyph() {
  return (
    <svg
      width="16"
      height="10"
      viewBox="0 0 16 10"
      className="drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]"
      aria-hidden
    >
      <path
        d="M1 7 L8 2.5 L15 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
