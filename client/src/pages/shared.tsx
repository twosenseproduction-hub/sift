import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { isRedesignV3Enabled } from "@/lib/use-redesign-v3";
import { clearResume, readResume } from "@/lib/resume";
import { Header, Footnote } from "@/components/brand";
import { AppShell } from "@/components/app-shell";
import { Result, Thinking } from "@/components/sift-ui";
import { CheckinBlock } from "@/components/checkin";
import { FeedbackPrompt } from "@/components/feedback-prompt";
import { BookmarkCard } from "@/components/bookmark-card";
import { DeepeningThread } from "@/components/deepening-thread";
import { CareScreen } from "@/components/care-screen";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import type { SiftResult, Bookmark } from "@shared/schema";

// Shared (a.k.a. saved-thread) page.
//
// When the viewer owns the sift and a bookmark exists, we lead with the
// compact re-entry card instead of dumping the raw result. "Keep processing
// this" unfolds the deepening thread inline, preserving the bookmark above so
// the user always has a home base to return to.
//
// Non-owners (readers of a shared link) see the original result only —
// turns/bookmark are owner-scoped on the server.
type View = "bookmark" | "deepening" | "care";

export default function Shared() {
  const [, params] = useRoute("/s/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ?? "";
  const [view, setView] = useState<View>("bookmark");
  // Locally held bookmark so we can live-update it as checkpoints arrive
  // without re-fetching the whole sift.
  const [bookmarkOverride, setBookmarkOverride] = useState<Bookmark | null>(
    null,
  );

  const { data, isLoading, isError } = useQuery<SiftResult>({
    queryKey: ["/api/sift", id],
    enabled: !!id,
  });

  const activeBookmark = bookmarkOverride ?? data?.bookmark;

  // If this thread is already closed, there is nothing to resume — clear
  // any lingering recovery state for it so Home stops offering to return.
  useEffect(() => {
    if (!data) return;
    if (data.status === "closed") {
      const r = readResume();
      if (r && r.siftId === data.id) clearResume();
    }
  }, [data?.id, data?.status]);

  // v3: owner links to /s/:id should continue in chat, not the legacy card page.
  useEffect(() => {
    if (!data?.mine || !isRedesignV3Enabled()) return;
    setLocation(`/s/${id}/chat`);
  }, [data?.mine, id, setLocation]);

  return (
    <AppShell header={<Header />} footer={<Footnote />} contentClassName="pt-8 md:pt-12">
          {isLoading && <Thinking />}

          {isError && (
            <div className="text-center py-20">
              <p className="font-serif text-2xl mb-3">This sift isn't here.</p>
              <p className="text-muted-foreground mb-8">
                It may have been removed, or the link is off by a character.
              </p>
              <Link href="/" data-testid="link-home-fallback">
                <a>
                  <Button variant="default" className="gap-2">
                    Start fresh <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>
              </Link>
            </div>
          )}

          {data && view === "care" && (
            <CareScreen
              onClose={() => setView("bookmark")}
              onDismiss={() => setView("bookmark")}
            />
          )}

          {data && view !== "care" && (
            <>
              <div className="mb-8 md:mb-10">
                <p className="text-[11px] tracking-[0.25em] uppercase text-primary/80 font-medium">
                  {data.mine ? "From your thread" : "A shared sift"}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {new Date(data.createdAt).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="rounded-2xl border border-border/40 bg-card/50 px-5 py-8 md:px-8 md:py-10 space-y-10 md:space-y-12">
                {/* Owner re-entry path: bookmark first, thread underneath when
                    the user chooses to keep processing. */}
                {data.mine && activeBookmark && (
                  <BookmarkCard
                    bookmark={activeBookmark}
                    flush
                    defaultOpen={view === "bookmark"}
                    onKeepProcessing={() => setView("deepening")}
                    onCloseLoop={
                      data.status === "closed"
                        ? undefined
                        : () => setView("deepening")
                    }
                  />
                )}

                {data.mine && view === "deepening" && (
                  <div>
                    <p
                      className="text-[11px] tracking-[0.25em] uppercase text-primary/80 mb-3 font-medium"
                      data-testid="text-shared-deepen-eyebrow"
                    >
                      Keep going
                    </p>
                    <DeepeningThread
                      siftId={data.id}
                      initialTurns={data.turns ?? []}
                      initialBookmark={activeBookmark}
                      onCare={() => setView("care")}
                      onBookmarkUpdate={(b) => setBookmarkOverride(b)}
                    />
                  </div>
                )}

                {/* Full sift output — always visible. */}
                <Result result={data} readOnly={!data.mine} quietChrome />

                {data.mine && (
                  <FeedbackPrompt compact stage="result" siftId={data.id} />
                )}

                <CheckinBlock sift={data} readOnly={!data.mine} embedded />
              </div>

              <div className="pt-12 mt-12 border-t border-border/60 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  {data.mine
                    ? "Something else you're holding?"
                    : "Have a tangle of your own?"}
                </p>
                <Link href="/" data-testid="link-start-own">
                  <a>
                    <Button variant="default" className="gap-2">
                      {data.mine
                        ? "Sift something new"
                        : "Sift something of your own"}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </a>
                </Link>
              </div>
            </>
          )}
    </AppShell>
  );
}
