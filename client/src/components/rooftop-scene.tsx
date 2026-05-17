import { cn } from "@/lib/utils";
import {
  skyGradientCss,
  type RooftopSkylineVariant,
} from "@/lib/scenes/rooftopCatalog";

type RooftopSceneProps = {
  variant: RooftopSkylineVariant;
  className?: string;
  /** Silhouette height as fraction of container (bottom-anchored). */
  silhouetteHeightPct?: number;
};

/**
 * Full-bleed rooftop layer: CSS sky + bottom-anchored silhouette asset.
 */
export function RooftopScene({
  variant,
  className,
  silhouetteHeightPct = 38,
}: RooftopSceneProps) {
  const bg = skyGradientCss(variant.skyGradient);
  const src = variant.assets.silhouette;

  return (
    <div
      className={cn("relative h-full w-full overflow-hidden", className)}
      data-rooftop-variant={variant.id}
    >
      <div className="absolute inset-0" style={{ background: bg }} aria-hidden />
      {src ? (
        <img
          src={src}
          alt=""
          className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto w-full max-w-[140%] select-none"
          style={{
            height: "auto",
            maxHeight: `${silhouetteHeightPct}%`,
            objectFit: "contain",
            objectPosition: "bottom center",
          }}
          draggable={false}
        />
      ) : null}
    </div>
  );
}
