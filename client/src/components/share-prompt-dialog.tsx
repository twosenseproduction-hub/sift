import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Share2, Download, Loader2 } from "lucide-react";
import { SharePromptCard } from "./share-prompt-card";

interface SharePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  line: string;
  eyebrow?: string;
}

/**
 * Build a PNG blob from the offscreen export-mode card. The offscreen node is
 * fixed-size (1080x1350) so the resulting image is predictable regardless of
 * viewport. We dynamically import html-to-image so the main bundle stays light.
 */
async function renderCardToBlob(node: HTMLElement): Promise<Blob> {
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: "#F7F6F2",
  });
  const res = await fetch(dataUrl);
  return await res.blob();
}

export function SharePromptDialog({
  open,
  onOpenChange,
  title,
  line,
  eyebrow,
}: SharePromptDialogProps) {
  const { toast } = useToast();
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState<null | "share" | "download">(null);

  const today = new Date();

  const handleShare = async () => {
    if (!exportRef.current || busy) return;
    setBusy("share");
    try {
      const blob = await renderCardToBlob(exportRef.current);
      const file = new File([blob], "sift-today.png", { type: "image/png" });

      // Prefer native share with the image file where supported (iOS/Android).
      const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
      };
      if (
        typeof nav.share === "function" &&
        typeof nav.canShare === "function" &&
        nav.canShare({ files: [file] })
      ) {
        try {
          await nav.share({
            files: [file],
            title: "Today from Sift",
            text: `${title} — ${line}`,
          });
          return;
        } catch (err: any) {
          if (err?.name === "AbortError") return;
          // fall through to download fallback
        }
      }

      // Fallback: trigger a download so the user can share the image manually.
      triggerDownload(blob);
      toast({
        title: "Image saved",
        description: "Share it from your downloads or photos.",
      });
    } catch (err: any) {
      toast({
        title: "Couldn't create image",
        description: err?.message ?? "Try again in a moment.",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    if (!exportRef.current || busy) return;
    setBusy("download");
    try {
      const blob = await renderCardToBlob(exportRef.current);
      triggerDownload(blob);
    } catch (err: any) {
      toast({
        title: "Couldn't download",
        description: err?.message ?? "Try again in a moment.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden bg-background border border-border"
        data-testid="dialog-share-prompt"
      >
        {/* Visually hidden heading for screen readers; the card itself is
            already a self-contained titled surface. */}
        <DialogTitle className="sr-only">Share today’s prompt</DialogTitle>
        <DialogDescription className="sr-only">
          A standalone card with today’s prompt that you can share or download
          as an image.
        </DialogDescription>

        <div className="px-6 pt-6 pb-5 md:px-8 md:pt-8 md:pb-6">
          <p
            className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground font-medium mb-4"
            data-testid="text-share-dialog-eyebrow"
          >
            Share preview
          </p>

          {/* On-screen preview — fluid, aspect-locked. */}
          <div className="mb-6">
            <SharePromptCard
              title={title}
              line={line}
              eyebrow={eyebrow}
              date={today}
            />
          </div>

          {/* Offscreen, fixed-size export node. Hidden from users and a11y but
              kept in the DOM so html-to-image can read computed styles and
              web fonts. Positioned absolutely with opacity 0 + pointer-events
              none so it never interferes with layout. */}
          <div
            aria-hidden
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              zIndex: -1,
              opacity: 0,
              pointerEvents: "none",
              transform: "translate(-200vw, -200vh)",
            }}
          >
            <SharePromptCard
              ref={exportRef}
              title={title}
              line={line}
              eyebrow={eyebrow}
              date={today}
              exportMode
            />
          </div>

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              onClick={handleShare}
              disabled={!!busy}
              data-testid="button-share-image"
              className="w-full justify-start gap-3 h-11"
            >
              {busy === "share" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
              Share
            </Button>
            <Button
              type="button"
              onClick={handleDownload}
              disabled={!!busy}
              variant="outline"
              data-testid="button-download-image"
              className="w-full justify-start gap-3 h-11"
            >
              {busy === "download" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download
            </Button>
          </div>

          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              data-testid="button-share-close"
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function triggerDownload(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sift-today.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
