import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Header, Footnote } from "@/components/brand";
import { apiRequest } from "@/lib/queryClient";
import { useMe } from "@/lib/auth";

// --- Types mirror the /api/admin/stats payload ---
interface AdminSeriesPoint {
  label: string;
  signups: number;
  sifts: number;
  checkins: number;
  didIt: number;
  rate: number | null;
}

interface AdminStats {
  totals: {
    users: number;
    sifts: number;
    checkins: number;
    didItCheckins: number;
    checkinCompletionRate: number;
  };
  series: AdminSeriesPoint[];
}

interface AdminUserRow {
  id: number;
  handle: string;
  email: string | null;
  phone: string | null;
  consentUpdates: boolean;
  consentReflections: boolean;
  createdAt: number;
  siftCount: number;
  lastSiftAt: number | null;
}

interface AdminUsersPayload {
  users: AdminUserRow[];
}

// --- Small inline SVG sparkline. No chart library; stays on-brand. ---
// values: 7 points, one per day. Renders a thin polyline inside a fixed viewBox.
// null values (e.g. days with no data for a rate) are skipped in the path so
// the line doesn't dive to zero on empty days — matching "Clarity over comfort".
function Sparkline({
  values,
  testId,
}: {
  values: Array<number | null>;
  testId?: string;
}) {
  const width = 160;
  const height = 40;
  const padX = 2;
  const padY = 4;

  const nums = values.filter((v): v is number => typeof v === "number");
  const max = nums.length ? Math.max(...nums) : 1;
  const min = nums.length ? Math.min(...nums) : 0;
  const range = max - min || 1;

  const points = values.map((v, i) => {
    if (v === null) return null;
    const x = padX + (i * (width - padX * 2)) / Math.max(values.length - 1, 1);
    // Invert Y: larger value → higher on screen (smaller y).
    const y = padY + (height - padY * 2) * (1 - (v - min) / range);
    return { x, y, i };
  });

  // Build the polyline, breaking into segments across null gaps.
  const segments: string[] = [];
  let current: string[] = [];
  for (const p of points) {
    if (p === null) {
      if (current.length >= 2) segments.push(`M ${current.join(" L ")}`);
      current = [];
    } else {
      current.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
  }
  if (current.length >= 2) segments.push(`M ${current.join(" L ")}`);
  const path = segments.join(" ");

  const lastPoint = [...points].reverse().find((p): p is NonNullable<typeof p> => p !== null);

  // Empty-state: if fewer than 2 real data points, render a faint flat line
  // so the layout still holds rather than collapsing. Reads as "not enough
  // data yet" rather than failure.
  const hasPath = nums.length >= 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="overflow-visible"
      role="img"
      aria-label="7-day trend"
      data-testid={testId}
    >
      {/* Baseline for visual rhythm */}
      <line
        x1={padX}
        x2={width - padX}
        y1={height - padY}
        y2={height - padY}
        className="stroke-foreground/10"
        strokeWidth={1}
      />
      {hasPath ? (
        <>
          <path
            d={path}
            className="stroke-foreground/70"
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {lastPoint && (
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r={2.5}
              className="fill-foreground"
            />
          )}
        </>
      ) : (
        <line
          x1={padX}
          x2={width - padX}
          y1={height / 2}
          y2={height / 2}
          className="stroke-foreground/15"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      )}
    </svg>
  );
}

