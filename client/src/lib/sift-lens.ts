import type { SiftLens, SupportProfile } from "@shared/schema";

export const SIFT_LENSES: SiftLens[] = ["personal", "operator", "writer"];

export const LENS_LABELS: Record<SiftLens, string> = {
  personal: "Personal",
  operator: "Operator",
  writer: "Writer",
};

export const LENS_DESCRIPTIONS: Record<SiftLens, string> = {
  personal:
    "For emotional clarity, inner noise, relationships, overwhelm, and life decisions.",
  operator:
    "For priorities, execution friction, business decisions, momentum, and mental load at work.",
  writer:
    "For poems, fragments, drafts, and creative work that should be met as writing, not as a problem.",
};

export const LENS_HELPER_COPY: Record<SiftLens, string> = {
  personal: "Meet this as inner noise.",
  operator: "Meet this as operational pressure.",
  writer: "Meet this as writing.",
};

export function defaultLensFromProfile(
  profile?: SupportProfile | null,
): SiftLens {
  return profile?.defaultLens ?? "personal";
}
