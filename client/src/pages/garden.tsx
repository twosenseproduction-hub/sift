import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { X } from "lucide-react";
import { Header, Footnote } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/auth-dialog";
import { apiRequest } from "@/lib/queryClient";
import { useMe } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { triggerMetaSift } from "@/lib/metaSift";
import type { SiftResult } from "@shared/schema";

type GardenPayload = {
  prose: { default: string; byMonth: Record<string, string> };
  stats: { totalThreads: number; closedThreads: number; coreSignal: string | null };
  recurringSignals: {
    theme: string;
    frequency: number;
    threadIds: string[];
    threadTitles: string[];
  }[];
  clusterMap: { label: string; count: number; type: "signal" | "noise" }[];
  closedLoops: {
    id: string;
    title: string;
    closedAt: string;
    checkinCount: number;
    finalLesson: string | null;
  }[];
  seeds: {
    id: string;
    title: string;
    closed: boolean;
    month: string;
    signal: string | null;
    matters: string | null;
    nextStep: string | null;
    proseText: string;
    proseSub: string;
  }[];
  connections: number[][];
  months: {
    key: string;
    label: string;
    count: number;
    closedCount: number;
    summary: string;
  }[];
};

function signalProseLine(sigIndex: number, count: number, theme: string): string {
  if (sigIndex === 0) {
    return `${count} threads share the same pull — ${theme}. This is the one to sit with.`;
  }
  if (sigIndex === 1) {
    return `${count} threads ask the same question: ${theme}. You already know the answer.`;
  }
  return `${count} threads.\n${theme}.`;
}

type SignalThread = {
  globalIdx: number;
  title: string;
  closed: boolean;
  month: string;
};

/**
 * Inline micro-constellation for a single recurring signal.
 * Each dot maps 1:1 with the chip below it (same index, same order).
 */