// --- A single stat row: number + label + sparkline ---
function StatRow({
  label,
  value,
  sub,
  sparkValues,
  sparkTestId,
  valueTestId,
}: {
  label: string;
  value: string;
  sub?: string;
  sparkValues: Array<number | null>;
  sparkTestId: string;
  valueTestId: string;
}) {
  return (
    <div className="flex items-end justify-between gap-6 py-6 border-b border-foreground/10 last:border-b-0">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p
          className="font-serif text-5xl md:text-6xl leading-none mt-3"
          data-testid={valueTestId}
        >
          {value}
        </p>
        {sub ? (
          <p className="text-xs text-muted-foreground mt-2">{sub}</p>
        ) : null}
      </div>
      <div className="shrink-0 self-center">
        <Sparkline values={sparkValues} testId={sparkTestId} />
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { data: meData, isLoading: meLoading } = useMe();
  const me = meData?.me;

  const { data: stats, isLoading, isError, error } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/stats");
      return res.json();
    },
    enabled: !!me,
    refetchOnWindowFocus: false,
  });

  // Only fire the users query once stats succeeded — if stats 403’d, users
  // will too, and rendering the same error once is cleaner than twice.
  const { data: usersData, isLoading: usersLoading } = useQuery<AdminUsersPayload>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/users");
      return res.json();
    },
    enabled: !!me && !!stats,
    refetchOnWindowFocus: false,
  });

  const rateSeries = useMemo<Array<number | null>>(
    () => stats?.series.map((p) => p.rate) ?? [],
    [stats],
  );
  const signupsSeries = useMemo(
    () => stats?.series.map((p) => p.signups) ?? [],
    [stats],
  );
  const siftsSeries = useMemo(
    () => stats?.series.map((p) => p.sifts) ?? [],
    [stats],
  );

  const formatRate = (r: number) => `${Math.round(r * 100)}%`;

  // Error shape from apiRequest is "STATUS: body". 403 means the signed-in
  // handle isn't on the allowlist — show a quiet message rather than raw text.
  const errMsg = (error as any)?.message ?? "";
  const isForbidden = /^403/.test(errMsg);
  const isUnauthorized = /^401/.test(errMsg);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 md:px-8 pt-8 md:pt-12 pb-16">
          <div className="mb-10 md:mb-12">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Admin
            </p>
            <h1 className="font-serif text-3xl md:text-4xl mt-2">
              Engagement, quietly
            </h1>
            <p className="text-sm text-muted-foreground mt-3 max-w-lg">
              Three numbers. Seven days. Enough to know whether the work is
              landing.
            </p>
          </div>

          {meLoading || isLoading ? (
            <div className="space-y-6" data-testid="status-loading">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-md bg-foreground/[0.03] animate-pulse"
                />
              ))}
            </div>
          ) : !me ? (
            <div
              className="rounded-md border border-foreground/10 px-5 py-6 text-sm text-muted-foreground"
              data-testid="status-signed-out"
            >
              Sign in with an admin handle to see stats.{" "}
              <Link href="/" className="underline underline-offset-4">
                Back to home
              </Link>
            </div>
          ) : isError && (isForbidden || isUnauthorized) ? (
            <div
              className="rounded-md border border-foreground/10 px-5 py-6 text-sm text-muted-foreground"
              data-testid="status-forbidden"
            >
              This handle isn't on the admin list.{" "}
              <Link href="/" className="underline underline-offset-4">
                Back to home
              </Link>
            </div>
          ) : isError ? (
            <div
              className="rounded-md border border-foreground/10 px-5 py-6 text-sm text-muted-foreground"
              data-testid="status-error"
            >
              Stats didn't load. Try a refresh.
            </div>
          ) : stats ? (
            <div data-testid="admin-stats">
              <StatRow
                label="Total signups"
                value={stats.totals.users.toLocaleString()}
                sub="All-time accounts"
                sparkValues={signupsSeries}
                sparkTestId="spark-signups"
                valueTestId="text-total-signups"
              />
              <StatRow
                label="Total sifts"
                value={stats.totals.sifts.toLocaleString()}
                sub="All-time runs, including anonymous"
                sparkValues={siftsSeries}
                sparkTestId="spark-sifts"
                valueTestId="text-total-sifts"
              />
              <StatRow
                label="Check-in completion"
                value={
                  stats.totals.checkins === 0
                    ? "—"
                    : formatRate(stats.totals.checkinCompletionRate)
                }
                sub={
                  stats.totals.checkins === 0
                    ? "No check-ins yet"
                    : `${stats.totals.didItCheckins.toLocaleString()} of ${stats.totals.checkins.toLocaleString()} marked \u201cDid it\u201d`
                }
                sparkValues={rateSeries}
                sparkTestId="spark-completion"
                valueTestId="text-completion-rate"
              />

              <p className="text-xs text-muted-foreground mt-10">
                Last seven days, UTC. Refresh to update.
              </p>

              <UsersTable users={usersData?.users} loading={usersLoading} />
            </div>
          ) : null}
        </div>
      </main>
      <Footnote />
    </div>
  );
}

