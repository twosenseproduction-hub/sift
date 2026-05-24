import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { ReEntryResponse } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { reentryPrimaryHref, reentryPrimaryLabel } from "@/lib/reentry-navigation";
import { cn } from "@/lib/utils";

/** Quiet return-path hint for signed-in users on Home — uses GET /api/reentry. */
export function HomeReEntryHint({
  enabled,
  className,
}: {
  enabled: boolean;
  className?: string;
}) {
  const { data } = useQuery<ReEntryResponse>({
    queryKey: ["/api/reentry"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/reentry");
      return res.json();
    },
    enabled,
    staleTime: 60_000,
  });

  if (!enabled || !data?.prompt || !data.action) return null;

  const href = reentryPrimaryHref(data.action);
  const label = reentryPrimaryLabel(data.action);

  return (
    <div
      className={cn("v3-reentry-hint pointer-events-auto w-full max-w-[640px]", className)}
      data-testid="home-reentry-hint"
    >
      <p className="v3-reentry-hint-text">{data.prompt}</p>
      <div className="v3-reentry-hint-actions">
        <Link href={href}>
          <a className="v3-reentry-hint-link v3-reentry-hint-link--primary">{label}</a>
        </Link>
        <Link href="/library">
          <a className="v3-reentry-hint-link">Library</a>
        </Link>
        <Link href="/sift">
          <a className="v3-reentry-hint-link">New entry</a>
        </Link>
      </div>
    </div>
  );
}
