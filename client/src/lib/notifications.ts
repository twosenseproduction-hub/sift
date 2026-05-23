import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./queryClient";
import type {
  NotificationPreferences,
  NotificationPreferencesUpdateRequest,
} from "@shared/schema";

export type NotificationPreferencesResponse = {
  preferences: NotificationPreferences;
  featureEnabled: boolean;
  hourRange: { min: number; max: number };
  hasEmail: boolean;
};

export function useNotificationPreferences(enabled = true) {
  return useQuery<NotificationPreferencesResponse>({
    queryKey: ["/api/me/notifications"],
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateNotificationPreferences() {
  return useMutation({
    mutationFn: async (input: NotificationPreferencesUpdateRequest) => {
      const res = await apiRequest("PATCH", "/api/me/notifications", input);
      return (await res.json()) as NotificationPreferencesResponse;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/me/notifications"], data);
    },
  });
}

/** Parse query string from hash-router URLs (`#/path?foo=bar`). */
export function parseHashSearchParams(): URLSearchParams {
  try {
    const h = window.location.hash;
    const qi = h.indexOf("?");
    if (qi === -1) return new URLSearchParams();
    return new URLSearchParams(h.slice(qi + 1));
  } catch {
    return new URLSearchParams();
  }
}

export function clearHashSearchParam(...keys: string[]) {
  try {
    const h = window.location.hash;
    const qi = h.indexOf("?");
    const path = qi === -1 ? h.replace(/^#/, "") || "/" : h.slice(1, qi + 1).replace(/^\/?/, "/").split("?")[0];
    const params = parseHashSearchParams();
    for (const key of keys) params.delete(key);
    const qs = params.toString();
    window.location.hash = qs ? `#${path}?${qs}` : `#${path}`;
  } catch {
    // ignore
  }
}
