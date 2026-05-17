import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, setAuthToken } from "./queryClient";
import type { Me, MemoryPreferencesUpdateRequest, SupportProfileUpdateRequest } from "@shared/schema";

type MeResponse = { me: Me; token?: string };

/** Headspace-style “Today first”: land on `#/` after sign-in unless the hash is a deep link. */
function navigateToTodayUnlessDeepLinked() {
  if (typeof window === "undefined") return;
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const path = raw.split("?")[0];
  const deep =
    path.startsWith("/s/") ||
    path.startsWith("/admin");
  if (!deep) {
    window.location.hash = "/";
  }
}

// Token is held in-memory only. Storage (localStorage/sessionStorage/cookies)
// is blocked inside the deployed iframe, so we keep the token in module state
// for the life of the page. A full reload returns the user to signed-out state.

export function useMe() {
  return useQuery<MeResponse>({
    queryKey: ["/api/auth/me"],
    staleTime: 1000 * 60,
  });
}

export function useSignup() {
  return useMutation({
    mutationFn: async (input: {
      handle: string;
      passphrase: string;
      contact: string;
      consentUpdates?: boolean;
      consentReflections?: boolean;
      supportProfile?: SupportProfileUpdateRequest;
    }) => {
      const res = await apiRequest("POST", "/api/auth/signup", input);
      return (await res.json()) as MeResponse;
    },
    onSuccess: (data) => {
      if (data.token) setAuthToken(data.token);
      queryClient.setQueryData(["/api/auth/me"], { me: data.me });
      void apiRequest("POST", "/api/guest/claim", {}).finally(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sifts"] });
      navigateToTodayUnlessDeepLinked();
    },
  });
}

export function useUpdateSupportProfile() {
  return useMutation({
    mutationFn: async (input: SupportProfileUpdateRequest) => {
      const res = await apiRequest("PATCH", "/api/auth/support-profile", input);
      return (await res.json()) as MeResponse;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], { me: data.me });
    },
  });
}

export function useUpdateMemoryPreferences() {
  return useMutation({
    mutationFn: async (input: MemoryPreferencesUpdateRequest) => {
      const res = await apiRequest("PATCH", "/api/auth/memory-preferences", input);
      return (await res.json()) as MeResponse;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], { me: data.me });
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
    },
  });
}

export function useExportData() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/auth/export");
      return await res.json();
    },
  });
}

export function useDeleteAllHistory() {
  return useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/library", {});
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sifts"] });
    },
  });
}

export function useUpdateContact() {
  return useMutation({
    mutationFn: async (input: {
      contact: string;
      consentUpdates?: boolean;
      consentReflections?: boolean;
    }) => {
      const res = await apiRequest("PATCH", "/api/auth/contact", input);
      return (await res.json()) as MeResponse;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], { me: data.me });
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/auth/account", {});
      return true;
    },
    onSuccess: () => {
      setAuthToken(null);
      queryClient.setQueryData(["/api/auth/me"], { me: null });
      queryClient.invalidateQueries({ queryKey: ["/api/sifts"] });
    },
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: async (input: { handle: string; passphrase: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", input);
      return (await res.json()) as MeResponse;
    },
    onSuccess: (data) => {
      if (data.token) setAuthToken(data.token);
      queryClient.setQueryData(["/api/auth/me"], { me: data.me });
      void apiRequest("POST", "/api/guest/claim", {}).finally(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sifts"] });
      navigateToTodayUnlessDeepLinked();
    },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout", {});
      return true;
    },
    onSuccess: () => {
      setAuthToken(null);
      queryClient.setQueryData(["/api/auth/me"], { me: null });
      queryClient.invalidateQueries({ queryKey: ["/api/sifts"] });
    },
  });
}
