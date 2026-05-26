import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute, useLocation } from "wouter";
import { Share2, PenLine, ArrowLeft } from "lucide-react";
import { SiftAppShell } from "@/components/redesign-v3";
import { Button } from "@/components/ui/button";
import { useDailySiftShare } from "@/hooks/use-daily-sift-share";
import { apiRequest } from "@/lib/queryClient";
import type { DailyPromptResponse } from "@/lib/useDailyPrompt";
import {
  dailySiftPageDescription,
  resetPageMeta,
  setPageMeta,
} from "@/lib/page-meta";
import { SharePromptDialog } from "@/components/share-prompt-dialog";
import { stashDailySiftPrefill } from "@/lib/daily-sift-prefill";

export default function DailySiftPage() {
  const [, params] = useRoute("/daily-sift/:id");
  const [, setLocation] = useLocation();
  const { openShare, shareDialogProps } = useDailySiftShare();

  const rawId = params?.id ?? "";
  const promptId = Number.parseInt(rawId, 10);
  const validId = Number.isFinite(promptId) && promptId > 0;

  const { data, isLoading, isError } = useQuery<DailyPromptResponse>({
    queryKey: ["/api/daily-prompt", "by-id", promptId],
    queryFn: async () => {
      const hour = new Date().getHours();
      const res = await apiRequest(
        "GET",
        `/api/daily-prompt?promptId=${encodeURIComponent(String(promptId))}&hour=${hour}`,
      );
      return res.json();
    },
    enabled: validId,
    retry: false,
  });

  const promptText = data?.prompt?.text?.trim() ?? "";
  const themeName = data?.theme?.name ?? "Sift";

  useEffect(() => {
    if (!promptText) return;
    const title = `Today from Sift · ${themeName}`;
    setPageMeta({
      title,
      description: dailySiftPageDescription(promptText),
    });
    return () => resetPageMeta();
  }, [promptText, themeName]);

  const handleStart = () => {
    if (!promptText) return;
    stashDailySiftPrefill(promptText);
    setLocation("/sift");
    window.setTimeout(
      () =>
        window.dispatchEvent(
          new CustomEvent("sift:focus-composer", { detail: { select: false } }),
        ),
      0,
    );
  };

  const handleShare = () => {
    if (!validId || !promptText) return;
    openShare({
      promptId,
      themeName,
      promptText,
    });
  };

  return (
    <SiftAppShell activeTab="composer" composerText="">
      <div className="mx-auto flex w-full max-w-lg flex-col px-5 py-8 md:py-12">
        <Link
          href="/sift"
          className="mb-8 inline-flex items-center gap-2 text-sm text-[color:var(--v3-text-muted)] hover:text-[color:var(--v3-text-primary)]"
          data-testid="link-daily-sift-back"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Sift
        </Link>

        {isLoading ? (
          <div
            className="v3-daily-prompt-card animate-pulse pointer-events-none opacity-70"
            data-testid="daily-sift-loading"
          >
            <div className="h-2.5 w-32 rounded bg-[color:var(--v3-border)]" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full rounded bg-[color:var(--v3-border)]/80" />
              <div className="h-4 w-[90%] rounded bg-[color:var(--v3-border)]/60" />
            </div>
          </div>
        ) : null}

        {!validId || isError || (!isLoading && !promptText) ? (
          <div className="text-center py-12" data-testid="daily-sift-missing">
            <p className="font-serif text-xl text-[color:var(--v3-text-primary)] mb-2">
              This Daily Sift isn&apos;t here.
            </p>
            <p className="text-sm text-[color:var(--v3-text-muted)] mb-6">
              The link may be off, or this prompt is no longer available.
            </p>
            <Link href="/sift">
              <Button type="button" data-testid="link-daily-sift-home">
                Open Sift
              </Button>
            </Link>
          </div>
        ) : null}

        {promptText ? (
          <article data-testid="daily-sift-detail">
            <p
              className="v3-daily-prompt-eyebrow"
              data-testid="text-daily-sift-eyebrow"
            >
              Today from Sift
              <span className="opacity-70"> · </span>
              {themeName}
            </p>
            <h1
              className="v3-daily-prompt-body mt-3"
              data-testid="text-daily-sift-body"
            >
              {promptText}
            </h1>

            <div className="mt-8 flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-start gap-3"
                onClick={handleShare}
                data-testid="button-daily-sift-share"
              >
                <Share2 className="h-4 w-4" aria-hidden />
                Share
              </Button>
              <Button
                type="button"
                className="h-11 w-full justify-start gap-3"
                onClick={handleStart}
                data-testid="button-daily-sift-start"
              >
                <PenLine className="h-4 w-4" aria-hidden />
                Start with this prompt
              </Button>
            </div>
          </article>
        ) : null}
      </div>

      {shareDialogProps ? (
        <SharePromptDialog {...shareDialogProps} />
      ) : null}
    </SiftAppShell>
  );
}
