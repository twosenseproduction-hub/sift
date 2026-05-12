import type { SiftListItem, ThreadDetail } from "@shared/schema";
import { apiRequest, queryClient } from "./queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";

// GET /api/threads — same compact row shape as /api/sifts (SiftListItem).
export function useThreads(options?: { enabled?: boolean }) {
  return useQuery<SiftListItem[]>({
    queryKey: ["/api/threads"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/threads");
      return (await res.json()).threads;
    },
    enabled:
      options?.enabled === false ? false : (options?.enabled ?? true),
  });
}

// GET /api/threads/:id — body is { thread }; unwrap so callers use `data.field`.
export function useThread(id: string) {
  return useQuery<ThreadDetail | undefined>({
    queryKey: ["/api/threads", id],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/threads/${encodeURIComponent(id)}`,
      );
      const data = (await res.json()) as { thread?: ThreadDetail };
      return data.thread;
    },
    enabled: !!id,
  });
}

type PatchThreadVars = {
  id: string;
  threadState?: "open" | "closed" | "archived";
  frontBurnerRank?: number | null;
  currentMove?: string | null;
  closureCondition?: string | null;
};

export function usePatchThread() {
  return useMutation({
    mutationFn: async (vars: PatchThreadVars) => {
      const { id, ...body } = vars;
      const filtered: Record<string, unknown> = {};
      if (body.threadState !== undefined) filtered.threadState = body.threadState;
      if (body.frontBurnerRank !== undefined) filtered.frontBurnerRank = body.frontBurnerRank;
      if (body.currentMove !== undefined) filtered.currentMove = body.currentMove;
      if (body.closureCondition !== undefined) filtered.closureCondition = body.closureCondition;
      await apiRequest(
        "PATCH",
        `/api/threads/${encodeURIComponent(id)}`,
        filtered,
      );
      return vars;
    },
    onSuccess: (vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/threads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/threads", vars.id] });
    },
  });
}
