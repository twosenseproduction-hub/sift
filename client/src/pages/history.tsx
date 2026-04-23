import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header, Footnote } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Search, ArrowRight } from "lucide-react";
import { AuthDialog } from "@/components/auth-dialog";
import { useMe } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { SiftListItem, SiftStatus } from "@shared/schema";

type StatusFilter = "all" | "open" | "closed";

export default function HistoryPage() {
  const [, navigate] = useLocation();
  const { data: meData, isLoading: meLoading } = useMe();
  const me = meData?.me;
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { toast } = useToast();

  // debounce search
  useMemo(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);

  const listKey = debouncedQ
    ? ["/api/sifts", { q: debouncedQ }]
    : ["/api/sifts"];

  const { data, isLoading, isError } = useQuery<{ sifts: SiftListItem[] }>({
    queryKey: listKey,
    queryFn: async () => {
      const url = debouncedQ
        ? `/api/sifts?q=${encodeURIComponent(debouncedQ)}`
        : "/api/sifts";
      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: !!me,
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sift/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sifts"] });
      toast({ title: "Removed from your thread" });
    },
    onError: () => {
      toast({ title: "Couldn't remove that one", description: "Try again." });
    },
  });

  const setStatus = useMutation({
    mutationFn: async (vars: { id: string; status: SiftStatus }) => {
      await apiRequest("PATCH", `/api/sift/${vars.id}/status`, {
        status: vars.status,
      });
      return vars;
    },
    onSuccess: (vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sifts"] });
      toast({
        title: vars.status === "closed" ? "Marked closed" : "Reopened",
      });
    },
    onError: () => {
      toast({ title: "Couldn't update that one", description: "Try again." });
    },
  });

  // Not signed in → gentle gate
  if (!meLoading && !me) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <div className="mx-auto max-w-xl px-6 md:px-8 pt-20 pb-16 text-center">
            <p className="text-[11px] tracking-[0.25em] uppercase text-primary/80 font-medium mb-4">
              Your thread
            </p>
            <h1 className="font-serif text-4xl md:text-5xl leading-tight mb-5">
              Sign in to see your past sifts.
            </h1>
            <p className="text-muted-foreground mb-8">
              A handle and passphrase is all it takes. No email, no verification.
            </p>
            <SignInButton />
          </div>
        </main>
        <Footnote />
      </div>
    );
  }

  const allSifts = data?.sifts ?? [];
  const sifts = allSifts.filter((s) => {
    if (statusFilter === "all") return true;
    return s.status === statusFilter;
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 md:px-8 pt-8 md:pt-12 pb-16">
          <div className="mb-8 md:mb-10">
            <p className="text-[11px] tracking-[0.25em] uppercase text-primary/80 font-medium mb-2">
              Your thread
            </p>
            <h1 className="font-serif text-3xl md:text-4xl leading-tight">
              Everything you've sifted
            </h1>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              data-testid="input-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search your sifts…"
              className="pl-10 h-11 bg-card border-card-border"
            />
          </div>

          {/* Status filter — quiet text row */}
          <div className="mb-8 flex items-center gap-5 text-sm">
            {(["all", "open", "closed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                data-testid={`filter-${f}`}
                className={cn(
                  "transition-colors",
                  statusFilter === f
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f === "all" ? "All" : f === "open" ? "Open" : "Closed"}
              </button>
            ))}
          </div>

          {isLoading && <ListSkeleton />}

          {isError && (
            <p className="text-muted-foreground">Couldn't load your thread. Try refreshing.</p>
          )}

          {!isLoading && sifts.length === 0 && (
            <div className="text-center py-12">
              {debouncedQ ? (
                <p className="text-muted-foreground" data-testid="text-empty-search">
                  Nothing matches "{debouncedQ}".
                </p>
              ) : statusFilter !== "all" && allSifts.length > 0 ? (
                <p className="text-muted-foreground" data-testid="text-empty-filter">
                  Nothing {statusFilter} right now.
                </p>
              ) : (
                <>
                  <p className="font-serif text-xl mb-3">Nothing here yet.</p>
                  <p className="text-muted-foreground mb-6">
                    The first sift you do while signed in will land here.
                  </p>
                  <Link href="/">
                    <a>
                      <Button className="gap-2" data-testid="button-start-sifting">
                        Start sifting <ArrowRight className="w-4 h-4" />
                      </Button>
                    </a>
                  </Link>
                </>
              )}
            </div>
          )}

          {sifts.length > 0 && (
            <ul className="divide-y divide-border/70 border-y border-border/70">
              {sifts.map((s) => (
                <li
                  key={s.id}
                  className="group relative py-5 md:py-6 flex gap-4 md:gap-6 hover-elevate rounded-sm -mx-2 px-2 md:-mx-4 md:px-4"
                  data-testid={`history-item-${s.id}`}
                >
                  <button
                    onClick={() => navigate(`/s/${s.id}`)}
                    className="flex-1 text-left min-w-0"
                    data-testid={`link-sift-${s.id}`}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <StatusDot status={s.status} />
                      <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
                        {formatDate(s.createdAt)}
                      </span>
                    </div>
                    <h3
                      className={cn(
                        "font-serif text-lg md:text-xl leading-snug mb-1.5",
                        s.status === "closed"
                          ? "text-muted-foreground"
                          : "text-foreground",
                      )}
                    >
                      {s.coreIntent}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      Next: {s.nextStep}
                    </p>
                  </button>
                  <div className="flex items-start gap-1 self-start mt-1">
                    <button
                      onClick={() =>
                        setStatus.mutate({
                          id: s.id,
                          status: s.status === "closed" ? "open" : "closed",
                        })
                      }
                      disabled={setStatus.isPending}
                      data-testid={`button-toggle-status-${s.id}`}
                      className="px-2 py-1 rounded-md text-xs text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity whitespace-nowrap"
                    >
                      {s.status === "closed" ? "Reopen" : "Mark closed"}
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          aria-label="Delete sift"
                          data-testid={`button-delete-${s.id}`}
                          className="p-2 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-serif text-xl">
                            Remove this sift?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            It will be gone from your thread. Anyone holding the share link won't be able to open it either.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep it</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => del.mutate(s.id)}
                            data-testid={`confirm-delete-${s.id}`}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <Footnote />
    </div>
  );
}

function StatusDot({ status }: { status: SiftStatus }) {
  return (
    <span
      aria-label={status === "closed" ? "Closed" : "Open"}
      title={status === "closed" ? "Closed" : "Open"}
      data-testid={`status-dot-${status}`}
      className={cn(
        "inline-block w-1.5 h-1.5 rounded-full shrink-0",
        status === "closed" ? "bg-muted-foreground/35" : "bg-primary/70",
      )}
    />
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-border/70 border-y border-border/70">
      {[0, 1, 2].map((i) => (
        <div key={i} className="py-5 md:py-6 space-y-2">
          <div className="h-3 w-24 bg-muted/70 rounded animate-pulse" />
          <div className="h-6 w-3/4 bg-muted/70 rounded animate-pulse" />
          <div className="h-3 w-1/2 bg-muted/60 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function SignInButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} data-testid="button-signin-gate">
        Sign in or create a thread
      </Button>
      <AuthDialog open={open} onOpenChange={setOpen} initialMode="signup" />
    </>
  );
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
