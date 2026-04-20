import { createContext, useContext } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./queryClient";
import type { Me } from "@shared/schema";

type MeResponse = { me: Me };

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
      queryClient.setQueryData(["/api/auth/me"], data);
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
      queryClient.setQueryData(["/api/auth/me"], data);
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
      queryClient.setQueryData(["/api/auth/me"], { me: null });
      queryClient.invalidateQueries({ queryKey: ["/api/sifts"] });
    },
  });
}
