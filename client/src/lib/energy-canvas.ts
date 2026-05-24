export type EnergyStateName =
  | "blank"
  | "tangled"
  | "anxious"
  | "grief"
  | "hopeful"
  | "overwhelmed";

export type BlobConfig = {
  w: number;
  h: number;
  l: number;
  t: number;
  grad: string;
  spd: string;
  op: number;
};

export type EnergyState = {
  label: string;
  dotColor: string;
  bg: string;
  blobs: BlobConfig[];
};

export const ENERGY_STATES: Record<EnergyStateName, EnergyState> = {
  blank: {
    label: "",
    dotColor: "#7a9460",
    bg: "#f0ebe0",
    blobs: [
      {
        w: 75,
        h: 68,
        l: 12.5,
        t: 20,
        grad: "radial-gradient(ellipse at center, #6b8854 0%, rgba(107,136,84,0.75) 25%, rgba(107,136,84,0.30) 52%, transparent 72%)",
        spd: "13s",
        op: 1,
      },
      { w: 0, h: 0, l: 50, t: 50, grad: "transparent", spd: "9s", op: 0 },
      { w: 0, h: 0, l: 50, t: 50, grad: "transparent", spd: "11s", op: 0 },
      { w: 0, h: 0, l: 50, t: 50, grad: "transparent", spd: "7s", op: 0 },
    ],
  },
  tangled: {
    label: "tangled",
    dotColor: "#7a8860",
    bg: "#eae5d8",
    blobs: [
      {
        w: 60,
        h: 55,
        l: 18,
        t: 22,
        grad: "radial-gradient(ellipse at center, #5e7d48 0%, rgba(94,125,72,0.68) 30%, rgba(94,125,72,0.22) 58%, transparent 74%)",
        spd: "10s",
        op: 1,
      },
      {
        w: 38,
        h: 32,
        l: 48,
        t: 8,
        grad: "radial-gradient(ellipse at center, rgba(80,105,58,0.55) 0%, transparent 70%)",
        spd: "9s",
        op: 0.85,
      },
      {
        w: 30,
        h: 26,
        l: 4,
        t: 58,
        grad: "radial-gradient(ellipse at center, rgba(72,96,52,0.42) 0%, transparent 70%)",
        spd: "12s",
        op: 0.7,
      },
      { w: 0, h: 0, l: 50, t: 50, grad: "transparent", spd: "7s", op: 0 },
    ],
  },
  anxious: {
    label: "anxious",
    dotColor: "#6a7850",
    bg: "#e5dfd4",
    blobs: [
      {
        w: 48,
        h: 44,
        l: 26,
        t: 28,
        grad: "radial-gradient(ellipse at center, #4a6e38 0%, rgba(74,110,56,0.82) 22%, rgba(74,110,56,0.32) 50%, transparent 68%)",
        spd: "6s",
        op: 1,
      },
      {
        w: 36,
        h: 30,
        l: 54,
        t: 5,
        grad: "radial-gradient(ellipse at center, rgba(60,90,44,0.62) 0%, transparent 68%)",
        spd: "5s",
        op: 0.9,
      },
      {
        w: 32,
        h: 28,
        l: 8,
        t: 62,
        grad: "radial-gradient(ellipse at center, rgba(55,82,40,0.55) 0%, transparent 68%)",
        spd: "7s",
        op: 0.85,
      },
      {
        w: 22,
        h: 20,
        l: 62,
        t: 65,
        grad: "radial-gradient(ellipse at center, rgba(65,95,48,0.48) 0%, transparent 65%)",
        spd: "4.5s",
        op: 0.75,
      },
    ],
  },
  grief: {
    label: "grief",
    dotColor: "#4a6848",
    bg: "#e8e3d9",
    blobs: [
      {
        w: 85,
        h: 52,
        l: 7,
        t: 46,
        grad: "radial-gradient(ellipse at center, #3d5e42 0%, rgba(61,94,66,0.72) 28%, rgba(61,94,66,0.28) 58%, transparent 74%)",
        spd: "22s",
        op: 1,
      },
      {
        w: 42,
        h: 35,
        l: 28,
        t: 14,
        grad: "radial-gradient(ellipse at center, rgba(50,75,54,0.28) 0%, transparent 65%)",
        spd: "20s",
        op: 0.5,
      },
      { w: 0, h: 0, l: 50, t: 50, grad: "transparent", spd: "11s", op: 0 },
      { w: 0, h: 0, l: 50, t: 50, grad: "transparent", spd: "7s", op: 0 },
    ],
  },
  hopeful: {
    label: "hopeful",
    dotColor: "#8aaa65",
    bg: "#f5f0e5",
    blobs: [
      {
        w: 72,
        h: 70,
        l: 14,
        t: 8,
        grad: "radial-gradient(ellipse at center, #88a865 0%, rgba(136,168,101,0.65) 28%, rgba(136,168,101,0.22) 55%, transparent 72%)",
        spd: "16s",
        op: 0.85,
      },
      {
        w: 45,
        h: 40,
        l: 28,
        t: 55,
        grad: "radial-gradient(ellipse at center, rgba(120,155,88,0.32) 0%, transparent 68%)",
        spd: "18s",
        op: 0.6,
      },
      { w: 0, h: 0, l: 50, t: 50, grad: "transparent", spd: "11s", op: 0 },
      { w: 0, h: 0, l: 50, t: 50, grad: "transparent", spd: "7s", op: 0 },
    ],
  },
  overwhelmed: {
    label: "overwhelmed",
    dotColor: "#526440",
    bg: "#ddd8ce",
    blobs: [
      {
        w: 52,
        h: 48,
        l: 24,
        t: 22,
        grad: "radial-gradient(ellipse at center, #526840 0%, rgba(82,104,64,0.88) 20%, rgba(82,104,64,0.38) 48%, transparent 66%)",
        spd: "5.5s",
        op: 1,
      },
      {
        w: 44,
        h: 40,
        l: 48,
        t: 2,
        grad: "radial-gradient(ellipse at center, rgba(65,88,48,0.68) 0%, transparent 65%)",
        spd: "4.5s",
        op: 0.9,
      },
      {
        w: 40,
        h: 36,
        l: 0,
        t: 52,
        grad: "radial-gradient(ellipse at center, rgba(60,82,44,0.62) 0%, transparent 65%)",
        spd: "6.5s",
        op: 0.88,
      },
      {
        w: 48,
        h: 44,
        l: 36,
        t: 60,
        grad: "radial-gradient(ellipse at center, rgba(58,78,42,0.72) 0%, transparent 65%)",
        spd: "3.8s",
        op: 0.92,
      },
    ],
  },
};

