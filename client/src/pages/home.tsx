import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Bookmark,
  ClientTranscriptTurn,
  DeepenResponse,
  SortResponse,
  SiftRedundancyGateResult,
  SiftResult,
  SiftTurnMessage,
  SortPromptPayload,
  SiftSummary,
  SupportProfile,
  SupportProfileUpdateRequest,
  ThreadTurn,
} from "@shared/schema";
import { isCareResponse, isRedundancyGateResult } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AuthDialog } from "@/components/auth-dialog";
import { CareScreen } from "@/components/care-screen";
import { SiftBottomNav } from "@/components/sift-bottom-nav";
import { SiftShellHeader } from "@/components/sift-shell-header";
import {
  ConversationCard,
  type ChatBubble,
} from "@/components/bedroom-session/conversation-card";
import type { RecapModel } from "@/components/bedroom-session/recap-card";
import {
  Composer,
  EmptyConversationState,
  SiftReadyPrompt,
} from "@/components/bedroom-session/first-use-flow";
import { BedroomSortPromptCard } from "@/components/bedroom-session/bedroom-sort-prompt";
import {
  BedroomSummarySheet,
  type ActiveStepState,
} from "@/components/bedroom-session/bedroom-summary-card";
import { SupportProfileDialog } from "@/components/support-profile-dialog";
import { HomeReEntryHint } from "@/components/home-reentry-hint";
import {
  SiftOnboardingFlow,
  type OnboardingStep,
} from "@/components/onboarding/sift-onboarding-flow";
import { RedundancyGateCard } from "@/components/bedroom-session/redundancy-gate-card";
import { SiftBaseBackground } from "@/components/bedroom-session/sift-base-background";
import { ToastAction } from "@/components/ui/toast";
import { useMe, useUpdateSupportProfile } from "@/lib/auth";
import {
  mergeSupportProfiles,
  readLocalSupportProfile,
  writeLocalSupportProfile,
  completeOnboardingProfile,
} from "@/lib/sift-experience";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

const REQUEST_FALLBACK_COPY =
  "I missed that for a second. Send it once more, and I'll stay with the thread." as const;
const LIVE_SESSION_STORAGE_KEY = "sift.liveSession.v1";

/** Base mode is conversation-first: less headroom, more transcript height. */
const SIFT_BASE_CHAT_DOCK_TOP =
  "top-[max(calc(env(safe-area-inset-top,0px)+4.25rem),4.25rem)] sm:top-[4.75rem]";

type SessionPhase = "warmup" | "structured";
type BedroomIntent = "warmup-companion" | "greeting-warmup";
type AvatarState = "idle" | "thinking" | "presenting" | "celebrating";
type SiftBaseMode = "dark" | "light";
type SpeechRecognitionResultLike = {
  transcript: string;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: SpeechRecognitionResultLike;
  }>;
};
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
type LiveSessionSnapshot = {
  siftId: string | null;
  bubbles: ChatBubble[];
  composer: string;
  chatOpen: boolean;
  baseMode: SiftBaseMode;
  recap: RecapModel | null;
  summary: SiftSummary | null;
  summarySheetMinimized: boolean;
  activeStep: ActiveStepState | null;
  phase: SessionPhase;
  sortIntro: SortPromptPayload | null;
  meaningfulUserMessageCount: number;
  meaningfulSiftReplyCount: number;
  latestSiftCanSummarize: boolean;
  summaryPromptHidden: boolean;
  nextStepDone: boolean;
  savedAt: number;
};

const CHAT_REVEAL_DELAY_MS = 420;

