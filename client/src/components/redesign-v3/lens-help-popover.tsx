import { useState } from "react";
import type { SiftLens } from "@shared/schema";
import {
  LENS_DESCRIPTIONS,
  LENS_LABELS,
  SIFT_LENSES,
} from "@/lib/sift-lens";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function LensHelpPopover({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("v3-lens-help-trigger", className)}
          aria-label="What is a lens?"
          data-testid="lens-help-trigger"
        >
          What is a lens?
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={6}
        className="v3-lens-help-popover"
        data-testid="lens-help-popover"
      >
        <p className="v3-lens-help-title">Three lenses</p>
        <p className="v3-lens-help-lead">
          Choose how Sift meets what you bring. You can switch anytime before a
          sift.
        </p>
        <ul className="v3-lens-help-list">
          {SIFT_LENSES.map((lens: SiftLens) => (
            <li key={lens} className="v3-lens-help-item">
              <span className="v3-lens-help-item-label">{LENS_LABELS[lens]}</span>
              <span className="v3-lens-help-item-desc">
                {LENS_DESCRIPTIONS[lens]}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
