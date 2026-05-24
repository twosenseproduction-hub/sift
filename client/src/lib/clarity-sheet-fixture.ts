import type { SiftSummary } from "@shared/schema";

/** Fixture for #/clarity-sheet-preview (dev only). */
export const CLARITY_SHEET_DEMO_SUMMARY: SiftSummary = {
  summary:
    "The hard part is not the conversation itself — it is the weight of what might shift if you say it plainly. What keeps looping is rehearsal as protection, not confusion about what you want to say.",
  themes: [
    "Approaching your wife with something load-bearing",
    "Rehearsing instead of contacting",
    "Fear of what changes once it is spoken",
  ],
  canWait: [
    "Getting the wording perfect before you begin",
    "Predicting every reaction in advance",
  ],
  options: [
    {
      id: "name-one-sentence",
      label: "Name one sentence",
      description: "Write the single line you most need her to hear — not the whole case.",
    },
    {
      id: "pick-moment",
      label: "Pick the moment",
      description: "Choose a low-noise window this week instead of waiting for readiness.",
    },
    {
      id: "say-opening",
      label: "Say the opening",
      description: "Lead with one honest opener; let the rest follow in the room.",
    },
  ],
  recommendedNextStep: {
    id: "name-one-sentence",
    label: "Name one sentence",
    description: "Write the single line you most need her to hear — not the whole case.",
  },
  meta: { generatedAt: new Date().toISOString(), model: "preview" },
};
