import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Bookmark,
  Briefcase,
  ChevronRight,
  ChevronUp,
  Search,
  Sparkles,
  Star,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { LibrarySiftDetail, LibrarySiftItem, SupportProfile, ThreadTurn } from "@shared/schema";
import { SiftAppShell } from "@/components/redesign-v3";
import { AuthDialog } from "@/components/auth-dialog";
import { SupportProfileDialog } from "@/components/support-profile-dialog";
import { useMe } from "@/lib/auth";
import {
  mergeSupportProfiles,
  readLocalSupportProfile,
  supportProfileBaseVisualMode,
  writeLocalSupportProfile,
} from "@/lib/sift-experience";
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
  const [localOnboardingProfile, setLocalOnboardingProfile] = useState<SupportProfile | null>(() =>
    readLocalSupportProfile(),
  );
  const effectiveSupportProfile = mergeSupportProfiles(localOnboardingProfile, me?.supportProfile);
  const [baseMode, setBaseMode] = useState<"dark" | "light">(() =>
    supportProfileBaseVisualMode(effectiveSupportProfile),
  );

  useEffect(() => {
    setBaseMode(supportProfileBaseVisualMode(effectiveSupportProfile));
  }, [effectiveSupportProfile?.theme]);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("recent");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const openAuth = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };
  const [supportProfileOpen, setSupportProfileOpen] = useState(false);

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
    <SiftAppShell
      activeTab="library"
      onSettingsClick={() => setSupportProfileOpen(true)}
      settingsTestId="button-library-settings"
    >
      {!me ? (
        <div className="v3-library-main">
          <div className="v3-empty-state py-16 text-center">
            <p className="v3-empty-state-title">Save your clarity.</p>
            <p className="mt-3 max-w-md mx-auto">
              Create your space to keep Sifts, return later, and build a Library over time.
            </p>
            <button
              type="button"
              onClick={() => openAuth("signup")}
              className="v3-sift-btn mt-6"
            >
              Keep this Sift
            </button>
          </div>
        </div>
      ) : (
        <div className="v3-library-layout">
          <aside className="v3-library-filters">
            <h1 className="v3-filter-title">Library</h1>
            <div className="v3-filter-group">
              <p className="v3-filter-group-label">Browse</p>
              <div className="v3-filter-chips">
                {FILTERS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    className={cn("v3-filter-chip", filter === id && "active")}
                    onClick={() => setFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {listQuery.data?.recurringThemes?.length ? (
              <div className="v3-filter-group">
                <p className="v3-filter-group-label">Themes</p>
                <div className="v3-filter-chips">
                  {listQuery.data.recurringThemes.slice(0, 4).map((theme) => (
                    <span key={theme.label} className="v3-filter-chip">
                      {theme.label} · {theme.count}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>

          <div className="v3-library-main">
            {selectedId ? (
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
          </div>
        </div>
      )}

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode={authMode} baseMode={baseMode} />
      <SupportProfileDialog
        open={supportProfileOpen}
        onOpenChange={setSupportProfileOpen}
        profile={effectiveSupportProfile}
        canPersist={Boolean(me)}
        baseMode={baseMode}
        onBaseModeChange={setBaseMode}
        onSaveLocal={(profile) => {
          setLocalOnboardingProfile(profile);
          writeLocalSupportProfile(profile);
          if (profile?.theme === "light") setBaseMode("light");
          if (profile?.theme === "dark") setBaseMode("dark");
        }}
        me={me ?? null}
        onRequestSignIn={() => {
          setSupportProfileOpen(false);
          openAuth("signin");
        }}
      />
    </SiftAppShell>
  );
}

function LibraryList({
  items,
  filter,
  query,
  loading,
  onQueryChange,
  onFilterChange,
}: {
  items: LibrarySiftItem[];
  recurringThemes?: Array<{ label: string; count: number }>;
  filter: LibraryFilter;
  query: string;
  loading: boolean;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: LibraryFilter) => void;
}) {
  return (
    <div>
      <div className="v3-library-header">
        <p className="v3-library-count">
          {loading ? "Opening the shelves…" : `${items.length} saved ${items.length === 1 ? "sift" : "sifts"}`}
        </p>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search your sessions"
          className="v3-search-input"
        />
      </div>

      <div className="v3-mobile-filters">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={cn("v3-filter-chip", filter === id && "active")}
            onClick={() => onFilterChange(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="v3-empty-state">Opening the shelves…</p>
      ) : items.length ? (
        <div>
          {items.map((item) => (
            <Link key={item.id} href={`/library/${item.id}`}>
              <a className="v3-entry-row">
                <V3EntryDate value={item.createdAt} />
                <div>
                  <p className="v3-entry-signal">{item.title}</p>
                  <p className="v3-entry-preview">{item.summary}</p>
                </div>
                {item.tags[0] ? (
                  <span className="v3-entry-tag">{item.tags[0]}</span>
                ) : (
                  <span />
                )}
              </a>
            </Link>
          ))}
        </div>
      ) : (
        <div className="v3-empty-state">
          <p className="v3-empty-state-title">Your notebook is empty.</p>
          <p className="mt-2">
            Saved sifts land here with what mattered, what was noise, and the next step you left with.
          </p>
          <Link href="/sift">
            <a className="mt-4 inline-block text-[13px] text-[color:var(--v3-sage)] underline-offset-4 hover:underline">
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

function V3EntryDate({ value }: { value: number }) {
  const date = new Date(value);
  const month = new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);
  const day = new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(date);
  return (
    <div className="v3-entry-date">
      {month}
      <br />
      {day}
    </div>
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
      <button type="button" onClick={onBack} className="v3-detail-back">
        ← Back to Library
      </button>

      <div className="v3-detail-meta">
        <span className="v3-detail-date">{formatDate(item.createdAt)}</span>
        {item.environment ? (
          <span className="v3-entry-tag">{item.environment}</span>
        ) : null}
      </div>

      <p className="v3-detail-tangle-label">What you brought</p>
      <p className="v3-detail-tangle">{item.input || item.preview.summary}</p>

      <hr className="v3-detail-divider" />

      <div className="space-y-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--v3-leaf-accent)]">
            Signal
          </p>
          <p className="mt-2 font-serif text-[22px] font-light leading-snug text-[color:var(--v3-text-primary)]">
            {item.preview.summary}
          </p>
        </div>

        {item.preview.matters?.length ? (
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--v3-leaf-accent)]">
              What mattered
            </p>
            <ul className="mt-2 space-y-2">
              {item.preview.matters.map((m) => (
                <li key={m} className="text-[14px] font-light text-[color:var(--v3-text-secondary)]">
                  — {m}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {item.preview.noise?.length ? (
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--v3-leaf-accent)]">
              Noise
            </p>
            <ul className="mt-2 space-y-2">
              {item.preview.noise.map((n) => (
                <li key={n} className="text-[14px] font-light text-[color:var(--v3-text-secondary)]">
                  — {n}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {item.preview.nextStep ? (
          <div className="rounded-[3px] border border-[color:var(--v3-border)] bg-[rgba(215,210,196,0.45)] p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--v3-sage)]">
              One next step
            </p>
            <p className="mt-2 font-serif text-[19px] font-light italic leading-relaxed text-[color:var(--v3-text-primary)]">
              {item.preview.nextStep}
            </p>
          </div>
        ) : null}
      </div>

      {item.transcript?.length ? (
        <div className="mt-10">
          <button
            type="button"
            onClick={() => setShowTranscript(!showTranscript)}
            className="v3-hint-tag"
          >
            {showTranscript ? "Hide" : "Show"} full thread
          </button>
          {showTranscript ? (
            <div className="mt-4 space-y-3 border-l-2 border-[color:var(--v3-border)] pl-5">
              {item.transcript.map((turn) => (
                <TranscriptTurn key={turn.id} turn={turn} />
              ))}
            </div>
          ) : null}
        </div>
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
