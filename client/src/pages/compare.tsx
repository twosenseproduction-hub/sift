import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Header, Footnote } from "@/components/brand";
import { apiRequest } from "@/lib/queryClient";
import type { SiftResult } from "@shared/schema";
import { Thinking } from "@/components/sift-ui";

function parseCompareSearch(hash: string): {
  current: string;
  prior: string;
} | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const q = raw.indexOf("?");
  const search = q >= 0 ? raw.slice(q + 1) : "";
  const sp = new URLSearchParams(search);
  const current = sp.get("current")?.trim() ?? "";
  const prior = sp.get("prior")?.trim() ?? "";
  if (!current || !prior) return null;
  return { current, prior };
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="h-px w-6 bg-primary/40" />
      <span className="text-[11px] tracking-[0.2em] uppercase font-medium text-primary/80">
        {children}
      </span>
    </div>
  );
}

export default function ComparePage() {
  const [ids, setIds] = useState<{
    current: string;
    prior: string;
  } | null>(() =>
    typeof window !== "undefined"
      ? parseCompareSearch(window.location.hash || "")
      : null,
  );

  useEffect(() => {
    const sync = () =>
      setIds(parseCompareSearch(window.location.hash || ""));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const currentId = ids?.current ?? "";
  const priorId = ids?.prior ?? "";

  const { data: current, isLoading: loadingCur } = useQuery<SiftResult>({
    queryKey: ["/api/sift", currentId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sift/${encodeURIComponent(currentId)}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!currentId,
  });

  const { data: prior, isLoading: loadingPri } = useQuery<SiftResult>({
    queryKey: ["/api/sift", priorId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sift/${encodeURIComponent(priorId)}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!priorId,
  });

  const loading = loadingCur || loadingPri;

  if (!ids) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-6">
          <p className="text-muted-foreground text-center">
            Nothing to compare. Start from home or a re-entry prompt.
          </p>
        </main>
        <Footnote />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 md:px-8 pt-8 md:pt-12 pb-16 space-y-10">
          <Link href="/">
            <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Home
            </a>
          </Link>

          {loading ? (
            <Thinking />
          ) : current && prior && current.mine && prior.mine ? (
            <>
              <div className="space-y-8 md:space-y-10">
                <section data-testid="compare-prior">
                  <SectionLabel>What you found before</SectionLabel>
                  <div className="rounded-2xl border border-border/60 bg-card/40 px-5 py-5 md:px-6 md:py-6 mt-3">
                    <p className="font-serif text-xl md:text-2xl leading-snug text-foreground">
                      {prior.nextStep}
                    </p>
                  </div>
                </section>

                <section data-testid="compare-current">
                  <SectionLabel>What came up now</SectionLabel>
                  <div className="rounded-2xl border border-primary/25 bg-primary/5 px-5 py-5 md:px-6 md:py-6 mt-3">
                    <p className="font-serif text-xl md:text-2xl leading-snug text-foreground">
                      {current.nextStep}
                    </p>
                  </div>
                </section>
              </div>

              <p className="text-sm text-muted-foreground/85 leading-relaxed pt-2">
                Same signal, or has something shifted?
              </p>

              <div className="flex flex-wrap gap-x-6 gap-y-3 pt-2">
                <Link href="/">
                  <a
                    data-testid="compare-same-signal"
                    className="text-sm text-foreground/85 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                  >
                    Same signal — let this rest
                  </a>
                </Link>
                <Link href={`/s/${encodeURIComponent(current.id)}`}>
                  <a
                    data-testid="compare-shifted"
                    className="text-sm text-foreground/85 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                  >
                    Something shifted — open this thread
                  </a>
                </Link>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              These threads are not available to compare right now.
            </p>
          )}
        </div>
      </main>
      <Footnote />
    </div>
  );
}
