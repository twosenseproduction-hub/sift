import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Share2, PenLine } from "lucide-react";

interface TodayPromptSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called when the user taps "Free write from this". The caller should close
   * the sheet, prefill the composer with the seed text, and focus/scroll to it.
   */
  onFreeWrite: () => void;
}

const TODAY_TITLE = "What matters today";
const TODAY_LINE = "You do not need a full plan. You need one visible start.";

/**
 * TodayPromptSheet
 *
 * A small bottom sheet that surfaces today's prompt with three quiet options:
 * share it, free-write from it, or dismiss. Keeps the main page calm — all
 * the action happens inside the sheet so the composer stays undisturbed.
 */
export function TodayPromptSheet({
  open,
  onOpenChange,
  onFreeWrite,
}: TodayPromptSheetProps) {
  const { toast } = useToast();

  const handleShare = async () => {
    const shareUrl =
      typeof window !== "undefined" ? window.location.href : "";
    const shareText = `${TODAY_TITLE} — ${TODAY_LINE}`;

    // Prefer native share sheet where available.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: TODAY_TITLE,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        // User cancelled — do nothing. Any other error falls through to clipboard.
        if (err?.name === "AbortError") return;
      }
    }

    // Fallback: copy to clipboard.
    const clipboardText = shareUrl ? `${shareText}\n${shareUrl}` : shareText;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(clipboardText);
        toast({ title: "Copied to clipboard" });
        return;
      }
    } catch {
      // fall through
    }

    // Final placeholder: surface the text so the user can copy manually.
    toast({ title: "Share this", description: clipboardText });
  };

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
            {TODAY_TITLE}
          </SheetTitle>
          <p
            className="font-serif text-base md:text-lg leading-snug text-muted-foreground"
            data-testid="text-today-sheet-line"
          >
            {TODAY_LINE}
          </p>
        </SheetHeader>

        <div className="mt-8 flex flex-col gap-3">
          <Button
            type="button"
            onClick={handleShare}
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
