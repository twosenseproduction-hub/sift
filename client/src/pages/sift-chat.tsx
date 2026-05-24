import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SiftAppShell } from "@/components/redesign-v3";
import { DeepeningThread } from "@/components/deepening-thread";
import { CareScreen } from "@/components/care-screen";
import type { Bookmark, SiftResult } from "@shared/schema";
import { isRedesignV3Enabled } from "@/lib/use-redesign-v3";

/**
 * Full-page conversational deepening — continues a saved thread in focus.
 */
export default function SiftChatPage() {
  const [, params] = useRoute<{ id: string }>("/s/:id/chat");
  const id = params?.id ?? "";
  const [, setLocation] = useLocation();
  const v3 = isRedesignV3Enabled();
  const [careOpen, setCareOpen] = useState(false);
  const [bookmarkOverride, setBookmarkOverride] = useState<Bookmark | null>(null);

  const { data, isLoading, isError } = useQuery<SiftResult>({
    queryKey: ["/api/sift", id],
    enabled: !!id,
  });

  const activeBookmark = bookmarkOverride ?? data?.bookmark ?? undefined;

  useEffect(() => {
    if (!data) return;
    if (!data.mine) setLocation(v3 ? `/library/${id}` : `/s/${id}`);
  }, [data, id, setLocation, v3]);

  if (!id) {
    return (
      <SiftAppShell activeTab="composer">
        <div className="v3-composer-area py-16 text-center">
          <p className="v3-empty-state">No thread selected.</p>
          <Link href="/sift">
            <a className="v3-reentry-hint-link v3-reentry-hint-link--primary mt-4 inline-block">
              Back to composer
            </a>
          </Link>
        </div>
      </SiftAppShell>
    );
  }

  return (
    <>
      <SiftAppShell activeTab="composer" settingsTestId="button-chat-settings">
        <div className="v3-chat-layout">
          <button
            type="button"
            onClick={() => setLocation("/sift")}
            className="v3-detail-back"
            data-testid="link-chat-back-home"
          >
            ← Back to composer
          </button>

          {data?.bookmark?.payload.lastLanded?.trim() ? (
            <p className="v3-chat-context">
              Last place: {data.bookmark.payload.lastLanded.trim()}
            </p>
          ) : null}

          {isLoading ? (
            <p className="v3-thread-thinking py-12">Opening thread…</p>
          ) : isError ? (
            <div className="py-16 text-center">
              <p className="v3-empty-state-title">Couldn&apos;t open this thread.</p>
              <p className="v3-empty-state mt-2">Try again from the composer or Library.</p>
              <Link href="/sift">
                <a className="v3-reentry-hint-link v3-reentry-hint-link--primary mt-6 inline-block">
                  Back to composer
                </a>
              </Link>
            </div>
          ) : data?.mine ? (
            <div className="v3-chat-thread-wrap">
              <DeepeningThread
                siftId={data.id}
                initialTurns={data.turns ?? []}
                initialBookmark={activeBookmark}
                onCare={() => setCareOpen(true)}
                onBookmarkUpdate={(b: Bookmark) => setBookmarkOverride(b)}
              />
            </div>
          ) : null}
        </div>
      </SiftAppShell>

      {careOpen ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-[color:var(--v3-bg)]">
          <div className="v3-composer-area py-8">
            <CareScreen onClose={() => setCareOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
