import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, setAuthToken } from "./queryClient";
import type { Me } from "@shared/schema";

type MeResponse = { me: Me; token?: string };

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
    mutationFn: async (input: { handle: string; passphrase: string }) => {
      const res = await apiRequest("POST", "/api/auth/signup", input);
      return (await res.json()) as MeResponse;
    },
    onSuccess: (data) => {
      if (data.token) setAuthToken(data.token);
      queryClient.setQueryData(["/api/auth/me"], { me: data.me });
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
      queryClient.invalidateQueries({ queryKey: ["/api/sifts"] });
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
