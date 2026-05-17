import { useEffect, useRef } from "react";
import { makeLumaTick, type LumaMood } from "@/lib/lumaGrainEngine";
import { cn } from "@/lib/utils";

type LumaGrainBackdropProps = {
  mood: LumaMood;
  className?: string;
};

export function LumaGrainBackdrop({ mood, className }: LumaGrainBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const moodRef = useRef<LumaMood>(mood);
  moodRef.current = mood;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
    };
    resize();

    let tickFn = makeLumaTick(moodRef.current, canvas);
    let start: number | null = null;

    const frame = (now: number) => {
      if (start == null) start = now;
      tickFn((now - start) / 1000);
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    const onResize = () => {
      resize();
      start = null;
      tickFn = makeLumaTick(moodRef.current, canvas);
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [mood]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(
        "fixed inset-0 z-0 h-[100dvh] w-full pointer-events-none",
        "opacity-[0.28] dark:opacity-[0.48]",
        className,
      )}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
