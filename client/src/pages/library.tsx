import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Bookmark,
  Briefcase,
  ChevronRight,
  ChevronUp,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { LibrarySiftDetail, LibrarySiftItem, ThreadTurn } from "@shared/schema";
import { SiftBaseBackground } from "@/components/bedroom-session/sift-base-background";
import { PrimaryTopNav } from "@/components/primary-top-nav";
import { AuthDialog } from "@/components/auth-dialog";
import { useMe } from "@/lib/auth";
import { useCurrentSiftExperience } from "@/lib/sift-experience";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type LibraryListResponse = {
  items: LibrarySiftItem[];
  recurringThemes: Array<{ label: string; count: number }>;
};
type LibraryDetailResponse = { item: LibrarySiftDetail };
type LibraryFilter = "recent" | "important" | "relationships" | "work" | "identity";

const FILTERS: {
  id: LibraryFilter;
  label: string;
  Icon: LucideIcon;
}[] = [
  { id: "recent", label: "Recent", Icon: Sparkles },
  { id: "important", label: "Important", Icon: Star },
  { id: "relationships", label: "Relationships", Icon: Users },
  { id: "work", label: "Work", Icon: Briefcase },
  { id: "identity", label: "Identity", Icon: UserRound },
];

export default function LibraryPage() {
  const [, params] = useRoute("/library/:id");
  const [, setLocation] = useLocation();
  const selectedId = params?.id ?? null;
  const { data: meData } = useMe();
  const me = meData?.me;
  const { baseMode } = useCurrentSiftExperience();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("recent");
  const [authOpen, setAuthOpen] = useState(false);

  const listQuery = useQuery<LibraryListResponse>({
    queryKey: ["/api/library"],
    enabled: !!me,
  });
  const detailQuery = useQuery<LibraryDetailResponse>({
    queryKey: [`/api/library/${selectedId}`],
    enabled: !!me && !!selectedId,
  });

  const items = listQuery.data?.items ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        !q ||
        [
          item.title,
          item.summary,
          item.preview.summary,
          item.preview.nextStep,
          ...item.tags,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchesFilter = filter === "recent" || libraryFilterMatches(item, filter);
      return matchesQuery && matchesFilter;
    });
  }, [items, query, filter]);

  return (
    <main
      className={cn(
        "bedroom-session sift-base-session relative min-h-[100dvh] overflow-x-hidden bg-[color:var(--color-bg)] text-[color:var(--color-text)]",
        baseMode === "light" && "sift-base-light-session",
      )}
    >
      <SiftBaseBackground mode={baseMode} />
      <div className="relative z-[30] mx-auto flex min-h-[100dvh] w-full max-w-[560px] flex-col px-4 pb-[calc(3.5rem+env(safe-area-inset-bottom))] pt-[max(env(safe-area-inset-top),1rem)] sm:px-6">
        <header className="mb-[min(27dvh,235px)] flex items-center justify-between gap-3">
          <PrimaryTopNav />
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]/58 text-[color:var(--color-text-muted)] shadow-[0_14px_42px_-34px_rgba(0,0,0,0.55)] backdrop-blur-xl transition hover:bg-[color:var(--color-surface)]/78 hover:text-[color:var(--color-text)]"
            aria-label="Library filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </header>

        <section className="rounded-[2rem] border border-[#e1d5c5] bg-[#fbf7ef] p-4 shadow-[0_28px_90px_-50px_rgba(41,38,31,0.68)] sm:p-6">
          {!me ? (
            <div className="py-10 text-center">
              <h1 className="font-serif text-3xl tracking-[-0.04em] text-[#241f18]">
                Save your clarity.
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#675d4f]">
                Create your space to keep Sifts, return later, and build a Library over time.
              </p>
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="mt-5 rounded-full bg-[#1f6f72] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#1a5f62]"
              >
                Keep this Sift
              </button>
            </div>
          ) : selectedId ? (
            <LibraryDetail
              item={detailQuery.data?.item}
              loading={detailQuery.isLoading}
              onBack={() => setLocation("/library")}
            />
          ) : (
            <LibraryList
              items={filtered}
              recurringThemes={listQuery.data?.recurringThemes ?? []}
              filter={filter}
              query={query}
              loading={listQuery.isLoading}
              onQueryChange={setQuery}
              onFilterChange={setFilter}
            />
          )}
        </section>
      </div>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode="signup" />
    </main>
  );
}

