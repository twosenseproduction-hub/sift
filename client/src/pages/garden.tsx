import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { X } from "lucide-react";
import { Header, Footnote } from "@/components/brand";
import { AppBottomNav } from "@/components/app-bottom-nav";
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

function seedPositions(n: number, w: number, h: number): { x: number; y: number }[] {
  if (n <= 0 || w <= 0) return [];
  const pad = 24;
  const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, n * 1.2))));
  const rows = Math.max(1, Math.ceil(n / cols));
  const rw = cols <= 1 ? 0 : (w - 2 * pad) / (cols - 1);
  const rh = rows <= 1 ? 0 : (h - 2 * pad) / (rows - 1);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const jitterX = Math.sin(i * 2.17 + 1.3) * 10;
    const jitterY = Math.cos(i * 1.83 + 0.7) * 10;
    out.push({
      x: pad + col * rw + jitterX,
      y: pad + row * rh + jitterY,
    });
  }
  return out;
}

type Comet = {
  from: number;
  to: number;
  t: number;
  delay: number;
  speed: number;
  trail: { x: number; y: number; a: number }[];
  dead: boolean;
};

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
  const [hoverSeed, setHoverSeed] = useState<number | null>(null);
  const [hoverSignal, setHoverSignal] = useState<number | null>(null);
  const [litIndices, setLitIndices] = useState<Set<number>>(new Set());
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

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const particleAnimRef = useRef<number | null>(null);
  const cometsRef = useRef<Comet[]>([]);
  const timeRef = useRef(0);

  const seedsFiltered = useMemo(() => {
    if (!data?.seeds) return [];
    if (!selectedMonth) return data.seeds;
    return data.seeds.filter((s) => s.month === selectedMonth);
  }, [data?.seeds, selectedMonth]);

  const seedIndexMap = useMemo(() => {
    if (!data?.seeds) return new Map<string, number>();
    const m = new Map<string, number>();
    data.seeds.forEach((s, i) => m.set(s.id, i));
    return m;
  }, [data?.seeds]);

  const filteredGlobalIndices = useMemo(() => {
    if (!data?.seeds || !selectedMonth) return null;
    const set = new Set<number>();
    data.seeds.forEach((s, i) => {
      if (s.month === selectedMonth) set.add(i);
    });
    return set;
  }, [data?.seeds, selectedMonth]);

  const proseKey = useMemo(() => {
    if (chipHoverSeed != null && data?.seeds[chipHoverSeed]) {
      const s = data.seeds[chipHoverSeed];
      return `seed:${chipHoverSeed}:${s.proseText}:${s.proseSub}`;
    }
    if (hoverSeed != null && data?.seeds[hoverSeed]) {
      const s = data.seeds[hoverSeed];
      return `seed:${hoverSeed}:${s.proseText}:${s.proseSub}`;
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
    hoverSeed,
    hoverSignal,
    selectedMonth,
    data?.prose,
    data?.seeds,
    data?.recurringSignals,
  ]);

  useEffect(() => {
    if (!data?.connections || !data?.seeds) {
      setLitIndices(new Set());
      return;
    }
    const litConnectionsFrom = (idx: number) => {
      const lit = new Set<number>([idx]);
      for (const [a, b] of data.connections!) {
        if (a === idx) lit.add(b);
        if (b === idx) lit.add(a);
      }
      return lit;
    };
    if (chipHoverSeed != null) {
      if (filteredGlobalIndices && !filteredGlobalIndices.has(chipHoverSeed)) {
        setLitIndices(new Set());
        return;
      }
      setLitIndices(litConnectionsFrom(chipHoverSeed));
      return;
    }
    if (hoverSeed != null) {
      if (filteredGlobalIndices && !filteredGlobalIndices.has(hoverSeed)) {
        setLitIndices(new Set());
        return;
      }
      setLitIndices(litConnectionsFrom(hoverSeed));
      return;
    }
    if (hoverSignal != null && data.recurringSignals[hoverSignal]) {
      const rs = data.recurringSignals[hoverSignal];
      const lit = new Set<number>();
      for (const id of rs.threadIds) {
        const gi = seedIndexMap.get(id);
        if (gi != null) lit.add(gi);
      }
      setLitIndices(lit);
      return;
    }
    setLitIndices(new Set());
  }, [
    chipHoverSeed,
    hoverSeed,
    hoverSignal,
    data?.connections,
    data?.seeds,
    data?.recurringSignals,
    seedIndexMap,
    filteredGlobalIndices,
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

  /** Constellation */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !data?.seeds?.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;
    const root = document.documentElement;

    const draw = () => {
      if (!running) return;
      const W = wrap.clientWidth;
      const H = 260;
      const DPR = window.devicePixelRatio || 1;
      canvas.width = Math.floor(W * DPR);
      canvas.height = Math.floor(H * DPR);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      const chart3Str = getComputedStyle(root).getPropertyValue("--chart-3").trim();
      const borderStr = getComputedStyle(root).getPropertyValue("--border").trim();
      const chart2Str = getComputedStyle(root).getPropertyValue("--chart-2").trim();
      const primaryStr = getComputedStyle(root).getPropertyValue("--primary").trim();

      const hslPrimary = (a: number) => `hsl(${primaryStr.replace(/,/g, " ")} / ${a})`;
      const hslGlow = chart3Str
        ? (a: number) => `hsl(${chart3Str.replace(/,/g, " ")} / ${a})`
        : hslPrimary;
      const hslGreen = chart2Str
        ? (a: number) => `hsl(${chart2Str.replace(/,/g, " ")} / ${a})`
        : hslPrimary;
      const hslBorder = (a: number) => `hsl(${borderStr.replace(/,/g, " ")} / ${a})`;

      const n = data.seeds.length;
      const pos = seedPositions(n, W, H);
      timeRef.current += 1 / 60;

      ctx.clearRect(0, 0, W, H);

      const dimSet = filteredGlobalIndices;

      const edgeLit = (ia: number, ib: number) =>
        litIndices.has(ia) && litIndices.has(ib);

      for (const [ia, ib] of data.connections) {
        const ax = pos[ia]?.x ?? 0;
        const ay = pos[ia]?.y ?? 0;
        const bx = pos[ib]?.x ?? 0;
        const by = pos[ib]?.y ?? 0;
        const outA = dimSet && !dimSet.has(ia);
        const outB = dimSet && !dimSet.has(ib);
        let width = 0.55;
        let alpha = 0.09;
        if (outA || outB) {
          width = 0.3;
          alpha = 0.04;
        } else if (edgeLit(ia, ib)) {
          width = 1.3;
          alpha = 0.5;
        }
        ctx.strokeStyle = hslGlow(alpha);
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }

      const comets = cometsRef.current;
      for (const c of comets) {
        if (c.delay > 0) {
          c.delay -= 16;
          continue;
        }
        const ax = pos[c.from]?.x ?? 0;
        const ay = pos[c.from]?.y ?? 0;
        const bx = pos[c.to]?.x ?? 0;
        const by = pos[c.to]?.y ?? 0;
        c.t += c.speed;
        if (c.t >= 1) {
          c.dead = true;
          continue;
        }
        const hx = ax + (bx - ax) * c.t;
        const hy = ay + (by - ay) * c.t;
        const grad = ctx.createRadialGradient(hx, hy, 0, hx, hy, 5);
        grad.addColorStop(0, hslGlow(0.55));
        grad.addColorStop(1, hslGlow(0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(hx, hy, 5, 0, Math.PI * 2);
        ctx.fill();
        c.trail.push({ x: hx, y: hy, a: 0.45 });
        if (c.trail.length > 14) c.trail.shift();
        for (let i = 0; i < c.trail.length; i++) {
          const tr = c.trail[i];
          const fade = (i + 1) / c.trail.length;
          ctx.fillStyle = hslGlow(0.35 * fade * fade);
          ctx.beginPath();
          ctx.arc(tr.x, tr.y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      cometsRef.current = comets.filter((c) => !c.dead);

      for (let i = 0; i < n; i++) {
        const { x, y } = pos[i];
        const seed = data.seeds[i];
        const dimmed = dimSet && !dimSet.has(i);
        const closed = seed.closed;
        const lit = litIndices.has(i);
        const hovered = hoverSeed === i;

        if (closed) {
          ctx.globalAlpha = dimmed ? 0.18 : 1;
          ctx.fillStyle = hslGreen(0.95);
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          continue;
        }

        const phase = i * 1.7;
        const pulse = 0.5 + 0.5 * Math.sin(timeRef.current * ((Math.PI * 2) / 5) + phase);
        const glowR = 14 + pulse * 8;
        const coreR = 4 + pulse * 1;

        ctx.globalAlpha = dimmed ? 0.18 : 1;
        if (!dimmed) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
          g.addColorStop(0, hslGlow(0.35));
          g.addColorStop(1, hslGlow(0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, glowR, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = hslGlow(dimmed ? 0.15 : lit ? 0.95 : 0.75);
        ctx.beginPath();
        ctx.arc(x, y, coreR * (lit ? 1.05 : 1), 0, Math.PI * 2);
        ctx.fill();

        if (hovered && !dimmed) {
          ctx.strokeStyle = hslBorder(0.25);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, coreR + 6, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      animRef.current = requestAnimationFrame(draw);
    };

    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    draw();

    return () => {
      running = false;
      ro.disconnect();
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [data?.seeds, data?.connections, filteredGlobalIndices, litIndices, hoverSeed]);

  const launchComets = (fromIdx: number) => {
    if (!data?.connections) return;
    for (const [a, b] of data.connections) {
      let other = -1;
      if (a === fromIdx) other = b;
      else if (b === fromIdx) other = a;
      else continue;
      cometsRef.current.push({
        from: fromIdx,
        to: other,
        t: 0,
        delay: Math.random() * 200,
        speed: 0.022 + Math.random() * 0.012,
        trail: [],
        dead: false,
      });
    }
  };

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

  const onCanvasPointer = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!data?.seeds?.length || !wrapRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const W = wrapRef.current.clientWidth;
    const pos = seedPositions(data.seeds.length, W, 260);
    let hit: number | null = null;
    for (let i = 0; i < pos.length; i++) {
      if (filteredGlobalIndices && !filteredGlobalIndices.has(i)) continue;
      const dx = mx - pos[i].x;
      const dy = my - pos[i].y;
      if (dx * dx + dy * dy <= 20 * 20) hit = i;
    }
    setHoverSeed(hit);
    if (hit != null) {
      setHoverSignal(null);
      setChipHoverSeed(null);
    }
  };

  const endHover = () => {
    setHoverSeed(null);
  };

  const pickSeedAtClient = (clientX: number, clientY: number) => {
    if (!data?.seeds?.length || !wrapRef.current || !canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const W = wrapRef.current.clientWidth;
    const pos = seedPositions(data.seeds.length, W, 260);
    for (let i = 0; i < pos.length; i++) {
      if (filteredGlobalIndices && !filteredGlobalIndices.has(i)) continue;
      const dx = mx - pos[i].x;
      const dy = my - pos[i].y;
      if (dx * dx + dy * dy <= 20 * 20) return i;
    }
    return null;
  };

  if (!me) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <div className="mx-auto max-w-xl px-6 pt-20 pb-28 text-center">
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
        <AppBottomNav />
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
        <div className="mx-auto max-w-2xl px-6 md:px-8 pt-8 md:pt-12 pb-28">
          <div className="mb-6">
            <p className="text-[11px] tracking-[0.25em] uppercase text-primary/80 font-medium mb-1">
              Sift · Garden
            </p>
          </div>

          {isLoading && (
            <div className="space-y-4">
              <div className="h-24 rounded-xl bg-muted/40 animate-pulse" />
              <div className="h-[260px] rounded-xl bg-muted/30 animate-pulse" />
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
                    ) : hoverSeed != null && data.seeds[hoverSeed] ? (
                      <>
                        <p>{data.seeds[hoverSeed].proseText}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {data.seeds[hoverSeed].proseSub}
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

              <section className="mb-6">
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

              <section ref={wrapRef} className="mb-10 w-full">
                <canvas
                  ref={canvasRef}
                  className="w-full cursor-crosshair touch-none rounded-xl border border-border/40 bg-card/30"
                  height={260}
                  onMouseMove={onCanvasPointer}
                  onMouseLeave={endHover}
                  onClick={(e) => {
                    const hit = pickSeedAtClient(e.clientX, e.clientY);
                    if (hit != null) {
                      launchComets(hit);
                      openPanelFromSeed(hit);
                    }
                  }}
                  onTouchEnd={(e) => {
                    const t = e.changedTouches[0];
                    if (!t) return;
                    const hit = pickSeedAtClient(t.clientX, t.clientY);
                    if (hit != null) {
                      launchComets(hit);
                      openPanelFromSeed(hit);
                    }
                  }}
                />
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
                        setHoverSeed(null);
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
      <AppBottomNav />

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
