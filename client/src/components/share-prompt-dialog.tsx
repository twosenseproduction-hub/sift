import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Share2, Download, Loader2, Link2 } from "lucide-react";
import {
  SharePromptCard,
  SHARE_CARD_EXPORT_BACKGROUND,
} from "./share-prompt-card";
import { copyTextToClipboard } from "@/lib/daily-sift-share";

export interface SharePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  line: string;
  eyebrow?: string;
  /** Stable hash URL for “Copy link” (secondary action). */
  shareUrl?: string;
}

/**
 * Build a PNG blob from the offscreen export-mode card. Fixed 1080×1920 so the
 * resulting image is predictable regardless of viewport.
 */
async function renderCardToBlob(node: HTMLElement): Promise<Blob> {
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: SHARE_CARD_EXPORT_BACKGROUND,
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
  shareUrl,
}: SharePromptDialogProps) {
  const { toast } = useToast();
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState<null | "share" | "download" | "copy">(null);

  const today = new Date();

  const handleShare = async () => {
    if (!exportRef.current || busy) return;
    setBusy("share");
    try {
      const blob = await renderCardToBlob(exportRef.current);
      const file = new File([blob], "sift-daily.png", { type: "image/png" });

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
            title: eyebrow ?? "Today from Sift",
            text: line,
          });
          return;
        } catch (err: unknown) {
          if (err instanceof Error && err.name === "AbortError") return;
        }
      }

      triggerDownload(blob);
      toast({
        title: "Image saved",
        description: "Share it from your downloads or photos.",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Try again in a moment.";
      toast({
        title: "Couldn't create image",
        description: message,
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
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Try again in a moment.";
      toast({
        title: "Couldn't download",
        description: message,
      });
    } finally {
      setBusy(null);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl || busy) return;
    setBusy("copy");
    try {
      await copyTextToClipboard(shareUrl);
      toast({
        title: "Link copied",
        description: "Anyone with the link can open this Daily Sift.",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Try again in a moment.";
      toast({
        title: "Couldn't copy link",
        description: message,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[min(100vw-2rem,22rem)] gap-0 border-0 bg-transparent p-0 shadow-none sm:max-w-sm"
        data-testid="dialog-share-prompt"
      >
        <DialogTitle className="sr-only">Share</DialogTitle>
        <DialogDescription className="sr-only">
          Portrait share card you can share, download, or copy a link to.
        </DialogDescription>

        <div className="overflow-hidden rounded-2xl shadow-2xl">
          <SharePromptCard
            title={title}
            line={line}
            eyebrow={eyebrow}
            date={today}
          />
        </div>

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

        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-border bg-background p-3">
          <Button
            type="button"
            onClick={handleShare}
            disabled={!!busy}
            data-testid="button-share-image"
            className="h-11 w-full justify-start gap-3"
          >
            {busy === "share" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            Share
          </Button>
          <Button
            type="button"
            onClick={handleDownload}
            disabled={!!busy}
            variant="outline"
            data-testid="button-download-image"
            className="h-11 w-full justify-start gap-3"
          >
            {busy === "download" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download
          </Button>
          {shareUrl ? (
            <Button
              type="button"
              onClick={handleCopyLink}
              disabled={!!busy}
              variant="ghost"
              data-testid="button-copy-share-link"
              className="h-11 w-full justify-start gap-3 text-muted-foreground"
            >
              {busy === "copy" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Copy link
            </Button>
          ) : null}
        </div>

        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            data-testid="button-share-close"
            className="text-sm text-muted-foreground underline underline-offset-4 decoration-border transition-colors hover:text-foreground hover:decoration-foreground"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function triggerDownload(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sift-daily.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
