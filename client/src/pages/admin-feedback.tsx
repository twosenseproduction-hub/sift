import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Header, Footnote } from "@/components/brand";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMe } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ChevronRight, Check } from "lucide-react";
import type {
  AdminReviewFeedback,
  AdminReviewSift,
  FeedbackStage,
  FeedbackSentiment,
  FeedbackStats,
} from "@shared/schema";

// Pretty labels for the curated tags. Anything not in this map renders as
// the raw snake_case value — fine for one-off experiments.
const tagPretty: Record<string, string> = {
  felt_accurate: "Felt accurate",
  made_things_clearer: "Made things clearer",
  good_next_step: "Good next step",
  calming: "Calming",
  helped_me_focus: "Helped me focus",
  too_vague: "Too vague",
  missed_the_point: "Missed the point",
  too_wordy: "Too wordy",
  not_actionable: "Not actionable",
  felt_repetitive: "Felt repetitive",
};

const STAGES: Array<FeedbackStage | "all"> = [
  "all",
  "result",
  "deepening",
  "summary",
  "closure",
];
const SENTIMENTS: Array<FeedbackSentiment | "all"> = [
  "all",
  "helpful",
  "not_helpful",
];
const RESOLUTION = ["all", "unresolved", "resolved"] as const;
const AUDIENCE = ["all", "signed_in", "anonymous"] as const;

type StageFilter = (typeof STAGES)[number];
type SentimentFilter = (typeof SENTIMENTS)[number];
type ResolutionFilter = (typeof RESOLUTION)[number];
type AudienceFilter = (typeof AUDIENCE)[number];