const KEYWORDS: Record<Exclude<EnergyStateName, "blank">, string[]> = {
  anxious: [
    "afraid",
    "scared",
    "fear",
    "anxious",
    "anxiety",
    "nervous",
    "worry",
    "worried",
    "panic",
    "terrified",
    "dread",
    "what if",
    "can't",
    "cannot",
    "won't",
    "going to",
    "danger",
    "threat",
    "risk",
    "test",
    "deadline",
    "fail",
    "failing",
    "wrong",
    "mistake",
    "regret",
  ],
  grief: [
    "miss",
    "missing",
    "lost",
    "lose",
    "gone",
    "empty",
    "alone",
    "lonely",
    "sad",
    "grief",
    "mourn",
    "died",
    "death",
    "end",
    "over",
    "never",
    "wish",
    "hope you",
    "hurt",
    "pain",
    "cry",
    "crying",
    "tears",
    "broken",
    "numb",
    "hollow",
    "ache",
  ],
  hopeful: [
    "better",
    "improve",
    "maybe",
    "could",
    "want",
    "wish",
    "hope",
    "looking forward",
    "excited",
    "happy",
    "glad",
    "grateful",
    "thankful",
    "opportunity",
    "chance",
    "possible",
    "try",
    "trying",
    "will",
    "going to",
    "new",
    "fresh",
    "ready",
  ],
  overwhelmed: [
    "everything",
    "all of",
    "too much",
    "can't handle",
    "so many",
    "pile",
    "piling",
    "list",
    "tasks",
    "responsibilities",
    "both",
    "and also",
    "not only",
    "plus",
    "on top",
    "at the same time",
    "juggling",
    "drowning",
    "keep up",
    "keep going",
    "behind",
    "falling behind",
    "exhausted",
  ],
  tangled: [
    "but",
    "however",
    "although",
    "not sure",
    "don't know",
    "confused",
    "unclear",
    "uncertain",
    "torn",
    "mixed",
    "complicated",
    "complex",
    "hard to explain",
    "i think",
    "i feel",
    "i don't",
    "i can't",
    "i keep",
    "back and forth",
    "going around",
    "in circles",
  ],
};

export function scoreEnergyState(text: string): EnergyStateName {
  const trimmed = text.trim();
  if (!trimmed) return "blank";

  const lower = trimmed.toLowerCase();
  const scores: Record<Exclude<EnergyStateName, "blank">, number> = {
    anxious: 0,
    grief: 0,
    hopeful: 0,
    overwhelmed: 0,
    tangled: 0,
  };

  for (const [cat, words] of Object.entries(KEYWORDS) as [
    Exclude<EnergyStateName, "blank">,
    string[],
  ][]) {
    for (const word of words) {
      let idx = 0;
      while ((idx = lower.indexOf(word, idx)) !== -1) {
        scores[cat]++;
        idx += word.length;
      }
    }
  }

  const exclaim = (trimmed.match(/!/g) || []).length;
  const allcaps = (trimmed.match(/\b[A-Z]{3,}\b/g) || []).length;
  scores.anxious += exclaim * 0.8 + allcaps * 1.2;
  scores.overwhelmed += (trimmed.split(",").length - 1) * 0.4;
  scores.tangled += (trimmed.split(/[.?]/).length - 1) * 0.3;

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  if (total < 1) return trimmed.length > 20 ? "tangled" : "blank";

  const dominant = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]![0] as Exclude<
    EnergyStateName,
    "blank"
  >;
  if (scores[dominant] < 0.8) return trimmed.length > 20 ? "tangled" : "blank";
  return dominant;
}

export type MicroStep = {
  text: string;
  hint: string;
};

/** Generic micro-steps when the engine does not return a breakdown yet. */
export function microStepsForNextStep(nextStep: string): MicroStep[] {
  const trimmed = nextStep.trim();
  return [
    {
      text: "Find a quiet moment — five minutes is enough",
      hint: "You do not need to be ready. You just need to begin.",
    },
    {
      text: trimmed
        ? `Do the smallest part of: ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1, 80)}${trimmed.length > 80 ? "…" : ""}`
        : "Name one concrete action you can take in the next few minutes",
      hint: "Keep it small enough to finish before doubt sets in.",
    },
    {
      text: "Notice when it is done — even partially",
      hint: "Completion is the signal. Momentum follows.",
    },
    {
      text: "Close the loop — return only if the thread is still alive",
      hint: "Done for now is allowed.",
    },
  ];
}
