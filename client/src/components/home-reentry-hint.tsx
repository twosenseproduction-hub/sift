import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { ReEntryResponse } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { SiftBaseVisualMode } from "@/components/onboarding/sift-onboarding-flow";

/** Quiet return-path hint for signed-in users on Home — uses GET /api/reentry. */
export function HomeReEntryHint({
  enabled,
  mode = "dark",
  className,
}: {
  enabled: boolean;
  mode?: SiftBaseVisualMode;
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

  const href =
    data.action.type === "compare"
      ? `/s/${encodeURIComponent(data.action.currentSiftId)}`
      : `/s/${encodeURIComponent(data.action.threadId)}`;

  const label =
    data.action.type === "checkin"
      ? "Check in"
      : data.action.type === "compare"
        ? "Open sift"
        : "Pick it up";

  const dark = mode === "dark";

  return (
    <div
      className={cn(
        "pointer-events-auto mx-auto w-full max-w-[640px] rounded-xl border px-4 py-3 shadow-[0_18px_44px_-34px_rgba(0,0,0,0.45)] backdrop-blur-md sm:px-5",
        dark
          ? "border-[rgba(120,200,110,0.16)] bg-black/12"
          : "border-[#556b57]/16 bg-[#faf7f0]/72",
        className,
      )}
      data-testid="home-reentry-hint"
    >
      <p
        className={cn(
          "font-serif text-[14px] leading-snug italic",
          dark ? "text-[rgba(201,235,194,0.62)]" : "text-[#6e685d]",
        )}
      >
        {data.prompt}
      </p>
      <div className="mt-2 flex items-center gap-4">
        <Link href={href}>
          <a
            className={cn(
              "font-serif text-[13px] underline-offset-4 hover:underline",
              dark ? "text-[rgba(218,244,213,0.88)]" : "text-[#556b57]",
            )}
          >
            {label}
          </a>
        </Link>
        <Link href="/library">
          <a
            className={cn(
              "font-serif text-[12px] underline-offset-4 hover:underline",
              dark ? "text-[rgba(201,235,194,0.48)]" : "text-[#6e685d]",
            )}
          >
            Library
          </a>
        </Link>
      </div>
    </div>
  );
}