function LibraryList({
  items,
  recurringThemes,
  filter,
  query,
  loading,
  onQueryChange,
  onFilterChange,
}: {
  items: LibrarySiftItem[];
  recurringThemes: Array<{ label: string; count: number }>;
  filter: LibraryFilter;
  query: string;
  loading: boolean;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: LibraryFilter) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    if (!expandedId && items[0]) setExpandedId(items[0].id);
  }, [expandedId, items]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-serif text-[42px] leading-none tracking-[-0.055em] text-[#0f4f52] sm:text-[48px]">
          Library
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#5f5548]">
          Your past clarity, organized.
        </p>
      </div>

      <div className="mb-4 rounded-2xl border border-[#e1d5c5] bg-[#fffaf5] shadow-[0_14px_36px_-32px_rgba(48,38,25,0.8)]">
        <div className="flex items-center gap-3 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[#1f6f72]" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search your sessions"
          className="min-w-0 flex-1 bg-transparent text-sm text-[#2f2a22] outline-none placeholder:text-[#a59784]"
        />
        </div>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onFilterChange(id)}
              className={filterChipClass(filter === id)}
            >
              {filter === id ? null : <Icon className="h-3.5 w-3.5" />}
              {label}
            </button>
        ))}
      </div>

      {recurringThemes.length ? (
        <div className="mb-5 rounded-2xl border border-[#d7c8b4] bg-[#fffaf5] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#726656]">
            Recurring themes
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recurringThemes.slice(0, 4).map((theme) => (
              <span key={theme.label} className="rounded-full bg-[#e7f0eb] px-2.5 py-1 text-xs text-[#1f6f72]">
                {theme.label} · {theme.count}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#675d4f]">
            These are observations from saved Sifts, not labels or diagnoses.
          </p>
        </div>
      ) : null}

      {loading ? (
        <p className="py-8 text-sm text-[#675d4f]">Opening the shelves...</p>
      ) : items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <LibraryCard
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#d7c8b4] bg-[#fffaf2] p-6 text-sm leading-relaxed text-[#675d4f]">
          <p className="font-serif text-lg text-[#241f18]">Your notebook is empty.</p>
          <p className="mt-2">
            Saved sifts land here with what mattered, what was noise, and the next step you left with.
          </p>
          <Link href="/sift">
            <a className="mt-4 inline-flex text-[13px] font-medium text-[#1f6f72] underline-offset-4 hover:underline">
              Start a sift
            </a>
          </Link>
        </div>
      )}
    </div>
  );
}

