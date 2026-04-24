import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Header, Footnote } from "@/components/brand";
import { Result, Thinking } from "@/components/sift-ui";
import { CheckinBlock } from "@/components/checkin";
import { BookmarkCard } from "@/components/bookmark-card";
import { DeepeningThread } from "@/components/deepening-thread";
import { CareScreen } from "@/components/care-screen";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronRight } from "lucide-react";
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 md:px-8 pb-16 pt-8 md:pt-12">
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

              {/* Owner re-entry path: bookmark first, thread underneath when
                  the user chooses to keep processing. */}
              {data.mine && activeBookmark && (
                <div className="mb-10">
                  <BookmarkCard
                    bookmark={activeBookmark}
                    defaultOpen={view === "bookmark"}
                    onKeepProcessing={() => setView("deepening")}
                    onCloseLoop={
                      data.status === "closed"
                        ? undefined
                        : () => setView("deepening")
                    }
                  />
                </div>
              )}

              {data.mine && view === "deepening" && (
                <div className="mb-10">
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

              {/* Original result — always available, collapsed implicitly by
                  appearing beneath the bookmark for owners. Readers see it as
                  their only view. */}
              {(!data.mine || !activeBookmark || view === "deepening") && (
                <Result result={data} readOnly={!data.mine} />
              )}

              {/* Show the original result beneath the bookmark when owner is
                  in bookmark view — as an at-a-glance reference. */}
              {data.mine && activeBookmark && view === "bookmark" && (
                <details className="mt-6 group" data-testid="details-original-sift">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                    See the original sift
                  </summary>
                  <div className="mt-4">
                    <Result result={data} readOnly />
                  </div>
                </details>
              )}

              <CheckinBlock sift={data} readOnly={!data.mine} />

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
        </div>
      </main>

      <Footnote />
    </div>
  );
}
