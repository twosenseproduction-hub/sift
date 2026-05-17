import type { SiftResult } from "@shared/schema";

/** Deterministic sample for local UI / layout review — not persisted. */
export const HOME_PREVIEW_SIFT: SiftResult = {
  id: "00000000-0000-4000-8000-000000000001",
  input:
    "I'm caught between polishing the landing page and fixing onboarding bugs — both feel urgent and I keep half-solving each.",
  inputMode: "text",
  createdAt: 1_704_067_200_000,
  mine: false,
  themes: [
    {
      title: "Throughput vs polish",
      summary: "Two lanes are competing for the same attention window.",
    },
    {
      title: "False urgency",
      summary: "Everything reads loud when nothing has a clear done line.",
    },
  ],
  coreIntent:
    "What you are managing is not lack of care. It is unbounded parallel lanes without a governing sequence.",
  nextStep:
    "Pick one lane for the next 25 minutes — only one — and write its single done sentence on paper before you touch the editor.",
  reflection:
    "Nothing here is arguing you should neglect the other thread. The question is which move unlocks the rest without theater.",
  matters: [
    "Onboarding fixes unblock real users this week",
    "The landing page is mostly perceived momentum",
  ],
  noise: [
    "Switching every time context loads anew",
    "Treating “almost shipped” as the same as shipped",
  ],
  signalReason:
    "The friction is sequencing, not commitment — the system has not told you what to finish first.",
  stepScope: {
    durationEstimate: "About half an hour",
    stoppingCondition:
      "When the done sentence is true or you hit a hard dependency you can name in one line.",
  },
};

/**
 * Dev-only: open home with a filled composer + inline result tray.
 * Use either `?preview=sift` on the page URL or `#/?preview=sift` in the hash.
 */
export function isHomeSiftPreviewRequested(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    const fromSearch = new URLSearchParams(window.location.search).get(
      "preview",
    );
    if (fromSearch === "sift") return true;
    const h = window.location.hash;
    const qi = h.indexOf("?");
    if (qi === -1) return false;
    return new URLSearchParams(h.slice(qi + 1)).get("preview") === "sift";
  } catch {
    return false;
  }
}
