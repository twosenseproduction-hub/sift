import type { SiftResult } from "@shared/schema";

/**
 * Static sift-shaped payload for UI previews and tests.
 * Not persisted — avoids API calls when browsing signal/noise layout.
 */
export const DEMO_SIFT_PREVIEW: SiftResult = {
  id: "demo-signal-noise-preview",
  input:
    "Three deadlines next week, my kid's play is Thursday, and I keep opening tabs instead of closing anything.",
  inputMode: "text",
  createdAt: 1735689600000,
  mine: false,
  themes: [
    {
      title: "Calendar truth vs drift",
      summary:
        "The week has hard edges; the mind treats scrolling like relief.",
    },
    {
      title: "Presence and avoidance",
      summary:
        "Family moments stay fixed while work piles pretend they're all equally urgent.",
    },
  ],
  coreIntent:
    "You're carrying real throughput pressure beside something non-negotiable on Thursday—and avoidance has borrowed the voice of rest.",
  nextStep:
    "Spend fifteen minutes naming exactly one deliverable you finish before Wednesday noon — write its title on paper and close every unrelated tab before you touch email.",
  reflection:
    "Nothing here says you're failing capacity; it reads like dread borrowing logistics noise.",
  matters: [
    "Thursday night stays yours—the school play is not flexible camouflage.",
    "Throughput panic spikes when nothing gets chosen first.",
    "Stopping matters because avoidance wears the costume of research.",
  ],
  noise: [
    "Every headline suggesting you're behind peers.",
    "Tab hopping billed as keeping options open.",
  ],
  signalReason:
    "What lifts consequence isn't guilt—it’s sequencing reality against one doorway you're unwilling to miss.",
  stepScope: {
    durationEstimate: "Roughly fifteen minutes",
    stoppingCondition:
      "One concrete deliverable is named first on paper, unrelated tabs are closed.",
  },
};
