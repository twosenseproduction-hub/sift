import { cn } from "@/lib/utils";

export function SiftBaseBackground({ mode = "dark" }: { mode?: "dark" | "light" }) {
  return (
    <div
      className={cn(
        "sift-base-background",
        mode === "light" && "sift-base-background-light",
      )}
      aria-hidden
    >
      <div className="sift-base-orb sift-base-orb-a" />
      <div className="sift-base-orb sift-base-orb-b" />
      <div className="sift-base-orb sift-base-orb-c" />
      {mode === "light" ? <div className="sift-base-orb sift-base-orb-d" /> : null}
      <div className="sift-base-noise" />
      <div className="sift-base-vignette" />
    </div>
  );
}