function isGreetingOnlyMessage(text: string): boolean {
  const stripped = text
    .trim()
    .toLowerCase()
    .replace(/^[\s!.,?;:'"()[\]{}-]+|[\s!.,?;:'"()[\]{}-]+$/g, "");
  return ["hi", "hey", "hello", "yo", "sup", "hola"].includes(stripped);
}

function bedroomIntentFor(text: string, phase: SessionPhase): BedroomIntent | undefined {
  if (phase !== "warmup") return undefined;
  return isGreetingOnlyMessage(text) ? "greeting-warmup" : "warmup-companion";
}

function isMeaningfulUserMessage(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length >= 10 || trimmed.split(/\s+/).filter(Boolean).length >= 3;
}

function transcriptFromBubbles(bubbles: ChatBubble[]): ClientTranscriptTurn[] {
  return bubbles
    .filter((bubble) => bubble.id !== "welcome" && bubble.text.trim())
    .map((bubble) => ({
      role: bubble.role,
      text: bubble.text.trim(),
    }));
}

function supportProfileForRequest(profile?: SupportProfile | null): SupportProfileUpdateRequest | undefined {
  if (!profile?.mode && !profile?.startingSpace && !profile?.theme && !profile?.primaryIntent && !profile?.supportStyle) return undefined;
  return {
    mode: profile.mode,
    startingSpace: profile.startingSpace,
    theme: profile.theme,
    primaryIntent: profile.primaryIntent,
    supportStyle: profile.supportStyle,
    completedAt: profile.completedAt,
  };
}

function activeStepMicroStepsFor(
  option: SiftSummary["options"][number],
  profile?: SupportProfile | null,
): string[] {
  const label = option.label.trim();
  const lowerLabel = label.toLowerCase();

  if (profile?.supportStyle === "step_by_step") {
    return [
      "Name the smallest piece of this step.",
      "Write one sentence that makes it concrete.",
      "Choose what can wait until later.",
      "Capture the next visible move.",
    ];
  }

  if (profile?.primaryIntent === "find_next_step") {
    return [
      "Name the action in plain words.",
      "Choose where it starts.",
      "Set the stopping point.",
    ];
  }

  if (profile?.primaryIntent === "calm_noise") {
    return [
      "Name the loudest thing.",
      "Name what actually needs attention.",
      "Set one small boundary around the rest.",
    ];
  }

  if (lowerLabel.includes("write") || lowerLabel.includes("draft")) {
    return [
      "Write the first rough sentence.",
      "Name the part that feels most honest.",
      "Remove anything that tries to prove too much.",
      "Keep the version you could actually send or say.",
    ];
  }

  if (lowerLabel.includes("talk") || lowerLabel.includes("ask") || lowerLabel.includes("say")) {
    return [
      "Name the one moment you want to address.",
      "Write the sentence you would open with.",
      "Name what you are asking for clearly.",
      "Choose the smallest real point of contact.",
    ];
  }

  return [
    "Name one recent moment.",
    "Name what went unsaid.",
    "Name what that silence made you carry.",
    "Capture what feels true now.",
  ];
}

function createActiveStep(
  option: SiftSummary["options"][number],
  profile?: SupportProfile | null,
): ActiveStepState {
  const microSteps = activeStepMicroStepsFor(option, profile);
  return {
    optionId: option.id,
    title: option.label,
    description: option.description,
    microSteps,
    completed: microSteps.map(() => false),
    currentIndex: 0,
  };
}

function activeStepArtifactFor(step: ActiveStepState): NonNullable<ActiveStepState["artifact"]> {
  return {
    whatBecameClearer: `This moved from an abstract next step into a few named pieces you can hold.`,
    signalCaptured: step.description?.trim() || step.title,
    whatMattersNow: "The smallest honest version of the move is enough to continue from.",
  };
}

function hasMeaningfulSiftResult(result: SiftResult): boolean {
  return Boolean(result.matters?.length || result.nextStep?.trim());
}

function hasMeaningfulTurnMessage(message: SiftTurnMessage): boolean {
  return Boolean(message.matters?.length || message.mini?.trim());
}

function formatSiftTurnMessage(m: SiftTurnMessage): string {
  const bits: string[] = [];
  if (m.mirror) bits.push(m.mirror);
  if (m.mini) bits.push(m.mini);
  if (m.question) bits.push(m.question);
  return bits.filter(Boolean).join("\n\n");
}

function siftBubbleFromResult(r: SiftResult): string {
  const t = r.reflection?.trim();
  if (t) return t.length > 1600 ? `${t.slice(0, 1597)}…` : t;
  return [r.coreIntent, r.nextStep].filter(Boolean).join("\n\n");
}

function recapFromSiftResult(r: SiftResult): RecapModel {
  return {
    hearing: r.reflection?.trim() || r.coreIntent,
    matters: (r.matters ?? []).slice(0, 4),
    noise: (r.noise ?? []).slice(0, 3),
    nextStep: r.nextStep,
  };
}

function recapFromBookmark(bookmark: Bookmark): RecapModel {
  const p = bookmark.payload;
  return {
    hearing: p.unfolded || p.pointing,
    matters: p.matters.slice(0, 4),
    noise: p.noise.slice(0, 3),
    nextStep: p.nextStep,
  };
}

function shouldShowRecap(recap: RecapModel): boolean {
  return !!(recap.nextStep?.trim() && recap.matters.length >= 1);
}

function handleInitial(handle: string): string {
  const t = handle.trim().replace(/^@/, "");
  if (!t) return "·";
  const letters = t.replace(/[^a-zA-Z0-9]/g, "");
  if (letters.length >= 1) return letters[0]!.toUpperCase();
  return t.slice(0, 1).toUpperCase();
}

function readLiveSessionSnapshot(): LiveSessionSnapshot | null {
  try {
    const raw = localStorage.getItem(LIVE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveSessionSnapshot;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > 1000 * 60 * 60 * 24 * 7) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLiveSessionSnapshot(snapshot: LiveSessionSnapshot | null) {
  try {
    if (!snapshot) {
      localStorage.removeItem(LIVE_SESSION_STORAGE_KEY);
      return;
    }
    localStorage.setItem(LIVE_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function siftMessageFromTurns(turns: ThreadTurn[]): SiftTurnMessage | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t.role === "sift" && t.kind === "message") return t.message;
  }
  return null;
}

export default function Home() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const { data: meData } = useMe();
  const updateSupportProfile = useUpdateSupportProfile();
  const me = meData?.me;
  const [localOnboardingProfile, setLocalOnboardingProfile] =
    useState<SupportProfile | null>(() => readLocalSupportProfile());
  const effectiveSupportProfile = mergeSupportProfiles(
    localOnboardingProfile,
    me?.supportProfile,
  );
  const onboardingComplete = Boolean(effectiveSupportProfile?.completedAt);

  const [bubbles, setBubbles] = useState<ChatBubble[]>(() => []);
  const [composer, setComposer] = useState("");
  const [thinking, setThinking] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatRevealed, setChatRevealed] = useState(false);
  const [baseMode, setBaseMode] = useState<SiftBaseMode>("dark");
  const [siftId, setSiftId] = useState<string | null>(null);
  const [recap, setRecap] = useState<RecapModel | null>(null);
  const [summary, setSummary] = useState<SiftSummary | null>(null);
  const [summarySheetMinimized, setSummarySheetMinimized] = useState(false);
  const [summaryDone, setSummaryDone] = useState(false);
  const [activeStep, setActiveStep] = useState<ActiveStepState | null>(null);
  const [avatarCelebrating, setAvatarCelebrating] = useState(false);
  const [avatarPresenting, setAvatarPresenting] = useState(false);
  const lastPresentedReplyCountRef = useRef(0);
  const [siftReplyCount, setSiftReplyCount] = useState(0);
  const [meaningfulUserMessageCount, setMeaningfulUserMessageCount] = useState(0);
  const [meaningfulSiftReplyCount, setMeaningfulSiftReplyCount] = useState(0);
  const [summaryExchangeRendered, setSummaryExchangeRendered] = useState(false);
  const [phase, setPhase] = useState<SessionPhase>("warmup");
  const [latestSiftCanSummarize, setLatestSiftCanSummarize] = useState(false);
  const [summaryPromptHidden, setSummaryPromptHidden] = useState(false);

  const [gate, setGate] = useState<SiftRedundancyGateResult | null>(null);
  const [gateBusy, setGateBusy] = useState(false);

  const [sortIntro, setSortIntro] = useState<SortPromptPayload | null>(null);
  const [sortBusy, setSortBusy] = useState(false);

  const [careMode, setCareMode] = useState(false);
  const [careRestore, setCareRestore] = useState<string | null>(null);

  const [nextStepDone, setNextStepDone] = useState(false);
  const [showReturnStepStrip, setShowReturnStepStrip] = useState(false);
  const [nextStepLoopBusy, setNextStepLoopBusy] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const voiceRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const voiceBaseTextRef = useRef("");
  const [authOpen, setAuthOpen] = useState(false);
  const [unsavedGuestSiftId, setUnsavedGuestSiftId] = useState<string | null>(null);
  const [guestSavePromptDismissed, setGuestSavePromptDismissed] = useState(false);
  const [supportProfileOpen, setSupportProfileOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("welcome");
  const [onboardingDraft, setOnboardingDraft] = useState<SupportProfileUpdateRequest>(
    () => ({
      mode: "base",
      theme: effectiveSupportProfile?.theme ?? "system",
      primaryIntent: effectiveSupportProfile?.primaryIntent,
      supportStyle: effectiveSupportProfile?.supportStyle,
    }),
  );
  const liveSessionRestoredRef = useRef(false);

  const resetSession = useCallback(() => {
    setBubbles([]);
    setComposer("");
    setThinking(false);
    setChatOpen(false);
    setChatRevealed(false);
    setSiftId(null);
    setRecap(null);
    setSummary(null);
    setSummarySheetMinimized(false);
    setSummaryDone(false);
    setActiveStep(null);
    setAvatarCelebrating(false);
    setAvatarPresenting(false);
    lastPresentedReplyCountRef.current = 0;
    setSiftReplyCount(0);
    setMeaningfulUserMessageCount(0);
    setMeaningfulSiftReplyCount(0);
    setSummaryExchangeRendered(false);
    setPhase("warmup");
    setLatestSiftCanSummarize(false);
    setSummaryPromptHidden(false);
    setGate(null);
    setGateBusy(false);
    setSortIntro(null);
    setSortBusy(false);
    setCareMode(false);
    setCareRestore(null);
    setNextStepDone(false);
    setShowReturnStepStrip(false);
    setNextStepLoopBusy(false);
    voiceRecognitionRef.current?.abort();
    voiceRecognitionRef.current = null;
    setVoiceListening(false);
    setUnsavedGuestSiftId(null);
    setGuestSavePromptDismissed(false);
    writeLiveSessionSnapshot(null);
  }, []);

  useEffect(() => {
    const onReset = () => resetSession();
    window.addEventListener("sift:home-reset", onReset);
    return () => window.removeEventListener("sift:home-reset", onReset);
  }, [resetSession]);

  useEffect(() => {
    if (liveSessionRestoredRef.current) return;
    liveSessionRestoredRef.current = true;
    const snapshot = readLiveSessionSnapshot();
    if (!snapshot) return;
    const hasLiveState = Boolean(
      snapshot.siftId ||
      snapshot.bubbles.length > 0 ||
      snapshot.composer.trim() ||
      snapshot.recap ||
      snapshot.sortIntro,
    );
    if (!hasLiveState) return;

    setSiftId(snapshot.siftId);
    setBubbles(snapshot.bubbles);
    setComposer(snapshot.composer);
    setChatOpen(snapshot.chatOpen || hasLiveState);
    setChatRevealed(snapshot.chatOpen || hasLiveState);
    setBaseMode(snapshot.baseMode);
    setRecap(snapshot.recap);
    setSummary(snapshot.summary);
    setSummarySheetMinimized(snapshot.summarySheetMinimized);
    setActiveStep(snapshot.activeStep);
    setPhase(snapshot.phase);
    setSortIntro(snapshot.sortIntro);
    setMeaningfulUserMessageCount(snapshot.meaningfulUserMessageCount);
    setMeaningfulSiftReplyCount(snapshot.meaningfulSiftReplyCount);
    setLatestSiftCanSummarize(snapshot.latestSiftCanSummarize);
    setSummaryPromptHidden(snapshot.summaryPromptHidden);
    setNextStepDone(snapshot.nextStepDone);
    setShowReturnStepStrip(Boolean(snapshot.recap?.nextStep?.trim()));

    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("sift:focus-composer", {
          detail: { select: Boolean(snapshot.composer.trim()) },
        }),
      );
    }, CHAT_REVEAL_DELAY_MS);
  }, []);

  useEffect(() => {
    const hasLiveState =
      siftId ||
      bubbles.length > 0 ||
      composer.trim() ||
      recap ||
      sortIntro ||
      summary ||
      activeStep;
    if (!hasLiveState) {
      writeLiveSessionSnapshot(null);
      return;
    }
    writeLiveSessionSnapshot({
      siftId,
      bubbles,
      composer,
      chatOpen,
      baseMode,
      recap,
      summary,
      summarySheetMinimized,
      activeStep,
      phase,
      sortIntro,
      meaningfulUserMessageCount,
      meaningfulSiftReplyCount,
      latestSiftCanSummarize,
      summaryPromptHidden,
      nextStepDone,
      savedAt: Date.now(),
    });
  }, [
    activeStep,
    baseMode,
    bubbles,
    chatOpen,
    composer,
    latestSiftCanSummarize,
    meaningfulSiftReplyCount,
    meaningfulUserMessageCount,
    nextStepDone,
    phase,
    recap,
    siftId,
    sortIntro,
    summary,
    summaryPromptHidden,
    summarySheetMinimized,
  ]);


  useEffect(() => {
    if (!me || me.supportProfile?.completedAt || !localOnboardingProfile?.completedAt) {
      return;
    }
    updateSupportProfile.mutate(supportProfileForRequest(localOnboardingProfile)!);
  }, [localOnboardingProfile, me, updateSupportProfile]);

  useEffect(() => {
    setOnboardingDraft({
      mode: "base",
      theme: effectiveSupportProfile?.theme ?? "system",
      primaryIntent: effectiveSupportProfile?.primaryIntent,
      supportStyle: effectiveSupportProfile?.supportStyle,
    });
  }, [
    effectiveSupportProfile?.theme,
    effectiveSupportProfile?.primaryIntent,
    effectiveSupportProfile?.supportStyle,
  ]);

  useEffect(() => {
    if (!unsavedGuestSiftId || me) return;
    try {
      sessionStorage.setItem("sift.unsavedGuestSift", unsavedGuestSiftId);
    } catch {
      /* ignore */
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      try {
        sessionStorage.removeItem("sift.unsavedGuestSift");
      } catch {
        /* ignore */
      }
    };
  }, [me, unsavedGuestSiftId]);

  useEffect(() => {
    if (!me) return;
    setUnsavedGuestSiftId(null);
    setGuestSavePromptDismissed(false);
  }, [me]);

  useEffect(() => {
    setNextStepDone(false);
  }, [recap?.nextStep, recap?.hearing]);

  useEffect(() => {
    setActiveStep(null);
  }, [summary]);

  useEffect(() => {
    if (!summaryDone) {
      setAvatarCelebrating(false);
      return;
    }
    setAvatarCelebrating(true);
    const id = window.setTimeout(() => setAvatarCelebrating(false), 1800);
    return () => window.clearTimeout(id);
  }, [summaryDone]);

  useEffect(() => {
    if (
      thinking ||
      avatarCelebrating ||
      siftReplyCount <= 0 ||
      lastPresentedReplyCountRef.current === siftReplyCount
    ) {
      return;
    }

    lastPresentedReplyCountRef.current = siftReplyCount;
    if (Math.random() > 0.35) return;

    setAvatarPresenting(true);
    const id = window.setTimeout(() => setAvatarPresenting(false), 2200);
    return () => window.clearTimeout(id);
  }, [avatarCelebrating, siftReplyCount, thinking]);

  const startActiveStep = useCallback((option: SiftSummary["options"][number]) => {
    setActiveStep(createActiveStep(option, effectiveSupportProfile));
    setSummaryDone(false);
    setSummarySheetMinimized(false);
    setAvatarPresenting(true);
    window.setTimeout(() => setAvatarPresenting(false), 1600);
  }, [effectiveSupportProfile]);

  const completeActiveStepItem = useCallback((index: number) => {
    setActiveStep((current) => {
      if (!current) return current;

      const completed = current.completed.map((value, i) =>
        i === index ? true : value,
      );
      const nextOpenIndex = completed.findIndex((value) => !value);
      const allComplete = nextOpenIndex === -1;

      if (allComplete) {
        setSummaryDone(true);
        return {
          ...current,
          completed,
          currentIndex: current.microSteps.length - 1,
          artifact: current.artifact ?? activeStepArtifactFor(current),
        };
      }

      return {
        ...current,
        completed,
        currentIndex: nextOpenIndex,
      };
    });
  }, []);

  const inSummaryMode = Boolean(summary && !summarySheetMinimized);
  const isSiftRoute = location === "/sift";
  const activeSiftOwnsSurface = isSiftRoute || chatOpen;

  const composerLocked =
    thinking || !!gate || !!sortIntro || careMode;

  const latestBubble = bubbles[bubbles.length - 1];
  const hasMinimumDeeperClarityTurns =
    meaningfulUserMessageCount >= 2 && meaningfulSiftReplyCount >= 2;
  const latestExchangeComplete =
    !thinking &&
    latestBubble?.role === "sift" &&
    latestSiftCanSummarize &&
    summaryExchangeRendered;
  const deeperClarityEligible =
    !!siftId &&
    phase === "structured" &&
    !summary &&
    hasMinimumDeeperClarityTurns &&
    latestExchangeComplete;
  const recapVisible = useMemo(
    () =>
      phase === "structured" &&
      latestExchangeComplete &&
      recap &&
      shouldShowRecap(recap)
        ? recap
        : null,
    [latestExchangeComplete, phase, recap],
  );
  const avatarState: AvatarState = avatarCelebrating
    ? "celebrating"
    : thinking
      ? "thinking"
      : avatarPresenting
        ? "presenting"
      : "idle";

  const shouldShowSummaryPrompt =
    deeperClarityEligible && !summaryPromptHidden;

  useEffect(() => {
    if (
      phase !== "structured" ||
      thinking ||
      !latestSiftCanSummarize ||
      meaningfulUserMessageCount < 2 ||
      meaningfulSiftReplyCount < 2 ||
      latestBubble?.role !== "sift"
    ) {
      return;
    }

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setSummaryExchangeRendered(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [
    latestBubble?.role,
    latestSiftCanSummarize,
    meaningfulSiftReplyCount,
    meaningfulUserMessageCount,
    phase,
    thinking,
  ]);

  const recordMeaningfulExchange = useCallback(
    (userText: string, hasStructuredSignal: boolean) => {
      const meaningful =
        isMeaningfulUserMessage(userText) && hasStructuredSignal;
      setLatestSiftCanSummarize(meaningful);
      if (!meaningful) return;

      setMeaningfulUserMessageCount((prev) => prev + 1);
      setMeaningfulSiftReplyCount((prev) => {
        const next = prev + 1;
        if (next >= 2) setPhase("structured");
        return next;
      });
    },
    [],
  );

  const deepenHearingPatch = useCallback(
    (msg: SiftTurnMessage, prior: RecapModel) => {
      const line = formatSiftTurnMessage(msg).trim();
      if (!line) return prior;
      return { ...prior, hearing: line };
    },
    [],
  );

  const appendSiftBubble = useCallback((text: string, opts?: {
    countReply?: boolean;
  }) => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `sift-${Date.now()}`;
    setBubbles((prev) => [...prev, { id, role: "sift", text }]);
    if (opts?.countReply !== false) {
      setSiftReplyCount((prev) => prev + 1);
    }
  }, []);

  const selectStarterPrompt = useCallback((prompt: string) => {
    setComposer(prompt);
    window.setTimeout(
      () =>
        window.dispatchEvent(
          new CustomEvent("sift:focus-composer", { detail: { select: false } }),
        ),
      0,
    );
  }, []);

  const stopVoiceInput = useCallback(() => {
    voiceRecognitionRef.current?.stop();
    voiceRecognitionRef.current = null;
    setVoiceListening(false);
  }, []);

  const toggleVoiceInput = useCallback(() => {
    if (voiceListening) {
      stopVoiceInput();
      return;
    }

    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      toast({
        title: "Voice input is not available here",
        description: "Use Chrome or Safari speech input, or type the thread.",
      });
      return;
    }

    try {
      const recognition = new Recognition();
      voiceBaseTextRef.current = composer.trim();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        let finalText = "";
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const transcript = result?.[0]?.transcript?.trim();
          if (!transcript) continue;
          if (result.isFinal) {
            finalText = [finalText, transcript].filter(Boolean).join(" ");
          } else {
            interimText = [interimText, transcript].filter(Boolean).join(" ");
          }
        }
        const nextText = [
          voiceBaseTextRef.current,
          finalText || interimText,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (nextText) setComposer(nextText);
        if (finalText) voiceBaseTextRef.current = nextText;
      };
      recognition.onerror = (event) => {
        setVoiceListening(false);
        voiceRecognitionRef.current = null;
        if (event.error === "no-speech" || event.error === "aborted") return;
        toast({
          title: "Voice input stopped",
          description: "I could not keep listening. You can tap the mic and try again.",
        });
      };
      recognition.onend = () => {
        setVoiceListening(false);
        voiceRecognitionRef.current = null;
      };
      voiceRecognitionRef.current = recognition;
      recognition.start();
      setVoiceListening(true);
    } catch {
      setVoiceListening(false);
      voiceRecognitionRef.current = null;
      toast({
        title: "Voice input could not start",
        description: "Check microphone permission, then tap the mic again.",
      });
    }
  }, [composer, stopVoiceInput, toast, voiceListening]);

  useEffect(() => {
    return () => {
      voiceRecognitionRef.current?.abort();
      voiceRecognitionRef.current = null;
    };
  }, []);

  const handleNextStepLoop = useCallback(
    async (status: "did_it" | "did_not" | "in_progress") => {
      if (status === "in_progress") {
        setShowReturnStepStrip(false);
        window.dispatchEvent(new CustomEvent("sift:focus-composer"));
        return;
      }
      if (!siftId || !me) {
        setNextStepDone(status === "did_it");
        setShowReturnStepStrip(false);
        window.dispatchEvent(new CustomEvent("sift:focus-composer"));
        return;
      }
      setNextStepLoopBusy(true);
      try {
        const res = await apiRequest("POST", `/api/sift/${encodeURIComponent(siftId)}/checkin`, {
          status,
          note: "",
        });
        const data = (await res.json()) as { checkin?: { nextStep?: string } };
        if (data.checkin?.nextStep) {
          setRecap((current) =>
            current ? { ...current, nextStep: data.checkin!.nextStep! } : current,
          );
        }
        queryClient.invalidateQueries({ queryKey: ["/api/reentry"] });
        queryClient.invalidateQueries({ queryKey: ["/api/sifts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/library"] });
        setNextStepDone(status === "did_it");
        setShowReturnStepStrip(false);
      } catch (err: unknown) {
        toast({
          title: "Couldn't save that update",
          description: err instanceof Error ? err.message : "Try again in a moment.",
        });
      } finally {
        setNextStepLoopBusy(false);
      }
    },
    [me, siftId, toast],
  );

  const submit = useCallback(async () => {
    const text = composer.trim();
    if (composerLocked) return;
    if (!text) return;
    stopVoiceInput();
    const intent = bedroomIntentFor(text, phase);

    const uid =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `u-${Date.now()}`;
    setBubbles((prev) => [...prev, { id: uid, role: "user", text }]);
    setComposer("");
    setThinking(true);
    setAvatarPresenting(false);
    setLatestSiftCanSummarize(false);
    setSummaryExchangeRendered(false);
    setGate(null);
    const supportProfile = supportProfileForRequest(effectiveSupportProfile);

    try {
      if (!siftId) {
        const res = await apiRequest(
          "POST",
          "/api/sift",
          {
            input: text,
            inputMode: "text",
            phase,
            intent,
            supportProfile,
          },
          import.meta.env.DEV ? { auth: false } : undefined,
        );
        const data = (await res.json()) as unknown;
        if (isCareResponse(data)) {
          setCareMode(true);
          setCareRestore(text);
          setThinking(false);
          return;
        }
        if (isRedundancyGateResult(data)) {
          setGate(data as SiftRedundancyGateResult);
          setThinking(false);
          return;
        }
        const sift = data as SiftResult;
        setSiftId(sift.id);
        if (!me) {
          setUnsavedGuestSiftId(sift.id);
          setGuestSavePromptDismissed(false);
        }
        setRecap(intent === "greeting-warmup" ? null : recapFromSiftResult(sift));
        appendSiftBubble(siftBubbleFromResult(sift));
        recordMeaningfulExchange(text, hasMeaningfulSiftResult(sift));
        queryClient.invalidateQueries({ queryKey: ["/api/reentry"] });
        queryClient.invalidateQueries({ queryKey: ["/api/sifts"] });
        setThinking(false);
        return;
      }

      const res = await apiRequest(
        "POST",
        `/api/sift/${encodeURIComponent(siftId)}/deepen`,
        { text, phase, intent, supportProfile },
        import.meta.env.DEV ? { auth: false } : undefined,
      );

      const raw = (await res.json()) as DeepenResponse | unknown;

      if (isCareResponse(raw)) {
        setCareMode(true);
        setCareRestore(text);
        setThinking(false);
        return;
      }

      const d = raw as DeepenResponse;
      if (d.type !== "turns") {
        setThinking(false);
        return;
      }

      const turns = d.turns;

      if (d.bookmark) {
        setRecap(recapFromBookmark(d.bookmark));
      }

      const sm = siftMessageFromTurns(turns);
      if (sm) {
        const line = formatSiftTurnMessage(sm).trim();
        if (line) {
          if (!d.bookmark) {
            setRecap((prev) => (prev ? deepenHearingPatch(sm, prev) : prev));
          }
          appendSiftBubble(line);
          recordMeaningfulExchange(text, hasMeaningfulTurnMessage(sm));
        }
      }

      const last = turns[turns.length - 1];
      if (
        last?.role === "sift" &&
        last.kind === "sort_prompt" &&
        d.awaitingSort
      ) {
        setSortIntro(last.sortPrompt);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/sift", siftId] });
      setThinking(false);
    } catch (e: unknown) {
      if (
        e instanceof Error &&
        (e.message.startsWith("409:") || /^409 /.test(e.message))
      ) {
        toast({
          title: "Hang on — practice first",
          description: "Finish or skip the short sort above before sending.",
        });
        setThinking(false);
        return;
      }
      const msg =
        e instanceof Error ? e.message : "Try again in a moment.";
      if (msg.includes("guest_limit")) {
        toast({
          title: "Create your space to keep going",
          description: "Guest mode gives you a few Sifts first. Saving keeps the thread available.",
          action: (
            <ToastAction altText="Save your clarity" onClick={() => setAuthOpen(true)}>
              Save your clarity
            </ToastAction>
          ),
        });
      } else {
        toast({ title: "Something went wrong", description: msg });
      }
      appendSiftBubble(REQUEST_FALLBACK_COPY, { countReply: false });
      setThinking(false);
    }
  }, [
    appendSiftBubble,
    composer,
    composerLocked,
    deepenHearingPatch,
    me,
    effectiveSupportProfile,
    phase,
    recordMeaningfulExchange,
    siftId,
    stopVoiceInput,
    toast,
  ]);

  const onRequestSummary = useCallback(async () => {
    if (!deeperClarityEligible || !siftId || thinking) return;
    const clientTranscript = transcriptFromBubbles(bubbles);
    setSummaryPromptHidden(true);
    setThinking(true);
    setAvatarPresenting(false);
    appendSiftBubble("Okay. Let me pull this together for you…", {
      countReply: false,
    });
    try {
      const res = await apiRequest(
        "POST",
        `/api/sift/${encodeURIComponent(siftId)}/deepen`,
        {
          mode: "summary",
          clientTranscript,
          supportProfile: supportProfileForRequest(effectiveSupportProfile),
        },
        import.meta.env.DEV ? { auth: false } : undefined,
      );
      const raw = (await res.json()) as DeepenResponse | unknown;
      if (isCareResponse(raw)) {
        setCareMode(true);
        setCareRestore(null);
        return;
      }
      const data = raw as DeepenResponse;
      if (data.type === "summary") {
        setSummary(data.summary);
        setSummarySheetMinimized(false);
        setSummaryDone(false);
      }
    } catch {
      setSummaryPromptHidden(false);
      toast({
        title: "I couldn't pull that together just now.",
        description: "Please try again.",
        action: (
          <ToastAction
            altText="Show the summarize prompt again"
            onClick={() => setSummaryPromptHidden(false)}
          >
            Retry
          </ToastAction>
        ),
      });
    } finally {
      setThinking(false);
    }
  }, [appendSiftBubble, bubbles, deeperClarityEligible, effectiveSupportProfile, siftId, thinking, toast]);

  const onSkipSort = useCallback(async () => {
    if (!siftId || !sortIntro) return;
    setSortBusy(true);
    try {
      const res = await apiRequest(
        "POST",
        `/api/sift/${encodeURIComponent(siftId)}/sort`,
        {
          matters: [],
          noise: [],
          unsure: [],
          skipped: true,
        },
      );
      const raw = (await res.json()) as SortResponse | unknown;
      if (isCareResponse(raw)) {
        setCareMode(true);
        setCareRestore(null);
        setSortIntro(null);
        return;
      }
      const data = raw as SortResponse;
      if (data.type === "turns") {
        if (data.bookmark) setRecap(recapFromBookmark(data.bookmark));
        const sm = siftMessageFromTurns(data.turns);
        if (sm) {
          const line = formatSiftTurnMessage(sm).trim();
          if (line) {
            appendSiftBubble(line);
          }
        }
      }
      setSortIntro(null);
      queryClient.invalidateQueries({ queryKey: ["/api/sift", siftId] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Try again in a moment.";
      toast({ title: "Could not skip sort", description: msg });
    } finally {
      setSortBusy(false);
    }
  }, [appendSiftBubble, siftId, sortIntro, toast]);

  const onGateSomethingChanged = useCallback(async () => {
    if (!gate) return;
    setGateBusy(true);
    try {
      const res = await apiRequest(
        "POST",
        "/api/sift",
        {
          input: gate.input,
          inputMode: gate.inputMode,
          forceAnalysis: true,
          phase,
          intent: bedroomIntentFor(gate.input, phase),
          supportProfile: supportProfileForRequest(effectiveSupportProfile),
        },
        import.meta.env.DEV ? { auth: false } : undefined,
      );
      const data = (await res.json()) as unknown;
      if (isCareResponse(data)) {
        setGate(null);
        setCareMode(true);
        setCareRestore(gate.input);
        return;
      }
      if (isRedundancyGateResult(data)) {
        setGate(data as SiftRedundancyGateResult);
        return;
      }
      const sift = data as SiftResult;
      setGate(null);
      setSiftId(sift.id);
      if (!me) {
        setUnsavedGuestSiftId(sift.id);
        setGuestSavePromptDismissed(false);
      }
      setRecap(recapFromSiftResult(sift));
      appendSiftBubble(siftBubbleFromResult(sift));
      recordMeaningfulExchange(gate.input, hasMeaningfulSiftResult(sift));
      queryClient.invalidateQueries({ queryKey: ["/api/reentry"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sifts"] });
    } catch {
      setGate(null);
      toast({
        title: "Could not sift",
        description: "Try again in a moment.",
      });
    } finally {
      setGateBusy(false);
    }
  }, [appendSiftBubble, effectiveSupportProfile, gate, me, phase, recordMeaningfulExchange, toast]);

  const onGateKnowThis = useCallback(async () => {
    if (!gate) return;
    setGateBusy(true);
    try {
      await apiRequest(
        "PATCH",
        `/api/sift/${encodeURIComponent(gate.redundancyGate.priorSiftId)}/close-loop`,
        {},
      );
    } catch {
      /* still dismiss */
    }
    setGate(null);
    setGateBusy(false);
  }, [gate]);

  const openChat = useCallback((select = false) => {
    setChatOpen(true);
    window.requestAnimationFrame(() => setChatRevealed(true));
    window.setTimeout(
      () =>
        window.dispatchEvent(
          new CustomEvent("sift:focus-composer", { detail: { select } }),
        ),
      CHAT_REVEAL_DELAY_MS,
    );
  }, []);

  const beginLiveSift = useCallback((select = true) => {
    if (location !== "/sift") setLocation("/sift");
    openChat(select);
  }, [location, openChat, setLocation]);

  useEffect(() => {
    if (isSiftRoute && !chatOpen) {
      openChat(false);
    }
  }, [chatOpen, isSiftRoute, openChat]);

  const finishOnboarding = useCallback(async () => {
    const profile = completeOnboardingProfile({
      ...onboardingDraft,
      mode: "base",
    });
    setLocalOnboardingProfile(profile);
    writeLocalSupportProfile(profile);
    setOnboardingStep("welcome");
    beginLiveSift(true);

    if (me) {
      try {
        await updateSupportProfile.mutateAsync(supportProfileForRequest(profile)!);
      } catch {
        toast({
          title: "Preferences saved here",
          description: "I couldn't sync them to your account yet.",
        });
      }
    }
  }, [beginLiveSift, me, onboardingDraft, toast, updateSupportProfile]);

  if (careMode) {
    return (
      <CareScreen
        onClose={() => {
          setCareMode(false);
          setCareRestore(null);
        }}
        onDismiss={() => {
          if (careRestore) setComposer(careRestore);
          setCareMode(false);
          setCareRestore(null);
        }}
      />
    );
  }

  const showOnboarding =
    !onboardingComplete &&
    !me &&
    !activeSiftOwnsSurface &&
    !siftId &&
    bubbles.length === 0;

  return (
    <div
      className={cn(
        "bedroom-session sift-base-session relative flex min-h-[100dvh] flex-col overflow-x-hidden bg-[color:var(--color-bg)] text-[color:var(--color-text)]",
        baseMode === "light" && "sift-base-light-session",
        activeSiftOwnsSurface && "sift-active-session",
      )}
    >
      <SiftBaseBackground mode={baseMode} />
      <SiftShellHeader
        className="pointer-events-auto fixed inset-x-0 top-0 z-[30] bg-transparent px-4 pt-[max(env(safe-area-inset-top),0.35rem)] sm:px-5"
        onSettingsClick={() => setSupportProfileOpen(true)}
        settingsTestId="button-home-settings"
      />

      <div className="pointer-events-none relative z-10 flex w-full shrink-0 flex-col pb-8">
        <div className="relative z-[18] flex w-full flex-col items-center gap-3 px-4 sm:px-5">
          {me && !activeSiftOwnsSurface && !showOnboarding ? (
            <HomeReEntryHint enabled mode={baseMode} className="mb-1" />
          ) : null}
          {gate ? (
            <div className="pointer-events-auto w-full max-w-[640px] shrink-0">
              <RedundancyGateCard
                gate={gate}
                busy={gateBusy}
                onSomethingChanged={onGateSomethingChanged}
                onKnowThis={onGateKnowThis}
              />
            </div>
          ) : null}

          {sortIntro && siftId ? (
            <div className="pointer-events-auto w-full max-w-[640px] shrink-0">
              <BedroomSortPromptCard
                payload={sortIntro}
                busy={sortBusy}
                onSkip={() => void onSkipSort()}
              />
            </div>
          ) : null}
        </div>
      </div>

      {!activeSiftOwnsSurface && !showOnboarding ? (
        <SiftBaseOpeningIntro mode={baseMode} onBegin={() => beginLiveSift(true)} />
      ) : null}

      {activeSiftOwnsSurface ? (
        <div
          className={cn(
            "bedroom-chat-dock pointer-events-none fixed inset-x-0 bottom-0 z-[25] flex flex-col items-stretch transition-[opacity,transform] duration-500 ease-out",
            chatRevealed
              ? "translate-y-0 opacity-100"
              : "translate-y-[calc(100%+2rem)] opacity-0",
            SIFT_BASE_CHAT_DOCK_TOP,
          )}
        >
          <div className="pointer-events-auto mx-auto flex h-full w-full max-w-[720px] items-end px-4 pb-[max(calc(0.75rem+env(safe-area-inset-bottom,0px)),1rem)] pt-0 sm:px-5">
            <div
              className={cn(
                "bedroom-conversation-shell flex h-full min-h-0 w-full flex-col overflow-hidden rounded-3xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-[var(--bedroom-paper-shadow)] transition-[max-height] duration-300 ease-out",
                inSummaryMode
                  ? "max-h-[72dvh] sm:max-h-[76dvh]"
                  : "max-h-[68dvh] sm:max-h-[74dvh]",
              )}
              aria-label="Conversation"
            >
              <ConversationCard
                bubbles={bubbles}
                thinking={thinking}
                recap={recapVisible}
                phase={phase}
                showCompanion={false}
                nextStepDone={nextStepDone}
                onToggleNextStep={() => setNextStepDone((v) => !v)}
                footerVisible={shouldShowSummaryPrompt}
                emptyState={
                  !thinking ? (
                    <EmptyConversationState
                      disabled={composerLocked}
                      onStarterSelect={selectStarterPrompt}
                    />
                  ) : null
                }
              />
              {!me && unsavedGuestSiftId && !guestSavePromptDismissed ? (
                <GuestSavePrompt
                  onSave={() => setAuthOpen(true)}
                  onDismiss={() => setGuestSavePromptDismissed(true)}
                />
              ) : null}
              {showReturnStepStrip && recap?.nextStep && siftId && !thinking ? (
                <NextStepReturnStrip
                  nextStep={recap.nextStep}
                  busy={nextStepLoopBusy}
                  onDidIt={() => void handleNextStepLoop("did_it")}
                  onDidNot={() => void handleNextStepLoop("did_not")}
                  onKeepGoing={() => void handleNextStepLoop("in_progress")}
                />
              ) : null}
              {shouldShowSummaryPrompt ? (
                <SiftReadyPrompt
                  busy={thinking}
                  onRequestSummary={() => void onRequestSummary()}
                  onDismiss={() => setSummaryPromptHidden(true)}
                />
              ) : null}
              <Composer
                className="w-full shrink-0"
                variant="embedded"
                value={composer}
                onChange={setComposer}
                onSubmit={() => void submit()}
                disabled={composerLocked}
                onVoiceClick={toggleVoiceInput}
                voiceListening={voiceListening}
              />
            </div>
          </div>
        </div>
      ) : null}

      <BedroomSummarySheet
        summary={summary}
        done={summaryDone}
        activeStep={activeStep}
        minimized={summarySheetMinimized}
        onMinimizedChange={setSummarySheetMinimized}
        onStartActiveStep={startActiveStep}
        onCompleteActiveStepItem={completeActiveStepItem}
        onToggleDone={() => setSummaryDone((v) => !v)}
        onDismiss={() => {
          setSummarySheetMinimized(true);
        }}
      />

      {showOnboarding ? (
        <SiftOnboardingFlow
          step={onboardingStep}
          draft={onboardingDraft}
          mode={baseMode}
          onStepChange={setOnboardingStep}
          onDraftChange={setOnboardingDraft}
          onBegin={() => setOnboardingStep("choice")}
          onTryFree={() => {
            const profile = completeOnboardingProfile({
              ...onboardingDraft,
              mode: "base",
            });
            setLocalOnboardingProfile(profile);
            writeLocalSupportProfile(profile);
            setOnboardingStep("welcome");
            beginLiveSift(true);
          }}
          onCreateAccount={() => {
            setAuthOpen(true);
          }}
          onFinish={() => void finishOnboarding()}
        />
      ) : null}

      <SiftBottomNav
        hidden={activeSiftOwnsSurface || showOnboarding}
        variant="pill"
        onSiftClick={() => beginLiveSift(true)}
      />

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode="signup" baseMode={baseMode} />
      <SupportProfileDialog
        open={supportProfileOpen}
        onOpenChange={setSupportProfileOpen}
        profile={effectiveSupportProfile}
        canPersist={Boolean(me)}
        baseMode={baseMode}
        onBaseModeChange={setBaseMode}
        onSaveLocal={(profile) => {
          setLocalOnboardingProfile(profile);
          writeLocalSupportProfile(profile);
          if (profile?.theme === "light") setBaseMode("light");
          if (profile?.theme === "dark") setBaseMode("dark");
        }}
        me={me ?? null}
        onRequestSignIn={() => {
          setSupportProfileOpen(false);
          setAuthOpen(true);
        }}
      />
    </div>
  );
}

function NextStepReturnStrip({
  nextStep,
  busy,
  onDidIt,
  onDidNot,
  onKeepGoing,
}: {
  nextStep: string;
  busy?: boolean;
  onDidIt: () => void;
  onDidNot: () => void;
  onKeepGoing: () => void;
}) {
  return (
    <div className="mx-3 mb-2 shrink-0 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]/90 px-3 py-2 shadow-[var(--bedroom-tray-shadow)] sm:mx-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">
        Where this left off
      </p>
      <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[color:var(--color-text)]">
        {nextStep}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={onDidIt}
          className="rounded-full bg-[color:var(--color-primary)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--color-surface)] transition hover:opacity-[0.96] disabled:opacity-45"
        >
          Did it
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDidNot}
          className="rounded-full border border-[color:var(--color-border-soft)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--color-text-muted)] transition hover:text-[color:var(--color-text)] disabled:opacity-45"
        >
          Didn&apos;t get to it
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onKeepGoing}
          className="rounded-full border border-transparent px-3 py-1.5 text-[11px] font-medium text-[color:var(--color-text-muted)] transition hover:text-[color:var(--color-text)] disabled:opacity-45"
        >
          Keep going
        </button>
      </div>
    </div>
  );
}


function SiftBaseOpeningIntro({
  mode,
  onBegin,
}: {
  mode: SiftBaseMode;
  onBegin: () => void;
}) {
  const dark = mode === "dark";

  return (
    <section
      className="pointer-events-none fixed inset-0 z-[18] flex items-center justify-center px-6 py-24"
      aria-label="Sift Base opening"
    >
      <div
        className={cn(
          "pointer-events-auto flex w-full max-w-[440px] flex-col items-center text-center transition-[opacity,transform] duration-500 ease-out",
          dark ? "text-[rgba(216,242,210,0.9)]" : "text-[#29261f]",
        )}
      >
        <p
          className={cn(
            "font-serif text-[12px] uppercase tracking-[0.38em]",
            dark ? "text-[rgba(195,240,190,0.54)]" : "text-[#556b57]/80",
          )}
        >
          Sift
        </p>
        <div
          className={cn(
            "mt-4 h-px w-10",
            dark ? "bg-[rgba(195,240,190,0.28)]" : "bg-[#7a5e49]/35",
          )}
          aria-hidden
        />
        <h1
          className={cn(
            "mt-7 max-w-[340px] font-serif text-[40px] leading-[1.18] tracking-[-0.035em] sm:text-[46px]",
            dark ? "text-[rgba(218,244,213,0.9)]" : "text-[#29261f]",
          )}
        >
          What&apos;s on your mind right now?
        </h1>
        <p
          className={cn(
            "mt-5 font-serif text-[18px] italic tracking-[0.01em] sm:text-[20px]",
            dark ? "text-[rgba(201,235,194,0.58)]" : "text-[#6e685d]",
          )}
        >
          Start typing or paste something...
        </p>
        <button
          type="button"
          onClick={onBegin}
          className={cn(
            "mt-8 w-full max-w-[300px] rounded-xl px-6 py-4 font-serif text-[18px] tracking-[0.01em] shadow-[0_18px_44px_-34px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2",
            dark
              ? "border border-[rgba(120,200,110,0.2)] bg-black/15 text-[rgba(210,240,202,0.72)] focus:ring-[rgba(180,235,170,0.42)] focus:ring-offset-[#2d6640]"
              : "border border-[#556b57]/20 bg-[#faf7f0]/72 text-[#556b57] focus:ring-[#556b57]/40 focus:ring-offset-[#f4f0e6]",
          )}
        >
          Your thoughts, clarified.
        </button>
      </div>
    </section>
  );
}

function GuestSavePrompt({
  onSave,
  onDismiss,
}: {
  onSave: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mx-3 mb-2 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]/88 px-4 py-3 shadow-[0_18px_44px_-34px_rgba(0,0,0,0.45)] backdrop-blur-md sm:mx-4">
      <p className="font-serif text-[17px] leading-snug text-[color:var(--color-text)]">
        Keep this Sift?
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--color-text-muted)]">
        Create your space to come back to this clarity later.
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onDismiss}
          className="text-[12px] font-medium text-[color:var(--color-text-muted)] transition hover:text-[color:var(--color-text)]"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={onSave}
          className="rounded-full bg-[color:var(--color-primary)] px-4 py-2 text-[12px] font-medium text-[color:var(--color-surface)] transition hover:opacity-95"
        >
          Save your clarity
        </button>
      </div>
    </div>
  );
}
