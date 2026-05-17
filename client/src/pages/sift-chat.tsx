import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Sparkles } from "lucide-react";
import { AppShell, APP_SHELL_HEADER_COLUMN } from "@/components/app-shell";
import { DeepeningThread } from "@/components/deepening-thread";
import { CareScreen } from "@/components/care-screen";
import { Thinking } from "@/components/sift-ui";
import { cn } from "@/lib/utils";
import type { Bookmark, SiftResult } from "@shared/schema";

/**
 * Full-page conversational deepening — same back-and-forth as "Keep going" on
 * the saved sift page, optimized for chat-style focus (reference: mobile thread UI).
 */
export default function SiftChatPage() {
  const [, params] = useRoute<{ id: string }>("/s/:id/chat");
  const id = params?.id ?? "";
  const [, setLocation] = useLocation();
  const [careOpen, setCareOpen] = useState(false);
  const [bookmarkOverride, setBookmarkOverride] = useState<Bookmark | null>(
    null,
  );

  const { data, isLoading, isError } = useQuery<SiftResult>({
    queryKey: ["/api/sift", id],
    enabled: !!id,
  });

  const activeBookmark = bookmarkOverride ?? data?.bookmark ?? undefined;

  useEffect(() => {
    if (!data) return;
    if (!data.mine) setLocation(`/s/${id}`);
  }, [data, id, setLocation]);

  if (!id) {
    return (
      <AppShell contentClassName="flex flex-1 flex-col justify-center items-center pt-12">
        <p className="text-muted-foreground text-sm">No thread selected.</p>
        <Link href="/">
          <a className="mt-4 text-sm text-primary underline underline-offset-4">
            Back home
          </a>
        </Link>
      </AppShell>
    );
  }

  return (
    <>
      <AppShell
        footer={null}
        header={
          <header className="w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
            <div
              className={cn(
                APP_SHELL_HEADER_COLUMN,
                "py-3 flex items-center justify-between gap-4",
              )}
            >
              <Link href="/">
                <a
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/30 text-foreground hover:bg-muted/50 transition-colors"
                  aria-label="Back to home"
                  data-testid="link-chat-back-home"
                >
                  <ChevronLeft className="w-5 h-5" aria-hidden />
                </a>
              </Link>
              <div className="flex flex-col items-center min-w-0">
                <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-medium">
                  With Sift
                </span>
              </div>
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/30 text-primary"
                aria-hidden
              >
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
          </header>
        }
        contentClassName="flex flex-col flex-1 min-h-0 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
        mainClassName="min-h-0"
      >
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Thinking />
          </div>
        ) : isError ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16">
            <p className="font-serif text-xl mb-2">Couldn&apos;t open this thread.</p>
            <p className="text-sm text-muted-foreground mb-6">
              Try again from home or pick it up from Threads.
            </p>
            <Link href="/">
              <a className="text-sm text-primary underline underline-offset-4">
                Back home
              </a>
            </Link>
          </div>
        ) : data?.mine ? (
          <div className="flex flex-col flex-1 min-h-0 gap-4">
            <div className="shrink-0 text-center">
              <Link href={`/s/${id}`}>
                <a
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border"
                  data-testid="link-chat-view-card"
                >
                  View full sift card
                </a>
              </Link>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <DeepeningThread
                siftId={data.id}
                initialTurns={data.turns ?? []}
                initialBookmark={activeBookmark}
                onCare={() => setCareOpen(true)}
                onBookmarkUpdate={(b: Bookmark) => setBookmarkOverride(b)}
              />
            </div>
          </div>
        ) : null}
      </AppShell>

      {careOpen ? (
        <div className="fixed inset-0 z-[100] bg-background overflow-y-auto">
          <div className={cn(APP_SHELL_HEADER_COLUMN, "py-8 md:py-12 pb-safe")}>
            <CareScreen onClose={() => setCareOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
