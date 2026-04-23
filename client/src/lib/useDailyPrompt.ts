import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type DailyPromptResponse = {
  prompt: {
    id: number;
    text: string;
    type: string;
    outputLength: "SHORT" | "MEDIUM" | "LONG";
    requiresPriorSift: boolean;
    hasChoiceLogic: boolean;
    usageNotes: string | null;
  };
  theme: { num: number; name: string };
  themeCycleDay: number;
  hasPriorSift: boolean;
  appliedFilters: string[];
};

/**
 * Hook for the personalized daily prompt.
 *
 * Passes the caller's local hour (0–23) so the server can bias toward
 * morning/evening-appropriate prompt types. Refetches across UTC midnight
 * and whenever the tab becomes visible (in case you leave it open across
 * a day boundary).
 */
export function useDailyPrompt() {
  const localHour = new Date().getHours();
  return useQuery<DailyPromptResponse>({
    queryKey: ["/api/daily-prompt", localHour],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/daily-prompt?hour=${localHour}`,
      );
      return res.json();
    },
    // Cache for the rest of the day; selection is deterministic for the day
    // so no reason to refetch on every focus.
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
