import type { ThreadListItem, ThreadDetail } from "@shared/schema";
import { apiRequest, queryClient } from "./queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";

// GET /api/threads — all active threads for the signed-in user
export function useThreads() {
  return useQuery<ThreadListItem[]>({
    queryKey: ["/api/threads"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/threads");
      return (await res.json()).threads;
    },
  });
}

// GET /api/threads/:id — full thread with turns + bookmark (owner-only fields)
export function useThread(id: string) {
  return useQuery<ThreadDetail>({
    queryKey: ["/api/threads", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/threads/${id}`);
      return res.json();
    },
    enabled: !!id,
  });
}

// PATCH /api/threads/:id — update thread state
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
      await apiRequest("PATCH", `/api/threads/${id}`, filtered);
      return vars;
    },
    onSuccess: (vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/threads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/threads", vars.id] });
    },
  });
}
