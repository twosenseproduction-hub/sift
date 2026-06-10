import type { SiftLens } from "@shared/schema";
import { LENS_HELPER_COPY, LENS_LABELS, SIFT_LENSES } from "@/lib/sift-lens";
import { cn } from "@/lib/utils";
import { LensHelpPopover } from "./lens-help-popover";

export function LensSwitcher({
  value,
  onChange,
  disabled,
  className,
}: {
  value: SiftLens;
  onChange: (lens: SiftLens) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("v3-lens-switcher", className)} data-testid="lens-switcher">
      <div className="v3-lens-switcher-header">
        <span className="v3-lens-switcher-label">Lens</span>
        <LensHelpPopover />
      </div>
      <div className="v3-lens-switcher-pills" role="radiogroup" aria-label="Sift lens">
        {SIFT_LENSES.map((lens) => {
          const selected = value === lens;
          return (
            <button
              key={lens}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(lens)}
              className={cn("v3-lens-pill", selected && "selected")}
              data-testid={`lens-pill-${lens}`}
            >
              {LENS_LABELS[lens]}
            </button>
          );
        })}
      </div>
      <p className="v3-lens-helper" aria-live="polite">
        {LENS_HELPER_COPY[value]}
      </p>
    </div>
  );
}
