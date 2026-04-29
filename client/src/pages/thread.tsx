import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Bookmark, ChevronDown, ChevronUp } from "lucide-react";
import { useMe } from "@/lib/auth";
import { useThread, usePatchThread } from "@/lib/useThreads";
import { Header, Footnote } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { DeepeningThread } from "@/components/deepening-thread";
import { BookmarkCard } from "@/components/bookmark-card";
import { AuthDialog } from "@/components/auth-dialog";
import { cn } from "@/lib/utils";
import type { ThreadDetail } from "@shared/schema";

// Thread detail page — /thread/:id
export default function ThreadPage() {
  const { data: meData } = useMe();
  const me = meData?.me;
  const [authOpen, setAuthOpen] = useState(false);
  const [showControls, setShowControls] = useState(false);

  // Thread state controls
  const [localState, setLocalState] = useState<ThreadDetail["threadState"] | null>(null);
  const [localMove, setLocalMove] = useState("");
  const [localRank, setLocalRank] = useState<number | null>(null);

  // Which thread to show — from URL /thread/:id
  // Use window.location for hash routing
  const id = window.location.pathname.split("/thread/")[1]?.split("?")[0] ?? "";

  const { data: thread, isLoading, isError } = useThread(id);
  const patch = usePatchThread();

  // Sync local state from server when thread loads
  if (thread && localState === null) {
    setLocalState(thread.threadState);
    setLocalMove(thread.currentMove ?? "");
    setLocalRank(thread.frontBurnerRank ?? null);
  }

  if (!id) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">No thread id.</p>
        </main>
        <Footnote />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <div className="mx-auto max-w-2xl px-6 pt-12 space-y-3">
            <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
            <div className="h-6 w-3/4 bg-muted/50 rounded animate-pulse" />
            <div className="h-20 bg-muted/40 rounded-xl animate-pulse mt-4" />
          </div>
        </main>
        <Footnote />
      </div>
    );
  }

  if (isError || !thread) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="font-serif text-2xl mb-3">Thread not found.</p>
            <p className="text-muted-foreground text-sm mb-6">It may have been removed or the link is wrong.</p>
            <Link href="/threads">
              <a><Button size="sm" className="gap-2">View threads <ArrowRight className="w-4 h-4" /></Button></a>
            </Link>
          </div>
        </main>
        <Footnote />
      </div>
    );
  }

  const currentState = localState ?? thread.threadState;
  const currentMove = localMove || thread.currentMove;
  const currentRank = localRank ?? thread.frontBurnerRank;

  const commitState = (next: typeof currentState) => {
    setLocalState(next);
    patch.mutate({ id: thread.id, threadState: next });
  };

  const commitMove = (m: string) => {
    setLocalMove(m);
    patch.mutate({ id: thread.id, currentMove: m || null });
  };

  const commitRank = (r: number | null) => {
    setLocalRank(r);
    patch.mutate({ id: thread.id, frontBurnerRank: r });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-6 md:px-8 pt-8 md:pt-12 pb-16">
          {/* Back + meta */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <Link href="/threads">
                <a className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 mb-2">
                  ← Threads
                </a>
              </Link>
              <div className="flex items-center gap-2">
                <ThreadDot state={thread.threadState} />
                <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70">
                  {thread.mode}
                </span>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground/50">
                  {currentState}
                </span>
                {currentRank != null && (
                  <>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="text-[11px] uppercase tracking-widest text-primary/70 font-medium">
                      # {currentRank}
                    </span>
                  </>
                )}
              </div>
            </div>
            <span className="text-xs text-muted-foreground/50 tabular-nums">
              {formatDate(thread.updatedAt)}
            </span>
          </div>

          {/* Core intent */}
          <div className="mb-8">
            <p className="font-serif text-2xl md:text-3xl leading-snug text-foreground/90">
              {thread.coreIntent}
            </p>
          </div>

          {/* Current move */}
          {currentMove && (
            <div className="mb-6 px-4 py-3 rounded-xl border border-primary/20 bg-primary/5">
              <p className="text-[10px] font-medium uppercase tracking-widest text-primary/70 mb-1">
                Current move
              </p>
              <p className="text-sm text-foreground/80 leading-relaxed">{currentMove}</p>
            </div>
          )}

          {/* Controls — quiet collapse */}
          <div className="mb-8">
            <button
              onClick={() => setShowControls((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              {showControls ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showControls ? "Hide controls" : "Manage thread"}
            </button>

            {showControls && me && (
              <div className="mt-4 p-4 rounded-xl border border-border/60 bg-card/50 space-y-4">
                {/* State */}
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70 mb-2">
                    State
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {(["open", "closed", "archived"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => commitState(s)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs border transition-colors",
                          currentState === s
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Front burner rank */}
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70 mb-2">
                    Front burner rank
                  </p>
                  <div className="flex gap-2">
                    {([null, 1, 2, 3] as (number | null)[]).map((r) => (
                      <button
                        key={r ?? "none"}
                        onClick={() => commitRank(r)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs border transition-colors",
                          currentRank === r
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {r == null ? "None" : `#${r}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Current move edit */}
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70 mb-2">
                    Current move
                  </p>
                  <textarea
                    value={localMove}
                    onChange={(e) => setLocalMove(e.target.value)}
                    onBlur={() => commitMove(localMove)}
                    rows={2}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                    placeholder="What needs to happen next…"
                  />
                </div>

                {/* Closure condition */}
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70 mb-2">
                    When to close this thread
                  </p>
                  <textarea
                    value={localClosure}
                    onChange={(e) => setLocalClosure(e.target.value)}
                    onBlur={() => commitClosure(localClosure)}
                    rows={1}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                    placeholder="What would make this done for now…"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bookmark / re-entry card */}
          {thread.bookmark && (
            <div className="mb-10">
              <BookmarkCard
                bookmark={thread.bookmark}
                defaultOpen={false}
                onKeepProcessing={() => {}}
                onCloseLoop={undefined}
              />
            </div>
          )}

          {/* Turns so far */}
          {thread.turns && thread.turns.length > 0 && (
            <div className="mb-10">
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60 mb-4">
                Thread so far ({thread.turns.length} turns)
              </p>
              <div className="space-y-3">
                {thread.turns.map((turn) => (
                  <TurnCard key={turn.id} turn={turn} />
                ))}
              </div>
            </div>
          )}

          {/* Re-enter thread — shown for signed-in owners */}
          {me ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70 mb-4">
                Continue this thread
              </p>
              <DeepeningThread
                siftId={thread.id}
                initialTurns={thread.turns ?? []}
                initialBookmark={thread.bookmark ?? undefined}
                onCare={() => {}}
                onBookmarkUpdate={() => {}}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-5 text-center">
              <p className="text-sm text-foreground/80 mb-3">
                Sign in to continue this thread.
              </p>
              <Button size="sm" onClick={() => setAuthOpen(true)}>
                Sign in
              </Button>
            </div>
          )}
        </div>
      </main>
      <Footnote />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode="signup" />
    </div>
  );
}

function TurnCard({ turn }: { turn: any }) {
  const isUser = turn.role === "user";
  const isSift = turn.role === "sift";

  return (
    <div className={cn(
      "rounded-xl px-4 py-3 border",
      isUser ? "border-primary/15 bg-primary/5" : "border-border/60 bg-card/50",
    )}>
      <p className="text-[10px] font-medium uppercase tracking-widest mb-1.5 text-muted-foreground/60">
        {isUser ? "You" : "Sift"}
        {turn.kind !== "message" && ` · ${turn.kind}`}
      </p>
      {turn.text && (
        <p className="text-sm text-foreground/80 leading-relaxed">{turn.text}</p>
      )}
      {turn.message && (
        <div className="space-y-1.5">
          {turn.message.mirror && (
            <p className="text-sm text-foreground/80 leading-relaxed italic">
              {turn.message.mirror}
            </p>
          )}
          {turn.message.question && (
            <p className="text-sm text-primary/80">
              → {turn.message.question}
            </p>
          )}
        </div>
      )}
      {turn.reflection && (
        <p className="text-sm text-muted-foreground/80 italic">{turn.reflection}</p>
      )}
    </div>
  );
}

function ThreadDot({ state }: { state: ThreadDetail["threadState"] }) {
  const colors: Record<string, string> = {
    open: "bg-primary/70",
    open: "bg-primary/70",
    waiting: "bg-yellow-500/60",
    closed: "bg-muted-foreground/30",
    archived: "bg-muted-foreground/15",
  };
  return (
    <span className={cn("inline-block w-1.5 h-1.5 rounded-full", colors[state] ?? "bg-muted-foreground/30")} />
  );
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short", day: "numeric",
  });
}