function SignalConstellation({
  threads,
  selectedMonth,
  activeSeedIdx,
  cardHovered,
  onHoverSeed,
  onTapSeed,
}: {
  threads: SignalThread[];
  selectedMonth: string | null;
  activeSeedIdx: number | null;
  cardHovered: boolean;
  onHoverSeed: (globalIdx: number | null) => void;
  onTapSeed: (globalIdx: number) => void;
}) {
  if (threads.length === 0) return null;
  return (
    <div className="relative mb-3 h-6">
      <div
        className={cn(
          "pointer-events-none absolute left-3 right-3 top-1/2 h-px -translate-y-1/2 transition-opacity duration-300",
          cardHovered ? "bg-primary/35" : "bg-primary/15",
        )}
      />
      <div className="relative flex h-full items-center justify-between">
        {threads.map((t) => {
          const dim = selectedMonth != null && t.month !== selectedMonth;
          const lit = activeSeedIdx === t.globalIdx;
          return (
            <button
              key={t.globalIdx}
              type="button"
              aria-label={t.title}
              title={t.title}
              className="relative grid h-6 w-6 place-items-center rounded-full"
              onMouseEnter={() => onHoverSeed(t.globalIdx)}
              onMouseLeave={() => onHoverSeed(null)}
              onFocus={() => onHoverSeed(t.globalIdx)}
              onBlur={() => onHoverSeed(null)}
              onClick={() => onTapSeed(t.globalIdx)}
            >
              <span
                className={cn(
                  "block rounded-full transition-all duration-300",
                  t.closed
                    ? "h-2 w-2 bg-primary"
                    : "h-2.5 w-2.5 bg-chart-3 ring-1 ring-chart-3/30",
                  dim && "opacity-25",
                  lit && !dim && t.closed && "scale-110 ring-2 ring-primary/60",
                  lit && !dim && !t.closed && "scale-110 ring-2 ring-chart-3/60",
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function GardenPage() {
  const { data: meData } = useMe();
  const me = meData?.me;
  const [authOpen, setAuthOpen] = useState(false);

  const { data, isLoading, isError } = useQuery<GardenPayload>({
    queryKey: ["/api/garden"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/garden");
      return res.json();
    },
    enabled: !!me,
  });

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [hoverSignal, setHoverSignal] = useState<number | null>(null);
  const [chipHoverSeed, setChipHoverSeed] = useState<number | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelKind, setPanelKind] = useState<"open" | "closed">("open");
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelThread, setPanelThread] = useState<{
    id: string;
    title: string;
    matters: string | null;
    nextStep: string | null;
    closed: boolean;
  } | null>(null);

  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particleAnimRef = useRef<number | null>(null);

  const seedIndexMap = useMemo(() => {
    if (!data?.seeds) return new Map<string, number>();
    const m = new Map<string, number>();
    data.seeds.forEach((s, i) => m.set(s.id, i));
    return m;
  }, [data?.seeds]);

  const proseKey = useMemo(() => {
    if (chipHoverSeed != null && data?.seeds[chipHoverSeed]) {
      const s = data.seeds[chipHoverSeed];
      return `seed:${chipHoverSeed}:${s.proseText}:${s.proseSub}`;
    }
    if (hoverSignal != null && data?.recurringSignals[hoverSignal]) {
      const rs = data.recurringSignals[hoverSignal];
      return `sig:${hoverSignal}:${signalProseLine(hoverSignal, rs.frequency, rs.theme)}`;
    }
    if (selectedMonth && data?.prose.byMonth[selectedMonth]) {
      return `month:${selectedMonth}:${data.prose.byMonth[selectedMonth]}`;
    }
    return `default:${data?.prose.default ?? ""}`;
  }, [
    chipHoverSeed,
    hoverSignal,
    selectedMonth,
    data?.prose,
    data?.seeds,
    data?.recurringSignals,
  ]);

  /** Particle layer */
  useEffect(() => {
    const canvas = particleCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;
    const DPR = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    type P = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      baseA: number;
      ph: number;
    };
    const parts: P[] = [];
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * DPR);
      canvas.height = Math.floor(window.innerHeight * DPR);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    for (let i = 0; i < 28; i++) {
      parts.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -(0.025 + Math.random() * 0.105),
        r: 0.15 + Math.random() * 0.85,
        baseA: 0.03 + Math.random() * 0.15,
        ph: Math.random() * Math.PI * 2,
      });
    }

    let t0 = performance.now();
    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min(32, now - t0);
      t0 = now;
      const chart3 = getComputedStyle(document.documentElement).getPropertyValue("--chart-3").trim();
      const primary = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
      const fillTriplet = chart3 || primary;
      const fill = `hsl(${fillTriplet.replace(/,/g, " ")} / `;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const wave = Math.sin(now / 9000);
      for (const p of parts) {
        p.x += p.vx * (dt / 16);
        p.y += p.vy * (dt / 16);
        p.x += Math.sin(now / 4000 + p.ph) * 0.08 * (dt / 16);
        if (p.y < -4) {
          p.y = window.innerHeight + 4;
          p.x = Math.random() * window.innerWidth;
        }
        if (p.x < -4) p.x = window.innerWidth + 4;
        if (p.x > window.innerWidth + 4) p.x = -4;
        const pulse = 0.65 + 0.35 * Math.sin(now / 2100 + p.ph);
        const a = p.baseA * pulse * (0.85 + 0.15 * wave);
        ctx.fillStyle = `${fill}${Math.min(0.22, a)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      particleAnimRef.current = requestAnimationFrame(loop);
    };
    particleAnimRef.current = requestAnimationFrame(loop);
    window.addEventListener("resize", resize);

    return () => {
      running = false;
      window.removeEventListener("resize", resize);
      if (particleAnimRef.current) cancelAnimationFrame(particleAnimRef.current);
    };
  }, []);

  const openPanelFromSeed = (idx: number) => {
    if (!data?.seeds[idx]) return;
    const s = data.seeds[idx];
    setPanelKind(s.closed ? "closed" : "open");
    setPanelThread({
      id: s.id,
      title: s.title,
      matters: s.matters,
      nextStep: s.nextStep,
      closed: s.closed,
    });
    setPanelOpen(true);
  };

  const fetchAndOpenClosedLoop = async (id: string) => {
    setPanelLoading(true);
    setPanelOpen(true);
    setPanelKind("closed");
    try {
      const res = await apiRequest("GET", `/api/sift/${encodeURIComponent(id)}`);
      const r = (await res.json()) as SiftResult;
      const matters = r.matters?.[0] ?? null;
      setPanelThread({
        id: r.id,
        title: r.coreIntent,
        matters,
        nextStep: r.nextStep,
        closed: true,
      });
    } catch {
      setPanelThread(null);
    } finally {
      setPanelLoading(false);
    }
  };

  if (!me) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <div className="mx-auto max-w-xl px-6 pt-20 pb-16 text-center">
            <p className="text-[11px] tracking-[0.25em] uppercase text-primary/80 font-medium mb-4">
              Garden
            </p>
            <h1 className="font-serif text-4xl md:text-5xl leading-tight mb-5">
              Sign in to open your garden.
            </h1>
            <p className="text-muted-foreground mb-8">
              Your patterns and closed loops stay with your account.
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
    <div className="relative min-h-screen flex flex-col">
      <canvas
        ref={particleCanvasRef}
        className="pointer-events-none fixed inset-0 z-0 h-full w-full"
        aria-hidden
      />

      <Header />

      <main className="relative z-10 flex-1">
        <div className="mx-auto max-w-2xl px-6 md:px-8 pt-8 md:pt-12 pb-16">
          <div className="mb-6">
            <p className="text-[11px] tracking-[0.25em] uppercase text-primary/80 font-medium mb-1">
              Sift · Garden
            </p>
          </div>

          {isLoading && (
            <div className="space-y-4">
              <div className="h-24 rounded-xl bg-muted/40 animate-pulse" />
              <div className="h-32 rounded-xl bg-muted/30 animate-pulse" />
            </div>
          )}

          {isError && (
            <p className="text-sm text-muted-foreground">Couldn&apos;t load the garden. Try again.</p>
          )}

          {data && (
            <>
              <section className="relative mb-8 min-h-[120px]">
                <div className="relative min-h-[120px]">
                  <div
                    key={proseKey}
                    className="fade-in-slow absolute inset-0 whitespace-pre-line text-base md:text-[17px] text-foreground leading-relaxed"
                    style={{
                      animationDuration: "650ms",
                      animationTimingFunction: "ease-out",
                    }}
                  >
                    {chipHoverSeed != null && data.seeds[chipHoverSeed] ? (
                      <>
                        <p>{data.seeds[chipHoverSeed].proseText}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {data.seeds[chipHoverSeed].proseSub}
                        </p>
                      </>
                    ) : hoverSignal != null && data.recurringSignals[hoverSignal] ? (
                      signalProseLine(
                        hoverSignal,
                        data.recurringSignals[hoverSignal].frequency,
                        data.recurringSignals[hoverSignal].theme,
                      )
                    ) : selectedMonth && data.prose.byMonth[selectedMonth] ? (
                      data.prose.byMonth[selectedMonth]
                    ) : (
                      data.prose.default
                    )}
                  </div>
                </div>
              </section>

              <section className="mb-8">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMonth(null)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-colors",
                      selectedMonth === null
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    All time
                    <span className="ml-1.5 text-muted-foreground/60">{data.stats.totalThreads}</span>
                  </button>
                  {data.months.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setSelectedMonth(m.key)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs transition-colors",
                        selectedMonth === m.key
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {m.label}
                      <span className="ml-1.5 text-muted-foreground/60">{m.count}</span>
                    </button>
                  ))}
                </div>
                {selectedMonth && (
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                    {data.months.find((x) => x.key === selectedMonth)?.summary}
                  </p>
                )}
              </section>

              <section className="mb-12 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="h-px w-6 bg-primary/40" />
                  <span className="text-[11px] tracking-[0.2em] uppercase font-medium text-primary/80">
                    Recurring signals
                  </span>
                </div>
                {data.recurringSignals.map((rs, sigIdx) => {
                  const monthIdsInFilter =
                    selectedMonth &&
                    data.seeds.filter((s) => s.month === selectedMonth).map((s) => s.id);
                  const dim =
                    selectedMonth &&
                    monthIdsInFilter &&
                    !rs.threadIds.some((id) => monthIdsInFilter.includes(id));
                  const signalThreads: SignalThread[] = rs.threadIds
                    .map((id, ti) => {
                      const gi = seedIndexMap.get(id);
                      const s = gi != null ? data.seeds[gi] : null;
                      return {
                        globalIdx: gi ?? -1,
                        title: rs.threadTitles[ti] ?? s?.title ?? "Thread",
                        closed: s?.closed ?? false,
                        month: s?.month ?? "",
                      };
                    })
                    .filter((t) => t.globalIdx >= 0);
                  return (
                    <article
                      key={`${rs.theme}-${sigIdx}`}
                      className={cn(
                        "rounded-2xl border border-border/60 bg-card/50 p-5 md:p-6 transition-all",
                        dim ? "opacity-[0.28] scale-[0.99] pointer-events-none" : "",
                        hoverSignal === sigIdx &&
                          "border-primary/40 shadow-md shadow-primary/10",
                      )}
                      onMouseEnter={() => {
                        setHoverSignal(sigIdx);
                        setChipHoverSeed(null);
                      }}
                      onMouseLeave={() => setHoverSignal(null)}
                    >
                      <p className="text-xs text-muted-foreground mb-2">
                        Appears in {rs.frequency} threads
                      </p>
                      <p className="font-serif text-lg md:text-xl text-foreground italic leading-snug mb-4">
                        {rs.theme}
                      </p>
                      <SignalConstellation
                        threads={signalThreads}
                        selectedMonth={selectedMonth}
                        activeSeedIdx={chipHoverSeed}
                        cardHovered={hoverSignal === sigIdx}
                        onHoverSeed={(gi) => setChipHoverSeed(gi)}
                        onTapSeed={(gi) => openPanelFromSeed(gi)}
                      />
                      <div className="flex flex-wrap gap-2 mb-4">
                        {rs.threadTitles.map((t, ti) => (
                          <button
                            key={`${t}-${ti}`}
                            type="button"
                            className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                            onMouseEnter={() => {
                              const id = rs.threadIds[ti];
                              const gi = seedIndexMap.get(id);
                              if (gi != null) setChipHoverSeed(gi);
                            }}
                            onMouseLeave={() => setChipHoverSeed(null)}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="text-sm text-foreground/85 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                        onClick={() => triggerMetaSift(rs.theme, rs.threadIds)}
                      >
                        Sift this pattern →
                      </button>
                    </article>
                  );
                })}
              </section>

              <section className="mb-12 border-t border-border/50 pt-10">
                <div className="flex items-center gap-3 mb-6">
                  <span className="h-px w-6 bg-primary/40" />
                  <span className="text-[11px] tracking-[0.2em] uppercase font-medium text-primary/80">
                    Closed loops
                  </span>
                </div>
                <ul className="space-y-3">
                  {data.closedLoops.map((cl) => {
                    const dim =
                      selectedMonth &&
                      data.seeds.find((s) => s.id === cl.id)?.month !== selectedMonth;
                    const days = Math.floor(
                      (Date.now() - new Date(cl.closedAt).getTime()) / 86400000,
                    );
                    return (
                      <li key={cl.id}>
                        <button
                          type="button"
                          className={cn(
                            "w-full text-left rounded-xl border border-border/60 bg-card/40 px-4 py-4 transition-colors hover:bg-card/70",
                            dim ? "opacity-20 pointer-events-none" : "",
                          )}
                          onClick={() => void fetchAndOpenClosedLoop(cl.id)}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-primary shadow-md shadow-primary/15"
                              aria-hidden
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground leading-snug mb-1">
                                {cl.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Closed {days} days ago · {cl.checkinCount} check-ins
                              </p>
                              {cl.finalLesson ? (
                                <p className="mt-2 text-sm italic text-primary leading-relaxed">
                                  {cl.finalLesson}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="border-t border-border/60 pt-8">
                <blockquote className="border-l border-border pl-[18px]">
                  <p className="text-base md:text-[17px] text-muted-foreground italic leading-relaxed">
                    &ldquo;The goal is not more clarity. It is needing less of it.&rdquo;
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Sift — when you&apos;re ready to close this
                  </p>
                </blockquote>
              </section>
            </>
          )}
        </div>
      </main>

      <Footnote />

      {panelOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[45] bg-black/55 backdrop-blur-sm"
            aria-label="Close panel"
            onClick={() => setPanelOpen(false)}
          />
          <div
            className="fixed inset-x-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-2xl border border-border/60 bg-card px-6 pb-10 pt-4 shadow-lg md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2"
            style={{
              bottom: 0,
              transform: panelOpen ? "translateY(0)" : "translateY(100%)",
              transition: "transform 520ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <div className="mx-auto mb-6 h-1 w-9 rounded-full bg-border" />
            <p className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground mb-2">
              {panelKind === "closed" ? "Closed loop" : "Open thread"}
            </p>
            {panelLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : panelThread ? (
              <>
                <h2 className="font-serif text-2xl md:text-3xl leading-snug text-foreground mb-6">
                  {panelThread.title}
                </h2>
                <p className="text-[11px] tracking-[0.2em] uppercase font-medium text-primary/80 mb-2">
                  What mattered
                </p>
                <p className="text-base md:text-[17px] text-muted-foreground italic leading-relaxed mb-8">
                  {panelThread.matters ?? "—"}
                </p>
                <p className="text-[11px] tracking-[0.2em] uppercase font-medium text-primary/80 mb-2">
                  One next step
                </p>
                <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5 md:p-6 mb-8">
                  <p className="font-serif text-xl md:text-2xl leading-snug text-foreground">
                    {panelThread.nextStep ?? "—"}
                  </p>
                </div>
                {!panelThread.closed ? (
                  <div className="flex flex-wrap gap-3">
                    <Link href={`/s/${panelThread.id}`}>
                      <a>
                        <Button type="button" className="gap-2">
                          Check in
                        </Button>
                      </a>
                    </Link>
                    <Button variant="outline" type="button" onClick={() => setPanelOpen(false)}>
                      Let this rest
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Couldn&apos;t load this thread.</p>
            )}
            <button
              type="button"
              className="absolute right-4 top-4 rounded-md p-2 text-muted-foreground hover:text-foreground"
              aria-label="Close"
              onClick={() => setPanelOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode="signup" />
    </div>
  );
}