function LibraryCard({
  item,
  expanded,
  onToggle,
}: {
  item: LibrarySiftItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-[1.35rem] border border-[#e1d5c5] bg-[#fffaf5] shadow-[0_16px_42px_-36px_rgba(41,38,31,0.68)] transition-[border-color,box-shadow,transform] duration-300 motion-reduce:transition-none">
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full grid-cols-[72px_1fr_auto] items-start gap-3 p-3 text-left"
        aria-expanded={expanded}
      >
        <DateBlock value={item.createdAt} />
        <div className="min-w-0 pt-0.5">
          <h2 className="font-serif text-[19px] leading-tight tracking-[-0.025em] text-[#221d18]">
            {item.title}
          </h2>
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[#5f5548]">
            {item.summary}
          </p>
          {item.movement ? (
            <p className="mt-2 line-clamp-1 text-[11px] font-medium text-[#1f6f72]">
              Left off: {item.movement.leftOff}
            </p>
          ) : null}
          {item.tags.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-full bg-[#f2eee6] px-2.5 py-1 text-[10px] font-medium text-[#50635a]">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex h-full flex-col items-center justify-between gap-5 pt-1 text-[#766b5d]">
          <Bookmark className={cn("h-5 w-5", (item.hasNextStep || item.pinned) && "text-[#1f6f72]", item.pinned && "fill-[#1f6f72]/15")} />
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      <div
        aria-hidden={!expanded}
        {...(!expanded ? ({ inert: "" } as Record<string, string>) : {})}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-500 ease-out motion-reduce:transition-none",
          expanded
            ? "grid-rows-[1fr] opacity-100"
            : "pointer-events-none grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {expanded ? (
            <div className="mx-3 mb-3 rounded-[1.1rem] border border-[#eadfd0] bg-[#fbf7ef]">
              <div className="border-b border-[#eadfd0] px-4 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#726656]">
                  Clarity Sheet Preview
                </p>
              </div>
              <div className="divide-y divide-[#eadfd0]">
                <PreviewRow
                  icon="spark"
                  title="What mattered"
                  body={item.preview.matters[0] ?? item.preview.summary}
                />
                <PreviewRow
                  icon="heart"
                  title="What can wait"
                  body={item.preview.noise[0] ?? "The raw transcript can wait until you need it."}
                />
                <PreviewRow
                  icon="leaf"
                  title="Suggested next step"
                  body={item.preview.nextStep || "No next step was captured for this sift."}
                />
                {item.movement ? (
                  <PreviewRow
                    icon="spark"
                    title="What shifted"
                    body={item.movement.shifted}
                  />
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eadfd0] bg-[#f7f1e8] px-4 py-3">
                <div className="flex flex-wrap gap-3">
                  <Link href={`/library/${item.id}`}>
                    <a className="inline-flex items-center gap-2 text-[13px] font-medium text-[#1f6f72]">
                      View transcript
                      <ChevronRight className="h-3.5 w-3.5" />
                    </a>
                  </Link>
                  <button
                    type="button"
                    onClick={() => void updateLibraryMemory(item.id, { pinned: !item.pinned })}
                    className="text-[13px] font-medium text-[#746858]"
                  >
                    {item.pinned ? "Unpin" : "Pin important"}
                  </button>
                </div>
                <Link href={`/library/${item.id}`}>
                  <a className="text-[12px] font-medium text-[#746858]">
                    Open full Sift
                  </a>
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function DateBlock({ value }: { value: number }) {
  const date = new Date(value);
  const month = new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);
  const day = new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(date);
  const year = new Intl.DateTimeFormat(undefined, { year: "numeric" }).format(date);
  return (
    <div className="flex h-[76px] flex-col items-center justify-center rounded-2xl bg-[#fbf7ef] text-center text-[#5f5548]">
      <span className="text-[9px] font-semibold uppercase tracking-[0.16em]">
        {month}
      </span>
      <span className="font-serif text-[24px] leading-none tracking-[-0.04em] text-[#221d18]">
        {day}
      </span>
      <span className="mt-0.5 text-[9px] font-medium">{year}</span>
    </div>
  );
}

function PreviewRow({
  icon,
  title,
  body,
}: {
  icon: "spark" | "heart" | "leaf";
  title: string;
  body: string;
}) {
  return (
    <div className="grid grid-cols-[34px_1fr] gap-3 px-4 py-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dfeee7] text-[#0f6a6d]">
        {icon === "spark" ? <Sparkles className="h-4 w-4" /> : null}
        {icon === "heart" ? <span className="text-[15px]">♥</span> : null}
        {icon === "leaf" ? <span className="text-[15px]">⌁</span> : null}
      </span>
      <div>
        <p className="font-serif text-[16px] leading-tight tracking-[-0.02em] text-[#221d18]">
          {title}
        </p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-[#5f5548]">
          {body}
        </p>
      </div>
    </div>
  );
}

function MovementNote({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#eadfd0] bg-[#fbf7ef] p-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#726656]">
        {label}
      </p>
      <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-[#4c4439]">
        {value}
      </p>
    </div>
  );
}

function LibraryDetail({
  item,
  loading,
  onBack,
}: {
  item?: LibrarySiftDetail;
  loading: boolean;
  onBack: () => void;
}) {
  const [showTranscript, setShowTranscript] = useState(false);

  if (loading || !item) {
    return <p className="py-8 text-sm text-[#675d4f]">Opening this sift...</p>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-5 text-sm font-medium text-[#675d4f] transition hover:text-[#241f18]"
      >
        Back to Library
      </button>

      <article className="rounded-2xl border border-[#d7c8b4] bg-[#fffaf2] p-4 sm:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#675d4f]">
          Clarity Sheet
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-[34px] leading-none tracking-[-0.045em] text-[#241f18]">
              {item.title}
            </h1>
            <p className="mt-2 text-sm text-[#7a6e5d]">{formatDate(item.createdAt)}</p>
          </div>
          {item.environment ? (
            <span className="rounded-full border border-[#d7c8b4] px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-[#675d4f]">
              {item.environment}
            </span>
          ) : null}
        </div>

        <p className="mt-5 text-[16px] leading-relaxed text-[#2f2a22]">
          {item.preview.summary}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <SignalList title="What mattered" items={item.preview.matters} />
          <SignalList title="What was noise" items={item.preview.noise} quiet />
        </div>

        {item.preview.nextStep ? (
          <div className="mt-5 rounded-2xl border border-[#65765c]/25 bg-[#e7eddf] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#4f6048]">
              Next step
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-[#25301f]">
              {item.preview.nextStep}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href={`/s/${encodeURIComponent(item.id)}`}>
                <a className="text-[13px] font-medium text-[#1f6f72] underline-offset-4 hover:underline">
                  Continue thread
                </a>
              </Link>
              <Link href={`/s/${encodeURIComponent(item.id)}`}>
                <a className="text-[13px] font-medium text-[#746858] underline-offset-4 hover:underline">
                  Check in on this step
                </a>
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <Link href={`/s/${encodeURIComponent(item.id)}`}>
              <a className="text-[13px] font-medium text-[#1f6f72] underline-offset-4 hover:underline">
                Continue thread
              </a>
            </Link>
          </div>
        )}

        {item.movement ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <MovementNote label="What shifted" value={item.movement.shifted} />
            <MovementNote label="Where you left off" value={item.movement.leftOff} />
            <MovementNote
              label="What recurred"
              value={item.movement.recurring ?? "No recurring pattern yet."}
            />
          </div>
        ) : null}
      </article>

      {item.themes.length ? (
        <section className="mt-4 rounded-2xl border border-[#d7c8b4] bg-[#fffaf2] p-4">
          <h2 className="font-serif text-2xl text-[#241f18]">Key themes</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {item.themes.map((theme) => (
              <div key={theme.title} className="rounded-xl border border-[#d7c8b4] bg-[#f6efe3] p-3">
                <p className="font-medium text-[#2f2a22]">{theme.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#675d4f]">{theme.summary}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-4 rounded-2xl border border-[#d7c8b4] bg-[#fffaf2] p-4">
        <h2 className="font-serif text-2xl text-[#241f18]">Session memory</h2>
        <p className="mt-1 text-sm leading-relaxed text-[#675d4f]">
          Choose what stays from this Sift. Clarity can remain even if the transcript is removed.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void updateLibraryMemory(item.id, { memoryMode: "clarity_only" })}
            className="rounded-full border border-[#d7c8b4] px-3 py-1.5 text-xs font-medium text-[#675d4f] hover:border-[#65765c]/45"
          >
            Save Clarity only
          </button>
          <button
            type="button"
            onClick={() => void updateLibraryMemory(item.id, { memoryMode: "full", transcriptExpiresAt: null })}
            className="rounded-full border border-[#d7c8b4] px-3 py-1.5 text-xs font-medium text-[#675d4f] hover:border-[#65765c]/45"
          >
            Save full session
          </button>
          <button
            type="button"
            onClick={() => void updateLibraryMemory(item.id, { transcriptExpiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30 })}
            className="rounded-full border border-[#d7c8b4] px-3 py-1.5 text-xs font-medium text-[#675d4f] hover:border-[#65765c]/45"
          >
            Auto-delete transcript in 30 days
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Delete this saved Sift? This removes its Clarity Sheet and transcript.")) {
                void updateLibraryMemory(item.id, { memoryMode: "do_not_remember" });
              }
            }}
            className="rounded-full border border-red-200 bg-red-50/70 px-3 py-1.5 text-xs font-medium text-red-700"
          >
            Do not remember this session
          </button>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-[#d7c8b4] bg-[#fffaf2] p-4">
        <button
          type="button"
          onClick={() => setShowTranscript((value) => !value)}
          className="text-sm font-semibold text-[#2f2a22]"
        >
          {showTranscript ? "Hide transcript" : "Reveal transcript"}
        </button>
        {showTranscript ? (
          <div className="mt-3 space-y-2">
            {item.memoryMode === "clarity_only" ? (
              <p className="rounded-xl border border-[#d7c8b4] bg-[#f6efe3] p-3 text-sm leading-relaxed text-[#4c4338]">
                This session is stored as Clarity-only. The raw transcript is not retained here.
              </p>
            ) : (
              <>
                <p className="rounded-xl border border-[#d7c8b4] bg-[#f6efe3] p-3 text-sm leading-relaxed text-[#4c4338]">
                  Opening input: {item.input}
                </p>
                {item.transcript.map((turn) => (
                  <TranscriptTurn key={turn.id} turn={turn} />
                ))}
              </>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-[#675d4f]">
            The raw conversation is kept here, but the Library leads with the sifted read.
          </p>
        )}
      </section>

      {item.related.length ? (
        <section className="mt-4">
          <h2 className="mb-3 font-serif text-2xl text-[#241f18]">Related past Sifts</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {item.related.map((related) => (
              <MiniLibraryCard key={related.id} item={related} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function MiniLibraryCard({ item }: { item: LibrarySiftItem }) {
  return (
    <Link href={`/library/${item.id}`}>
      <a className="block rounded-2xl border border-[#e1d5c5] bg-[#fffaf5] p-3 transition hover:border-[#0f6a6d]/35 motion-reduce:transition-none">
        <p className="text-[11px] text-[#7a6e5d]">{formatDate(item.createdAt)}</p>
        <h3 className="mt-1 font-serif text-lg leading-tight text-[#221d18]">{item.title}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#5f5548]">
          {item.summary}
        </p>
      </a>
    </Link>
  );
}

function SignalList({ title, items, quiet = false }: { title: string; items: string[]; quiet?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#d7c8b4] bg-[#f6efe3] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#675d4f]">
        {title}
      </p>
      <ul className="mt-3 space-y-2">
        {items.length ? items.map((item) => (
          <li key={item} className={cn("text-sm leading-relaxed", quiet ? "text-[#675d4f]" : "text-[#2f2a22]")}>
            {item}
          </li>
        )) : (
          <li className="text-sm text-[#8a7d6a]">Not captured yet.</li>
        )}
      </ul>
    </div>
  );
}

function TranscriptTurn({ turn }: { turn: ThreadTurn }) {
  let text = "";
  if (turn.kind === "message" && turn.role === "user") text = turn.text;
  if (turn.kind === "message" && turn.role === "sift") {
    text = [turn.message.mirror, turn.message.mini, turn.message.question]
      .filter(Boolean)
      .join(" ");
  }
  if (turn.kind === "checkpoint") text = turn.checkpoint.unfolded;
  if (turn.kind === "closure") text = turn.reflection;
  if (turn.kind === "sort_result") text = "Signal / Noise sort completed.";
  if (turn.kind === "sort_prompt") text = turn.sortPrompt.intro;
  return (
    <div className="rounded-xl border border-[#d7c8b4] bg-[#fdf8ef] p-3 text-sm leading-relaxed text-[#4c4338]">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a7d6a]">
        {turn.role} · {turn.kind}
      </p>
      {text || "No display text captured."}
    </div>
  );
}

function filterChipClass(active: boolean) {
  return cn(
    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition motion-reduce:transition-none",
    active
      ? "border-[#0f6a6d] bg-[#0f6a6d] text-[#fffaf5] shadow-[0_10px_28px_-22px_rgba(15,106,109,0.9)]"
      : "border-[#e1d5c5] bg-[#fffaf5] text-[#5f5548] hover:border-[#0f6a6d]/35",
  );
}

async function updateLibraryMemory(
  id: string,
  patch: {
    pinned?: boolean;
    memoryMode?: "full" | "clarity_only" | "do_not_remember";
    transcriptExpiresAt?: number | null;
  },
) {
  await apiRequest("PATCH", `/api/library/${id}/memory`, patch);
  queryClient.invalidateQueries({ queryKey: ["/api/library"] });
  queryClient.invalidateQueries({ queryKey: [`/api/library/${id}`] });
}

function libraryFilterMatches(item: LibrarySiftItem, filter: Exclude<LibraryFilter, "recent">) {
  const text = [
    item.title,
    item.summary,
    item.preview.summary,
    item.preview.nextStep,
    item.mode ?? "",
    ...item.tags,
    ...item.preview.matters,
    ...item.preview.noise,
  ]
    .join(" ")
    .toLowerCase();

  if (filter === "important") {
    return item.pinned || item.hasNextStep || text.includes("decision") || text.includes("matters");
  }
  if (filter === "relationships") {
    return [
      "wife",
      "partner",
      "relationship",
      "family",
      "friend",
      "person",
      "conversation",
      "boundaries",
    ].some((term) => text.includes(term));
  }
  if (filter === "work") {
    return item.mode === "operator" || [
      "work",
      "project",
      "client",
      "contract",
      "launch",
      "decision",
      "money",
      "team",
    ].some((term) => text.includes(term));
  }
  return [
    "identity",
    "self",
    "voice",
    "growth",
    "approval",
    "trust",
    "meaning",
    "feeling",
  ].some((term) => text.includes(term));
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
