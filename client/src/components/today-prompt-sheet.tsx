import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Share2, PenLine } from "lucide-react";

interface TodayPromptSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called when the user taps "Share this". The caller should close the sheet
   * and open the standalone share card experience.
   */
  onShare: () => void;
  /**
   * Called when the user taps "Free write from this". The caller should close
   * the sheet, prefill the composer with the seed text, and focus/scroll to it.
   */
  onFreeWrite: () => void;
  /**
   * Optional override for the sheet's title. Defaults to the stable wrapper
   * copy when omitted.
   */
  title?: string;
  /**
   * Optional override for the sheet's reflective line. When provided, replaces
   * the default quiet line with today's personalized prompt. Falls back to
   * the default if omitted or empty.
   */
  line?: string;
}

const TODAY_TITLE = "What matters today";
const TODAY_LINE = "You do not need a full plan. You need one visible start.";

/**
 * TodayPromptSheet
 *
 * A small bottom sheet that surfaces today's prompt with three quiet options:
 * share it (opens a dedicated share card dialog), free-write from it, or
 * dismiss. Delegates both share and free-write to the parent so the parent
 * can coordinate transitions between surfaces.
 */
export function TodayPromptSheet({
  open,
  onOpenChange,
  onShare,
  onFreeWrite,
  title,
  line,
}: TodayPromptSheetProps) {
  const displayTitle = title && title.trim().length > 0 ? title : TODAY_TITLE;
  const displayLine = line && line.trim().length > 0 ? line : TODAY_LINE;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[92vh] overflow-y-auto border-t border-border bg-background px-6 pt-6 pb-10 md:max-w-2xl md:mx-auto"
        data-testid="sheet-today-prompt"
      >
        <SheetHeader className="text-left space-y-2">
          <p
            className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-medium"
            data-testid="text-today-sheet-eyebrow"
          >
            Today from Sift
          </p>
          <SheetTitle
            className="font-serif text-xl md:text-2xl leading-snug text-foreground"
            data-testid="text-today-sheet-title"
          >
            {displayTitle}
          </SheetTitle>
          <p
            className="font-serif text-base md:text-lg leading-snug text-muted-foreground"
            data-testid="text-today-sheet-line"
          >
            {displayLine}
          </p>
        </SheetHeader>

        <div className="mt-8 flex flex-col gap-3">
          <Button
            type="button"
            onClick={onShare}
            data-testid="button-today-share"
            variant="outline"
            className="w-full justify-start gap-3 h-11"
          >
            <Share2 className="w-4 h-4" />
            Share this
          </Button>

          <Button
            type="button"
            onClick={onFreeWrite}
            data-testid="button-today-freewrite"
            className="w-full justify-start gap-3 h-11"
          >
            <PenLine className="w-4 h-4" />
            Free write from this
          </Button>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            data-testid="button-today-dismiss"
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
          >
            Not now
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Exported so the share card surface uses identical copy.
export const TODAY_PROMPT_TITLE = TODAY_TITLE;
export const TODAY_PROMPT_LINE = TODAY_LINE;