export default function AdminFeedbackPage() {
  const { data: meData, isLoading: meLoading } = useMe();
  const me = meData?.me;
  const { toast } = useToast();

  const [stage, setStage] = useState<StageFilter>("all");
  const [sentiment, setSentiment] = useState<SentimentFilter>("all");
  const [tag, setTag] = useState<string | null>(null);
  const [resolution, setResolution] = useState<ResolutionFilter>("all");
  const [audience, setAudience] = useState<AudienceFilter>("all");

  // Build the query string. The server ignores unknown/empty values cleanly.
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (stage !== "all") params.set("stage", stage);
    if (sentiment !== "all") params.set("sentiment", sentiment);
    if (tag) params.set("tag", tag);
    if (resolution !== "all") {
      params.set("resolved", resolution === "resolved" ? "true" : "false");
    }
    if (audience !== "all") params.set("audience", audience);
    const s = params.toString();
    return s ? `?${s}` : "";
  }, [stage, sentiment, tag, resolution, audience]);

  const { data: stats, isLoading: statsLoading, isError, error } =
    useQuery<FeedbackStats>({
      queryKey: ["/api/admin/feedback/stats"],
      queryFn: async () => {
        const res = await apiRequest("GET", "/api/admin/feedback/stats");
        return res.json();
      },
      enabled: !!me,
      refetchOnWindowFocus: false,
    });

  const { data: feedbackData, isLoading: feedbackLoading } = useQuery<{
    feedback: AdminReviewFeedback[];
  }>({
    queryKey: ["/api/admin/feedback", queryString],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/feedback${queryString}`,
      );
      return res.json();
    },
    enabled: !!me,
    refetchOnWindowFocus: false,
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, resolved }: { id: number; resolved: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/feedback/${id}`, {
        resolved,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/feedback/stats"],
      });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't update",
        description: err?.message ?? "Try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const errMsg = (error as any)?.message ?? "";
  const isForbidden = /^403/.test(errMsg);
  const isUnauthorized = /^401/.test(errMsg);

  const items = feedbackData?.feedback ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 md:px-8 pt-8 md:pt-12 pb-16">
          <div className="mb-8 md:mb-10">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Admin · Feedback
            </p>
            <h1 className="font-serif text-3xl md:text-4xl mt-2">
              What people are saying
            </h1>
            <p className="text-sm text-muted-foreground mt-3 max-w-lg">
              First-party feedback from inside the app. Patterns first, voices
              underneath.
            </p>
            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
              <Link
                href="/admin"
                className="underline underline-offset-4 hover:text-foreground"
                data-testid="link-admin-stats"
              >
                Engagement stats
              </Link>
              <Link
                href="/"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Back to home
              </Link>
            </div>
          </div>

          {meLoading ? (
            <Skeleton />
          ) : !me ? (
            <Notice>
              Sign in with an admin handle to see feedback.{" "}
              <Link href="/" className="underline underline-offset-4">
                Back to home
              </Link>
            </Notice>
          ) : isError && (isForbidden || isUnauthorized) ? (
            <Notice>
              This handle isn't on the admin list.{" "}
              <Link href="/" className="underline underline-offset-4">
                Back to home
              </Link>
            </Notice>
          ) : (
            <>
              {/* Stats */}
              {statsLoading ? (
                <Skeleton />
              ) : stats ? (
                <StatsBlock
                  stats={stats}
                  onTagClick={(t) => setTag(t === tag ? null : t)}
                  selectedTag={tag}
                />
              ) : null}

              {/* Filters */}
              <div
                className="mt-10 mb-6 grid gap-4 md:grid-cols-2"
                data-testid="filters"
              >
                <FilterRow
                  label="Stage"
                  options={STAGES}
                  value={stage}
                  onChange={(v) => setStage(v as StageFilter)}
                  format={(v) => (v === "all" ? "All" : titleCase(v))}
                  testId="filter-stage"
                />
                <FilterRow
                  label="Sentiment"
                  options={SENTIMENTS}
                  value={sentiment}
                  onChange={(v) => setSentiment(v as SentimentFilter)}
                  format={(v) =>
                    v === "all"
                      ? "All"
                      : v === "helpful"
                      ? "Helpful"
                      : "Not helpful"
                  }
                  testId="filter-sentiment"
                />
                <FilterRow
                  label="Status"
                  options={RESOLUTION}
                  value={resolution}
                  onChange={(v) => setResolution(v as ResolutionFilter)}
                  format={(v) =>
                    v === "all" ? "All" : v === "resolved" ? "Resolved" : "Open"
                  }
                  testId="filter-resolution"
                />
                <FilterRow
                  label="Audience"
                  options={AUDIENCE}
                  value={audience}
                  onChange={(v) => setAudience(v as AudienceFilter)}
                  format={(v) =>
                    v === "all"
                      ? "All"
                      : v === "signed_in"
                      ? "Signed in"
                      : "Anonymous"
                  }
                  testId="filter-audience"
                />
                {tag && (
                  <div className="md:col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Tag filter:</span>
                    <span className="px-2 py-1 rounded-full border border-primary/40 text-foreground">
                      {tagPretty[tag] ?? tag}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTag(null)}
                      className="underline underline-offset-4 hover:text-foreground"
                      data-testid="button-clear-tag"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Feed */}
              {feedbackLoading ? (
                <Skeleton />
              ) : items.length === 0 ? (
                <Notice>
                  No feedback matches these filters yet.
                </Notice>
              ) : (
                <ul className="space-y-3" data-testid="feedback-list">
                  {items.map((item) => (
                    <FeedbackCard
                      key={item.id}
                      item={item}
                      onResolve={(resolved) =>
                        resolveMutation.mutate({ id: item.id, resolved })
                      }
                      pending={
                        resolveMutation.isPending &&
                        resolveMutation.variables?.id === item.id
                      }
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </main>
      <Footnote />
    </div>
  );
}

// --- Stats block ---
function StatsBlock({
  stats,
  onTagClick,
  selectedTag,
}: {
  stats: FeedbackStats;
  onTagClick: (tag: string) => void;
  selectedTag: string | null;
}) {
  const helpfulPct =
    stats.total === 0 ? 0 : Math.round((stats.helpful / stats.total) * 100);
  const negTags = stats.topTags.filter((t) => t.sentiment === "not_helpful");
  const posTags = stats.topTags.filter((t) => t.sentiment === "helpful");

  return (
    <div data-testid="stats">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total.toString()} testId="stat-total" />
        <StatCard
          label="Helpful"
          value={stats.helpful.toString()}
          sub={stats.total ? `${helpfulPct}%` : undefined}
          testId="stat-helpful"
        />
        <StatCard
          label="Not helpful"
          value={stats.notHelpful.toString()}
          testId="stat-not-helpful"
        />
        <StatCard
          label="Open"
          value={stats.unresolved.toString()}
          testId="stat-open"
        />
      </div>

      {/* By stage */}
      <div className="mt-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
          By stage
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(stats.byStage) as FeedbackStage[]).map((s) => {
            const row = stats.byStage[s];
            const tot = row.helpful + row.notHelpful;
            return (
              <div
                key={s}
                className="rounded-md border border-border px-4 py-3"
                data-testid={`stage-${s}`}
              >
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {titleCase(s)}
                </p>
                <p className="font-serif text-2xl mt-1">{tot}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-primary/80">{row.helpful}</span> /{" "}
                  <span>{row.notHelpful}</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tag clouds */}
      {(posTags.length > 0 || negTags.length > 0) && (
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <TagCloud
            title="Most common — helpful"
            tags={posTags}
            tone="positive"
            selectedTag={selectedTag}
            onTagClick={onTagClick}
          />
          <TagCloud
            title="Most common — not helpful"
            tags={negTags}
            tone="negative"
            selectedTag={selectedTag}
            onTagClick={onTagClick}
          />
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  testId,
}: {
  label: string;
  value: string;
  sub?: string;
  testId?: string;
}) {
  return (
    <div
      className="rounded-md border border-border px-4 py-4"
      data-testid={testId}
    >
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="font-serif text-3xl md:text-4xl mt-2 leading-none">
        {value}
      </p>
      {sub ? (
        <p className="text-xs text-muted-foreground mt-2">{sub}</p>
      ) : null}
    </div>
  );
}

function TagCloud({
  title,
  tags,
  tone,
  selectedTag,
  onTagClick,
}: {
  title: string;
  tags: FeedbackStats["topTags"];
  tone: "positive" | "negative";
  selectedTag: string | null;
  onTagClick: (tag: string) => void;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
        {title}
      </p>
      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">None yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => {
            const isSelected = selectedTag === t.tag;
            return (
              <button
                key={`${t.tag}-${t.sentiment}`}
                type="button"
                onClick={() => onTagClick(t.tag)}
                className={[
                  "text-xs px-3 py-1.5 rounded-full border transition-colors",
                  isSelected
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : tone === "positive"
                    ? "border-primary/30 text-foreground/80 hover:bg-primary/10"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                ].join(" ")}
                data-testid={`tag-cloud-${t.tag}`}
              >
                {(tagPretty[t.tag] ?? t.tag) + " · " + t.count}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Feedback card ---
function FeedbackCard({
  item,
  onResolve,
  pending,
}: {
  item: AdminReviewFeedback;
  onResolve: (resolved: boolean) => void;
  pending: boolean;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  // Lazy-load the sift's structured output ONLY when the reviewer opens the
  // panel — we don't want to fan out N parallel detail requests on list load.
  // The endpoint returns AdminReviewFeedback + AdminReviewSift; both are
  // explicitly allowlist-serialized server-side and never include raw input.
  const { data: detail, isLoading: detailLoading } = useQuery<{
    feedback: AdminReviewFeedback;
    sift: AdminReviewSift | null;
  }>({
    queryKey: ["/api/admin/feedback", item.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/feedback/${item.id}`);
      return res.json();
    },
    enabled: reviewOpen && !!item.siftId,
    refetchOnWindowFocus: false,
  });

  const when = new Date(item.createdAt).toLocaleString();
  const sentimentLabel =
    item.sentiment === "helpful" ? "Helpful" : "Not helpful";
  const sentimentClass =
    item.sentiment === "helpful"
      ? "text-primary border-primary/40"
      : "text-foreground/80 border-foreground/20";

  return (
    <li
      className={[
        "rounded-md border px-4 py-4 md:px-5 md:py-5",
        item.resolved ? "border-border/50 bg-foreground/[0.02]" : "border-border",
      ].join(" ")}
      data-testid={`feedback-${item.id}`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[11px] uppercase tracking-widest px-2 py-1 rounded-full border ${sentimentClass}`}
          >
            {sentimentLabel}
          </span>
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {titleCase(item.stage)}
          </span>
          {item.tag && (
            <span className="text-xs text-muted-foreground">
              {tagPretty[item.tag] ?? item.tag}
            </span>
          )}
          {item.resolved && (
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
              <Check className="w-3 h-3" />
              Resolved
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{when}</p>
      </div>

      {item.message && (
        <p
          className="mt-3 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap"
          data-testid={`feedback-message-${item.id}`}
        >
          {item.message}
        </p>
      )}

      {/* Privacy boundary: the original user prompt is intentionally not
          shown anywhere in admin review. Reviewers see the model's structured
          output (themes, core intent, next step, reflection) plus harmless
          metadata (char count, input mode) so they can assess sift quality
          without ever reading the user's exact wording. */}
      <p
        className="mt-3 text-[11px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-2"
        data-testid={`feedback-prompt-redacted-${item.id}`}
        aria-label="Original prompt hidden for review privacy"
      >
        <span aria-hidden="true" className="opacity-60">—</span>
        Original prompt hidden for review privacy
        {item.promptMeta && (
          <span className="normal-case tracking-normal text-muted-foreground/80">
            · {item.promptMeta.inputMode === "voice" ? "voice" : "text"} ·{" "}
            {item.promptMeta.charCount.toLocaleString()} chars
          </span>
        )}
      </p>

      {(item.coreIntentSnapshot || item.siftId) && (
        <details
          className="mt-3 group"
          onToggle={(e) =>
            setReviewOpen((e.target as HTMLDetailsElement).open)
          }
        >
          <summary
            className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-2"
            data-testid={`feedback-review-toggle-${item.id}`}
          >
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
            Sift output
          </summary>
          <div className="mt-2 space-y-3 text-xs">
            {item.coreIntentSnapshot && (
              <div>
                <p className="uppercase tracking-widest text-muted-foreground mb-1">
                  Core intent
                </p>
                <p
                  className="text-foreground/85 leading-relaxed"
                  data-testid={`feedback-core-intent-${item.id}`}
                >
                  {item.coreIntentSnapshot}
                </p>
              </div>
            )}
            {item.siftId && reviewOpen && (
              <SiftReviewBlock
                feedbackId={item.id}
                sift={detail?.sift ?? null}
                loading={detailLoading}
              />
            )}
          </div>
        </details>
      )}

      <div className="mt-4 flex items-center justify-between flex-wrap gap-2 text-xs text-muted-foreground">
        <span data-testid={`feedback-author-${item.id}`}>
          {item.userHandle ? `@${item.userHandle}` : "Anonymous"}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onResolve(!item.resolved)}
          disabled={pending}
          data-testid={`button-toggle-resolved-${item.id}`}
        >
          {item.resolved ? "Reopen" : "Mark resolved"}
        </Button>
      </div>
    </li>
  );
}

// --- Sift review block ---
//
// Renders the prompt-redacted sift output (themes, next step, reflection)
// fetched on demand. Receives an AdminReviewSift — the type literally has no
// field that could carry raw prompt text.
function SiftReviewBlock({
  feedbackId,
  sift,
  loading,
}: {
  feedbackId: number;
  sift: AdminReviewSift | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div
        className="h-12 rounded-md bg-foreground/[0.03] animate-pulse"
        data-testid={`feedback-sift-loading-${feedbackId}`}
      />
    );
  }
  if (!sift) {
    return (
      <p
        className="text-muted-foreground"
        data-testid={`feedback-sift-missing-${feedbackId}`}
      >
        Sift no longer available.
      </p>
    );
  }
  return (
    <div
      className="space-y-3 rounded-md border border-border/60 px-3 py-3"
      data-testid={`feedback-sift-review-${feedbackId}`}
    >
      {sift.themes.length > 0 && (
        <div>
          <p className="uppercase tracking-widest text-muted-foreground mb-1">
            Themes
          </p>
          <ul className="space-y-1.5">
            {sift.themes.map((t, i) => (
              <li key={i} className="text-foreground/85 leading-relaxed">
                <span className="text-foreground">{t.title}</span>
                {t.summary ? (
                  <span className="text-muted-foreground"> — {t.summary}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className="uppercase tracking-widest text-muted-foreground mb-1">
          Next step
        </p>
        <p className="text-foreground/85 leading-relaxed">{sift.nextStep}</p>
      </div>
      <div>
        <p className="uppercase tracking-widest text-muted-foreground mb-1">
          Reflection
        </p>
        <p className="text-foreground/85 leading-relaxed">{sift.reflection}</p>
      </div>
    </div>
  );
}

// --- Filter row ---
function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
  format,
  testId,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
  testId?: string;
}) {
  return (
    <div data-testid={testId}>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const selected = o === value;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={[
                "text-xs px-3 py-1.5 rounded-full border transition-colors",
                selected
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
              ].join(" ")}
              data-testid={`${testId}-option-${o}`}
            >
              {format(o)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Tiny helpers ---
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-foreground/10 px-5 py-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4" data-testid="status-loading">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-24 rounded-md bg-foreground/[0.03] animate-pulse"
        />
      ))}
    </div>
  );
}

function titleCase(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