// --- Users table ---
// Newest signups first. Small, readable, no feature creep: handle, contact,
// consent, sift count, signup date. Missing contact shows an em dash.
function UsersTable({
  users,
  loading,
}: {
  users: AdminUserRow[] | undefined;
  loading: boolean;
}) {
  const fmtDate = (ms: number) => {
    const d = new Date(ms);
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
      d.getUTCDate(),
    ).padStart(2, "0")}`;
  };

  return (
    <section className="mt-16" data-testid="admin-users-section">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Testers
        </p>
        <h2 className="font-serif text-2xl md:text-3xl mt-2">
          Who signed up
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Newest first. Up to 500.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2" data-testid="status-users-loading">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 rounded-sm bg-foreground/[0.03] animate-pulse"
            />
          ))}
        </div>
      ) : !users || users.length === 0 ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="status-users-empty"
        >
          No signups yet.
        </p>
      ) : (
        <div
          className="overflow-x-auto -mx-6 md:mx-0"
          data-testid="admin-users-table"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/15 text-xs uppercase tracking-widest text-muted-foreground">
                <th className="text-left font-normal py-3 px-6 md:px-0">Handle</th>
                <th className="text-left font-normal py-3 pr-6">Email</th>
                <th className="text-left font-normal py-3 pr-6">Phone</th>
                <th className="text-left font-normal py-3 pr-6">Opt-ins</th>
                <th className="text-right font-normal py-3 pr-6">Sifts</th>
                <th className="text-right font-normal py-3 pr-6 md:pr-0">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-foreground/5 last:border-b-0 align-top"
                  data-testid={`row-user-${u.id}`}
                >
                  <td className="py-3 px-6 md:px-0">
                    <span
                      className="font-medium"
                      data-testid={`text-user-handle-${u.id}`}
                    >
                      @{u.handle}
                    </span>
                  </td>
                  <td className="py-3 pr-6 text-muted-foreground break-all">
                    {u.email ? (
                      <span data-testid={`text-user-email-${u.id}`}>{u.email}</span>
                    ) : (
                      <span className="text-foreground/30">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-6 text-muted-foreground whitespace-nowrap">
                    {u.phone ? (
                      <span data-testid={`text-user-phone-${u.id}`}>{u.phone}</span>
                    ) : (
                      <span className="text-foreground/30">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-6 text-muted-foreground whitespace-nowrap">
                    <ConsentDots
                      updates={u.consentUpdates}
                      reflections={u.consentReflections}
                    />
                  </td>
                  <td
                    className="py-3 pr-6 text-right tabular-nums"
                    data-testid={`text-user-sifts-${u.id}`}
                  >
                    {u.siftCount}
                  </td>
                  <td className="py-3 pr-6 md:pr-0 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                    {fmtDate(u.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// Two small dots — filled when consent is given, hollow when not. Calmer than
// the words "yes/no" and keeps the row height tight.
function ConsentDots({
  updates,
  reflections,
}: {
  updates: boolean;
  reflections: boolean;
}) {
  const dot = (on: boolean, label: string) => (
    <span
      aria-label={`${label}: ${on ? "yes" : "no"}`}
      title={`${label}: ${on ? "yes" : "no"}`}
      className={
        "inline-block w-2 h-2 rounded-full " +
        (on
          ? "bg-foreground/80"
          : "border border-foreground/25 bg-transparent")
      }
    />
  );
  return (
    <span className="inline-flex items-center gap-1.5">
      {dot(updates, "Updates")}
      {dot(reflections, "Reflections")}
    </span>
  );
}
