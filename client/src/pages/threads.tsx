import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMe } from "@/lib/auth";
import { useThreads, usePatchThread } from "@/lib/useThreads";
import { Header, Footnote } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/auth-dialog";
import { ArrowRight, Search, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThreadListItem } from "@shared/schema";

type Filter = "all" | "open" | "closed" | "archived";

export default function ThreadsPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const { data: meData } = useMe();
  const me = meData?.me;
  const { data: threads, isLoading, isError } = useThreads({ enabled: !!me });
  const patch = usePatchThread();

  const filtered = (threads ?? []).filter((t) => {
    if (filter !== "all" && t.threadState !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!t.coreIntent.toLowerCase().includes(q) && !(t.currentMove ?? "").toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const byState = (state: ThreadListItem["threadState"]) =>
    filtered.filter((t) => t.threadState === state);

  if (!me) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <div className="mx-auto max-w-xl px-6 pt-20 pb-16 text-center">
            <p className="text-[11px] tracking-[0.25em] uppercase text-primary/80 font-medium mb-4">
              Your threads
            </p>
            <h1 className="font-serif text-4xl md:text-5xl leading-tight mb-5">
              Sign in to see your threads.
            </h1>
            <p className="text-muted-foreground mb-8">
              A handle and passphrase is all it takes.
            </p>
            <Button onClick={() => setAuthOpen(true)}>Sign in or create account</Button>
          </div>
        </main>
        <Footnote />
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode="signup" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-6 md:px-8 pt-8 md:pt-12 pb-16">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <Bookmark className="w-4 h-4 text-primary" />
              <p className="text-[11px] tracking-[0.25em] uppercase text-primary/80 font-medium">
                Your threads
              </p>
            </div>
            <h1 className="font-serif text-3xl md:text-4xl leading-tight">
              Everything in motion
            </h1>
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-5 text-sm mb-6 overflow-x-auto pb-1">
            {(["all", "open", "closed", "archived"] as Filter[]).map((f) => {
              const label = f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1);
              const count =
                f === "all"
                  ? (threads?.length ?? 0)
                  : (threads ?? []).filter((t) => t.threadState === f).length;
              if (count === 0 && f !== "all") return null;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "whitespace-nowrap transition-colors",
                    filter === f
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                  <span className="ml-1.5 text-muted-foreground/60 text-xs">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search threads…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          )}

          {/* Error */}
          {isError && (
            <p className="text-muted-foreground text-sm">
              Couldn't load threads. Try refreshing.
            </p>
          )}

          {/* Empty */}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="text-center py-12">
              {search ? (
                <p className="text-muted-foreground text-sm">
                  Nothing matches "{search}".
                </p>
              ) : filter === "all" ? (
                <>
                  <p className="font-serif text-xl mb-3">No threads yet.</p>
                  <p className="text-muted-foreground text-sm mb-6">
                    Sift something to start a thread.
                  </p>
                  <Link href="/">
                    <a>
                      <Button size="sm" className="gap-2">
                        Start sifting <ArrowRight className="w-4 h-4" />
                      </Button>
                    </a>
                  </Link>
                </>
              ) : (
                <p className="text-muted-foreground text-sm capitalize">
                  Nothing {filter} right now.
                </p>
              )}
            </div>
          )}

          {/* List */}
          {filtered.length > 0 && (
            <ul className="space-y-2">
              {filtered.map((t) => (
                <ThreadRow key={t.id} thread={t} onPatch={patch.mutate} />
              ))}
            </ul>
          )}
        </div>
      </main>
      <Footnote />
    </div>
  );
}

function ThreadRow({
  thread,
  onPatch,
}: {
  thread: ThreadListItem;
  onPatch: (v: any) => void;
}) {
  const stateLabel: Record<ThreadListItem["threadState"], string> = {
    open: "Open / Active",
    waiting: "Waiting",
    closed: "Closed",
    archived: "Archived",
  };

  const modeLabel = thread.mode === "operator" ? "Operator" : "Personal";

  return (
    <li className="group rounded-xl border border-border/60 bg-card/50 hover:bg-card/80 hover:border-border transition-colors">
      <Link href={`/thread/${thread.id}`}>
        <a className="block px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <div className="flex items-center gap-2">
              <ThreadDot state={thread.threadState} />
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                {modeLabel}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                · {stateLabel[thread.threadState]}
              </span>
              {thread.frontBurnerRank != null && (
                <span className="text-[10px] font-medium uppercase tracking-widest text-primary/70">
                  · #${thread.frontBurnerRank}
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">
              {formatAge(thread.updatedAt)}
            </span>
          </div>

          <p className="text-sm font-medium text-foreground/90 leading-snug line-clamp-2 mb-1">
            {thread.coreIntent || "Untitled thread"}
          </p>

          {thread.currentMove && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              Move: {thread.currentMove}
            </p>
          )}
          {thread.closureCondition && (
            <p className="text-xs text-muted-foreground/70 italic line-clamp-1 mt-0.5">
              {thread.closureCondition}
            </p>
          )}
        </a>
      </Link>
    </li>
  );
}

function ThreadDot({ state }: { state: ThreadListItem["threadState"] }) {
  const colors: Record<string, string> = {
    waiting: "bg-yellow-500/60",
    closed: "bg-muted-foreground/30",
    archived: "bg-muted-foreground/15",
  };
  return (
    <span
      className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", colors[state] ?? "bg-muted-foreground/30")}
    />
  );
}

function formatAge(ts: number): string {
  const diff = Date.now() - ts;
  const min = 60_000;
  const hr = 3_600_000;
  const day = 86_400_000;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m`;
  if (diff < day) return `${Math.floor(diff / hr)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
