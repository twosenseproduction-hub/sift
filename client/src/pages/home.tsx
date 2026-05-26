import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  SiftFlowMode,
  WritingSiftArtifact,
} from "@shared/schema";
import { isCareResponse, isRedundancyGateResult, isWritingSiftResult } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AuthDialog } from "@/components/auth-dialog";
import { CareScreen } from "@/components/care-screen";
import {
  type ChatBubble,
} from "@/components/bedroom-session/conversation-card";
import type { RecapModel } from "@/components/bedroom-session/recap-card";
import { SiftReadyPrompt } from "@/components/bedroom-session/first-use-flow";
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
import {
  NextStepSystem,
  RedesignV3RecapOutput,
  SiftAppShell,
  V3AppSidebar,
  V3ComposerBox,
  V3ConversationThread,
} from "@/components/redesign-v3";
import { RedesignV3EmptyComposer } from "@/components/redesign-v3/empty-composer";
import { ComposerIntro } from "@/components/redesign-v3/composer-intro";
import { isRedesignV3Enabled, useRedesignV3 } from "@/lib/use-redesign-v3";
import { ToastAction } from "@/components/ui/toast";
import { useMe, useUpdateSupportProfile } from "@/lib/auth";
import { useDailyPrompt } from "@/lib/useDailyPrompt";
import { useDailySiftShare } from "@/hooks/use-daily-sift-share";
import { SharePromptDialog } from "@/components/share-prompt-dialog";
import { takeDailySiftPrefill } from "@/lib/daily-sift-prefill";
import {
  mergeSupportProfiles,
  readLocalSupportProfile,
  writeLocalSupportProfile,
  completeOnboardingProfile,
} from "@/lib/sift-experience";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { detectWritingLikelihood } from "@/lib/writing-sift-detect";
import { WritingSiftConfirm } from "@/components/redesign-v3/writing-sift-confirm";
import {
  WritingSiftResult,
  writingFollowUpMessage,
  type WritingFollowUpId,
} from "@/components/bedroom-session/writing-sift-result";

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
  if (isWritingSiftResult(result)) return true;
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
  if (isWritingSiftResult(r)) {
    const img = r.writingArtifact.liveImage.trim();
    return img.length > 1600 ? `${img.slice(0, 1597)}…` : img;
  }
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
  const [baseMode, setBaseMode] = useState<SiftBaseMode>(() =>
    isRedesignV3Enabled() ? "light" : "dark",
  );
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

  const [showWritingConfirm, setShowWritingConfirm] = useState(false);
  const [writingArtifact, setWritingArtifact] = useState<WritingSiftArtifact | null>(
    null,
  );
  const skipWritingDetectOnceRef = useRef(false);

  const [careMode, setCareMode] = useState(false);
  const [careRestore, setCareRestore] = useState<string | null>(null);

  const [nextStepDone, setNextStepDone] = useState(false);
  const [showReturnStepStrip, setShowReturnStepStrip] = useState(false);
  const [nextStepLoopBusy, setNextStepLoopBusy] = useState(false);
  const [nextStepCommitted, setNextStepCommitted] = useState(false);
  const [microDoneCount, setMicroDoneCount] = useState(0);
  const [microTotal, setMicroTotal] = useState(4);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const { enabled: redesignV3 } = useRedesignV3();
  const redesignV3Booted = useRef(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const voiceRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const voiceBaseTextRef = useRef("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const openAuth = useCallback((mode: "signin" | "signup") => {
    setAuthMode(mode);
    setAuthOpen(true);
  }, []);
  const [unsavedGuestSiftId, setUnsavedGuestSiftId] = useState<string | null>(null);
  const [guestSavePromptDismissed, setGuestSavePromptDismissed] = useState(false);
  const [supportProfileOpen, setSupportProfileOpen] = useState(false);
  const { data: dailyPromptData, isLoading: dailyPromptLoading } =
    useDailyPrompt();
  const { openShare: openDailySiftShare, shareDialogProps: dailySiftShareDialogProps } =
    useDailySiftShare();
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
    setShowWritingConfirm(false);
    setWritingArtifact(null);
    skipWritingDetectOnceRef.current = false;
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
      !writingArtifact &&
      phase === "structured" &&
      latestExchangeComplete &&
      recap &&
      shouldShowRecap(recap)
        ? recap
        : null,
    [latestExchangeComplete, phase, recap, writingArtifact],
  );

  const dailyPromptCard = useMemo(() => {
    if (!dailyPromptData?.prompt?.text) return null;
    const text = dailyPromptData.prompt.text.trim();
    if (!text) return null;
    return {
      promptId: dailyPromptData.prompt.id,
      themeName: dailyPromptData.theme.name,
      promptText: text,
      promptType: dailyPromptData.prompt.type,
    };
  }, [dailyPromptData]);

  const handleDailyPromptShare = useCallback(() => {
    if (!dailyPromptCard) return;
    openDailySiftShare({
      promptId: dailyPromptCard.promptId,
      themeName: dailyPromptCard.themeName,
      promptText: dailyPromptCard.promptText,
    });
  }, [dailyPromptCard, openDailySiftShare]);

  const dailyPromptActive = useMemo(() => {
    if (!dailyPromptCard) return false;
    return composer.trim() === dailyPromptCard.promptText;
  }, [composer, dailyPromptCard]);

  const librarySidebarQuery = useQuery<{ items: Array<{ id: string; title: string }> }>({
    queryKey: ["/api/library"],
    enabled: Boolean(me),
  });
  const sidebarRecent = useMemo(
    () =>
      (librarySidebarQuery.data?.items ?? []).map((item) => ({
        id: item.id,
        title: item.title,
      })),
    [librarySidebarQuery.data],
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

  const runSubmit = useCallback(
    async (text: string, flowMode: SiftFlowMode = "standard") => {
      if (composerLocked || !text.trim()) return;
      stopVoiceInput();
      const intent = bedroomIntentFor(text, phase);

      const uid =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `u-${Date.now()}`;
      setBubbles((prev) => [...prev, { id: uid, role: "user", text }]);
      setComposer("");
      setShowWritingConfirm(false);
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
              ...(flowMode === "writing" ? { flowMode: "writing" as const } : {}),
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
          if (isWritingSiftResult(sift)) {
            setWritingArtifact(sift.writingArtifact);
            setRecap(null);
          } else {
            setWritingArtifact(null);
            setRecap(intent === "greeting-warmup" ? null : recapFromSiftResult(sift));
          }
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
              <ToastAction altText="Save your clarity" onClick={() => openAuth("signup")}>
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
    },
    [
      appendSiftBubble,
      composerLocked,
      deepenHearingPatch,
      me,
      effectiveSupportProfile,
      phase,
      recordMeaningfulExchange,
      siftId,
      stopVoiceInput,
      toast,
    ],
  );

  const submit = useCallback(async () => {
    const text = composer.trim();
    if (composerLocked || !text) return;

    if (
      !siftId &&
      !skipWritingDetectOnceRef.current &&
      detectWritingLikelihood(text).shouldConfirm
    ) {
      setShowWritingConfirm(true);
      return;
    }
    skipWritingDetectOnceRef.current = false;
    await runSubmit(text, "standard");
  }, [composer, composerLocked, runSubmit, siftId]);

  const confirmMeetAsWriting = useCallback(() => {
    const text = composer.trim();
    if (!text) return;
    void runSubmit(text, "writing");
  }, [composer, runSubmit]);

  const confirmNormalSift = useCallback(() => {
    const text = composer.trim();
    if (!text) return;
    skipWritingDetectOnceRef.current = true;
    void runSubmit(text, "standard");
  }, [composer, runSubmit]);

  const onWritingFollowUp = useCallback(
    (id: WritingFollowUpId) => {
      if (!siftId || thinking) return;
      void runSubmit(writingFollowUpMessage(id), "standard");
    },
    [runSubmit, siftId, thinking],
  );

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
    const prefill = takeDailySiftPrefill();
    if (!prefill) return;
    beginLiveSift(false);
    setComposer(prefill);
    window.setTimeout(
      () =>
        window.dispatchEvent(
          new CustomEvent("sift:focus-composer", { detail: { select: false } }),
        ),
      0,
    );
  }, [beginLiveSift]);

  useEffect(() => {
    if (isSiftRoute && !chatOpen) {
      openChat(false);
    }
  }, [chatOpen, isSiftRoute, openChat]);

  useEffect(() => {
    const onboarding =
      !onboardingComplete &&
      !me &&
      !activeSiftOwnsSurface &&
      !siftId &&
      bubbles.length === 0;
    if (!redesignV3 || redesignV3Booted.current || onboarding) return;
    if (chatOpen || isSiftRoute) {
      redesignV3Booted.current = true;
      return;
    }
    redesignV3Booted.current = true;
    beginLiveSift(false);
  }, [
    beginLiveSift,
    bubbles.length,
    chatOpen,
    isSiftRoute,
    me,
    onboardingComplete,
    redesignV3,
    activeSiftOwnsSurface,
    siftId,
  ]);

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

  const sidebarActiveStep =
    nextStepCommitted && recap?.nextStep
      ? recap.nextStep
      : showReturnStepStrip
        ? recap?.nextStep
        : null;

  return (
    <>
      {showOnboarding ? (
        <div className="sift-redesign-v3-theme sift-v3-onboarding-screen fixed inset-0 z-[40]">
          <SiftOnboardingFlow
            step={onboardingStep}
            draft={onboardingDraft}
            variant="v3"
            mode="light"
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
            openAuth("signup");
          }}
          onFinish={() => void finishOnboarding()}
          />
        </div>
      ) : (
        <SiftAppShell
          activeTab="composer"
          composerText={composer}
          onSettingsClick={() => setSupportProfileOpen(true)}
          settingsTestId="button-home-settings"
        >
          <div className="v3-home-layout">
            <V3AppSidebar
              recentItems={sidebarRecent}
              userHandle={me?.handle ?? null}
              activeStep={sidebarActiveStep}
              microDoneCount={microDoneCount}
              microTotal={microTotal}
              onRelease={recap?.nextStep ? () => setReleaseOpen(true) : undefined}
            />

            <main className="v3-composer-area">
              {me ? (
                <HomeReEntryHint enabled className="mb-4" />
              ) : null}

              {gate ? (
                <div className="v3-stack-block">
                  <RedundancyGateCard
                    gate={gate}
                    busy={gateBusy}
                    onSomethingChanged={onGateSomethingChanged}
                    onKnowThis={onGateKnowThis}
                  />
                </div>
              ) : null}

              {sortIntro && siftId ? (
                <div className="v3-stack-block">
                  <BedroomSortPromptCard
                    payload={sortIntro}
                    busy={sortBusy}
                    onSkip={() => void onSkipSort()}
                  />
                </div>
              ) : null}

              {bubbles.length === 0 && !thinking ? (
                <RedesignV3EmptyComposer
                  disabled={composerLocked}
                  onStarterSelect={selectStarterPrompt}
                  onDailyPromptShare={handleDailyPromptShare}
                  dailyPrompt={dailyPromptCard}
                  dailyPromptLoading={dailyPromptLoading}
                  dailyPromptActive={dailyPromptActive}
                />
              ) : (
                <>
                  <ComposerIntro className="mb-6" />
                  <V3ConversationThread bubbles={bubbles} thinking={thinking} />
                </>
              )}

              {showWritingConfirm && !siftId ? (
                <WritingSiftConfirm
                  className="mt-4"
                  disabled={thinking}
                  onMeetAsWriting={confirmMeetAsWriting}
                  onNormalSift={confirmNormalSift}
                />
              ) : null}

              <V3ComposerBox
                className="mt-2"
                value={composer}
                onChange={setComposer}
                onSubmit={() => void submit()}
                disabled={composerLocked || (showWritingConfirm && !siftId)}
                onVoiceClick={toggleVoiceInput}
                voiceListening={voiceListening}
                thinking={thinking}
              />

              {writingArtifact ? (
                <div className="mt-8 border-t border-[color:var(--v3-border)] pt-8">
                  <WritingSiftResult
                    artifact={writingArtifact}
                    busy={thinking}
                    onFollowUp={onWritingFollowUp}
                  />
                </div>
              ) : null}

              {!me && unsavedGuestSiftId && !guestSavePromptDismissed ? (
                <GuestSavePrompt
                  onSave={() => openAuth("signup")}
                  onDismiss={() => setGuestSavePromptDismissed(true)}
                />
              ) : null}

              {shouldShowSummaryPrompt ? (
                <div className="mt-4">
                  <SiftReadyPrompt
                    busy={thinking}
                    onRequestSummary={() => void onRequestSummary()}
                    onDismiss={() => setSummaryPromptHidden(true)}
                  />
                </div>
              ) : null}

              {recapVisible ? (
                <div className="mt-8 border-t border-[color:var(--v3-border)] pt-8">
                  <RedesignV3RecapOutput
                    recap={recapVisible}
                    busy={nextStepLoopBusy}
                    onDidIt={() => void handleNextStepLoop("did_it")}
                    onDidNot={() => void handleNextStepLoop("did_not")}
                    onKeepGoing={() => void handleNextStepLoop("in_progress")}
                    onCommitChange={setNextStepCommitted}
                    onMicroProgress={(done, total) => {
                      setMicroDoneCount(done);
                      setMicroTotal(total);
                    }}
                    releaseOpen={releaseOpen}
                    onReleaseOpenChange={setReleaseOpen}
                  />
                </div>
              ) : null}

              {showReturnStepStrip &&
              recap?.nextStep &&
              siftId &&
              !thinking &&
              !recapVisible ? (
                <div className="mt-8">
                  <NextStepSystem
                    nextStep={recap.nextStep}
                    busy={nextStepLoopBusy}
                    onDidIt={() => void handleNextStepLoop("did_it")}
                    onDidNot={() => void handleNextStepLoop("did_not")}
                    onKeepGoing={() => void handleNextStepLoop("in_progress")}
                    onCommitChange={setNextStepCommitted}
                    onMicroProgress={(done, total) => {
                      setMicroDoneCount(done);
                      setMicroTotal(total);
                    }}
                    releaseOpen={releaseOpen}
                    onReleaseOpenChange={setReleaseOpen}
                  />
                </div>
              ) : null}
            </main>
          </div>

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

          <AuthDialog
            open={authOpen}
            onOpenChange={setAuthOpen}
            initialMode={authMode}
            baseMode={baseMode}
          />
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
              openAuth("signin");
            }}
          />
        </SiftAppShell>
      )}

      {dailySiftShareDialogProps ? (
        <SharePromptDialog {...dailySiftShareDialogProps} />
      ) : null}
    </>
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
