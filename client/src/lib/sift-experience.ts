import { useState } from "react";
import type { SupportProfile } from "@shared/schema";
import { useMe } from "@/lib/auth";

export type SiftExperienceMode = "base";
export type SiftBaseVisualMode = "dark" | "light";

export const LOCAL_SUPPORT_PROFILE_KEY = "sift.onboardingProfile";

export function readLocalSupportProfile(): SupportProfile | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(LOCAL_SUPPORT_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SupportProfile;
    return parsed?.completedAt ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLocalSupportProfile(profile: SupportProfile | null) {
  try {
    if (typeof localStorage === "undefined") return;
    if (!profile) localStorage.removeItem(LOCAL_SUPPORT_PROFILE_KEY);
    else localStorage.setItem(LOCAL_SUPPORT_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
}

export function mergeSupportProfiles(
  localProfile?: SupportProfile | null,
  accountProfile?: SupportProfile | null,
): SupportProfile | null {
  if (accountProfile) return { ...localProfile, ...accountProfile };
  return localProfile ?? null;
}

export function supportProfileMode(_profile?: SupportProfile | null): SiftExperienceMode {
  return "base";
}

export function supportProfileBaseVisualMode(
  profile?: SupportProfile | null,
): SiftBaseVisualMode {
  return profile?.theme === "light" ? "light" : "dark";
}

export function useCurrentSiftExperience() {
  const { data } = useMe();
  const [localProfile] = useState<SupportProfile | null>(() => readLocalSupportProfile());
  const profile = mergeSupportProfiles(localProfile, data?.me?.supportProfile);

  return {
    profile,
    mode: supportProfileMode(profile),
    baseMode: supportProfileBaseVisualMode(profile),
  };
}
