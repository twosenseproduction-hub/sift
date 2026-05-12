import { useState } from "react";
import { Link } from "wouter";
import { useMe } from "@/lib/auth";
import { useThreads } from "@/lib/useThreads";
import { Header, Footnote } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/auth-dialog";
import { ArrowRight, Search, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReEntryBlock } from "@/components/sift-ui";
import type { SiftListItem, SiftStatus } from "@shared/schema";

type Filter = "all" | "open" | "closed" | "archived";

export default function ThreadsPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const { data: meData } = useMe();
  const me = meData?.me;
  const { data: threads, isLoading, isError } = useThreads({ enabled: !!me });

  const filtered = (threads ?? []).filter((t) => {
    if (filter !== "all" && t.threadState !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const inCore = t.coreIntent.toLowerCase().includes(q);
      const inNext = t.nextStep.toLowerCase().includes(q);
      const inMove = (t.currentMove ?? "").toLowerCase().includes(q);
      if (!inCore && !inNext && !inMove) return false;
    }
    return true;
  });

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
        <div className="mx-auto max-w-3xl px-6 md:px-8 pt-8 md:pt-12 pb-16">
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

          <ReEntryBlock enabled />

          {/* Filter row — Linear-style tabs. "Live" reads less administrative
              than "Open" and matches the rest of the app's voice. */}
          <div className="flex items-center gap-5 text-sm mb-6 overflow-x-auto pb-1">
            {(["all", "open", "closed", "archived"] as Filter[]).map((f) => {
              const label =
                f === "all"
                  ? "All"
                  : f === "open"
                    ? "Live"
                    : f.charAt(0).toUpperCase() + f.slice(1);
              const count =
                f === "all"
                  ? (threads?.length ?? 0)
                  : (threads ?? []).filter((t) => t.threadState === f).length;
              if (count === 0 && f !== "all") return null;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  data-testid={`filter-${f}`}
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
              placeholder="Search by title, next step, or move…"
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
            <ul className="divide-y divide-border/70 border-y border-border/70">
              {filtered.map((t) => (
                <ThreadRow key={t.id} thread={t} />
              ))}
            </ul>
          )}
        </div>
      </main>
      <Footnote />
    </div>
  );
}

function ThreadRow({ thread }: { thread: SiftListItem }) {
  const modeLabel = thread.mode === "operator" ? "Operator" : "Personal";
  const stateMeta =
    thread.threadState === "archived"
      ? "Archived"
      : thread.threadState === "closed"
        ? "Closed"
        : null;

  const moveLine =
    thread.currentMove &&
    thread.currentMove.trim() !== thread.nextStep.trim()
      ? thread.currentMove
      : null;

  return (
    <li className="group relative py-5 md:py-6 flex gap-4 md:gap-6 hover-elevate rounded-sm -mx-2 px-2 md:-mx-4 md:px-4">
      <Link href={`/thread/${thread.id}`}>
        <a
          className="flex-1 text-left min-w-0 block"
          data-testid={`thread-row-${thread.id}`}
        >
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <ListStatusDot status={thread.status} />
            <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
              {formatListDate(thread.createdAt)}
            </span>
            {thread.metaSift ? (
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/80">
                pattern sift
              </span>
            ) : null}
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
              {modeLabel}
            </span>
            {stateMeta ? (
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                · {stateMeta}
              </span>
            ) : null}
            {thread.frontBurnerRank != null && (
              <span className="text-[10px] font-medium uppercase tracking-widest text-primary/70">
                · #{thread.frontBurnerRank}
              </span>
            )}
          </div>

          <h3
            className={cn(
              "font-serif text-lg md:text-xl leading-snug mb-1.5",
              thread.threadState === "closed" || thread.threadState === "archived"
                ? "text-muted-foreground"
                : "text-foreground",
            )}
          >
            {thread.coreIntent || "Untitled thread"}
          </h3>

          <p className="text-sm text-muted-foreground line-clamp-1">
            Next: {thread.nextStep}
          </p>

          {moveLine && (
            <p className="text-xs text-muted-foreground/85 line-clamp-1 mt-1">
              Move: {moveLine}
            </p>
          )}
        </a>
      </Link>
    </li>
  );
}

/** Matches History: open = primary dot, closed = muted dot. */
function ListStatusDot({ status }: { status: SiftStatus }) {
  return (
    <span
      aria-label={status === "closed" ? "Closed" : "Open"}
      title={status === "closed" ? "Closed" : "Open"}
      className={cn(
        "inline-block w-1.5 h-1.5 rounded-full shrink-0",
        status === "closed" ? "bg-muted-foreground/35" : "bg-primary/70",
      )}
    />
  );
}

function formatListDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
