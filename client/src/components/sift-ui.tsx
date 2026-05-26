import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Mic, MicOff, Send, Copy, Link2, RotateCcw, Check, Sparkles, Clock, ArrowRight, Share2, ArrowUp } from "lucide-react";
import { SharePromptDialog } from "./share-prompt-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getAuthToken } from "@/lib/queryClient";
import { track } from "@/lib/track";
import {
  createRecognizer,
  isVoiceSupported,
  type RecognitionHandle,
} from "@/lib/voice";
import type {
  SiftResult,
  CareResponse,
  SiftRedundancyGateResult,
  ReEntryResponse,
} from "@shared/schema";
import type { FragmentBucket } from "@shared/schema";
import { isCareResponse, isRedundancyGateResult } from "@shared/schema";
import { ClarifyPrompt } from "./clarify-prompt";
import { previewModeFromInput } from "@/lib/routeThread";
import { cn } from "@/lib/utils";
import { reentryPrimaryHref, reentryPrimaryLabel } from "@/lib/reentry-navigation";
import { SIFT_LUMA_MOOD_EVENT, type LumaMood } from "@/lib/lumaGrainEngine";

// Deterministic thin-input heuristic. Returns true when the submission is
// likely too sparse for a confident sift. Intentionally conservative — we
// only gate when the signal is clearly thin so normal submissions are
// untouched.
function isThinInput(raw: string): boolean {
  const text = raw.trim();
  if (!text) return true;
  // Collapse whitespace, then count words and unique words.
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  if (wordCount < 6) return true;
  // Very short character count even with many filler tokens.
  if (text.length < 40) return true;
  // Low lexical diversity — e.g. "idk idk idk i don't know i don't know".
  const unique = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z']/g, ""))).size;
  if (wordCount >= 6 && unique / wordCount < 0.5) return true;
  // No complete sentence AND short. Punctuation-free fragments under ~12
  // words usually lack enough context to separate signal from noise.
  const hasSentence = /[.!?]/.test(text);
  if (!hasSentence && wordCount < 12) return true;
  return false;
}

// ---------- Composer ----------

interface ComposerProps {
  onResult: (r: SiftResult) => void;
  /** High redundancy short-circuit — no persisted sift; prior sift id for mastery ack */
  onRedundancyGate?: (r: SiftRedundancyGateResult) => void;
  /**
   * Called when the server screens the submitted input as a crisis signal
   * (suicide, self-harm, harm-to-others). The flagged text is neither
   * persisted nor sent to the LLM; the caller should render a CareScreen.
   * The original input is passed back so the caller can restore it if the
   * user taps "this wasn't what I meant".
   */
  onCare?: (originalInput: string) => void;
  /** Room home: echo the user's line into the chat transcript on send. */
  onRoomSubmitEcho?: (text: string) => void;
  /** Room home: true during fragment fetch, fragment sort UI, or analysis. */
  onRoomBusyChange?: (busy: boolean) => void;
  /**
   * Optional seed text. When `prefillToken` changes to a new value, the
   * composer's textarea is re-seeded with `initialText`. Lets callers
   * prefill the composer imperatively (e.g. "Free write from today's
   * prompt") even with the same text multiple times.
   */
  initialText?: string;
  prefillToken?: number;
  /** Softer chrome when nested inside HomeStage so one tray owns the frame. */
  embedded?: boolean;
  /** Journal-style home: pill field + inline send + outer voice control. */
  layout?: "default" | "journal" | "room";
}

// The first three are inner-monologue style — thoughts the user might
// actually be holding. The fourth is a quieter instructional line that
// gently signals past writing is welcome too: a journal page, an old note,
// a draft that still has weight.
const PLACEHOLDER_PROMPTS = [
  "I have too many ideas and don't know what to focus on.",
  "I know what I need to do, but I'm not doing it.",
  "Paste something old.",
  "I can't tell what matters most right now.",
];

const SIFTING_SUBLINES = [
  "Finding what matters",
  "Separating signal from noise",
  "Making sense of this",
];

const FRAGMENT_FETCH_LINE = "Pulling out threads…";

const JOURNAL_PLACEHOLDER = "Start a conversation";
const ROOM_PLACEHOLDER = "Share anything...";

export function Composer({
  onResult,
  onRedundancyGate,
  onCare,
  onRoomSubmitEcho,
  onRoomBusyChange,
  initialText,
  prefillToken,
  embedded = false,
  layout = "default",
}: ComposerProps) {
  // If the caller mounts this composer already holding a non-zero prefillToken
  // (e.g. the continuation composer in the expanding flow, which bumps the
  // token before mount), seed the input on mount. The main composer mounts
  // with token=0 and stays empty so placeholder rotation still works.
  const [input, setInput] = useState(() =>
    prefillToken && initialText ? initialText : "",
  );
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [interim, setInterim] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recRef = useRef<RecognitionHandle | null>(null);
  const voiceSupported = isVoiceSupported();
  const { toast } = useToast();
  const modeRef = useRef<"text" | "voice">("text");

  const [siftingIdx, setSiftingIdx] = useState(0);
  // Clarification fallback state. When the initial submission is too thin,
  // we swap the composer UI for a single-question prompt; the user's answer
  // is then merged with the original input and submitted through the same
  // analysis path. `clarifyInput` holds the original text while the prompt
  // is shown.
  const [clarifyInput, setClarifyInput] = useState<string | null>(null);

  /** Quick fragment sort before the main analysis pass */
  const [sortPhase, setSortPhase] = useState<null | {
    fragments: string[];
    inputSnapshot: string;
    classifications: Record<number, FragmentBucket | null>;
  }>(null);
  /** Which loading message to show under the composer */
  const [loadingStage, setLoadingStage] = useState<null | "fragments" | "full">(
    null,
  );

  useEffect(() => {
    if (layout !== "room" || !onRoomBusyChange) return;
    onRoomBusyChange(loading || sortPhase !== null);
  }, [layout, loading, sortPhase, onRoomBusyChange]);

  useEffect(() => () => recRef.current?.stop(), []);

  useEffect(() => {
    const onFocusComposer = () => {
      const el = textareaRef.current;
      if (!el) return;
      if (layout !== "room") {
        try {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch {
          /* ignore */
        }
      }
      requestAnimationFrame(() => {
        el.focus();
        const len = el.value.length;
        try {
          el.setSelectionRange(len, len);
        } catch {
          /* ignore */
        }
      });
    };
    window.addEventListener("sift:focus-composer", onFocusComposer);
    return () => window.removeEventListener("sift:focus-composer", onFocusComposer);
  }, [layout]);

  // Re-seed the composer whenever `prefillToken` changes. Using a token
  // (instead of keying on the text) lets callers prefill with the same seed
  // multiple times even if the user has edited or cleared the textarea.
  // Skip the initial mount — only re-seed on subsequent token changes.
  const isFirstPrefillRef = useRef(true);
  useEffect(() => {
    if (isFirstPrefillRef.current) {
      isFirstPrefillRef.current = false;
      return;
    }
    if (prefillToken === undefined || !initialText) return;
    setInput(initialText);
    modeRef.current = "text";
    // Focus + place caret at the end so the user can keep typing.
    // Defer so the state update lands before we touch the DOM.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      if (layout !== "room") {
        try {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch {
          // older browsers — ignore.
        }
      }
      el.focus();
      const len = initialText.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        // ignore — some browsers may throw on readonly inputs.
      }
    });
  }, [prefillToken, layout]);

  // Rotate the "Sifting…" subline every 2.2s while the full analysis runs.
  useEffect(() => {
    if (!loading || loadingStage !== "full") {
      setSiftingIdx(0);
      return;
    }
    const id = setInterval(
      () => setSiftingIdx((i) => (i + 1) % SIFTING_SUBLINES.length),
      2200,
    );
    return () => clearInterval(id);
  }, [loading, loadingStage]);

  useEffect(() => {
    if (!loading) return;
    if (loadingStage === "fragments") {
      window.dispatchEvent(
        new CustomEvent(SIFT_LUMA_MOOD_EVENT, { detail: "think" as LumaMood }),
      );
    } else if (loadingStage === "full") {
      window.dispatchEvent(
        new CustomEvent(SIFT_LUMA_MOOD_EVENT, { detail: "process" as LumaMood }),
      );
    }
  }, [loading, loadingStage]);

  useEffect(() => {
    if (loading) return;
    if (sortPhase || clarifyInput) {
      window.dispatchEvent(
        new CustomEvent(SIFT_LUMA_MOOD_EVENT, { detail: "listen" as LumaMood }),
      );
      return;
    }
    window.dispatchEvent(
      new CustomEvent(SIFT_LUMA_MOOD_EVENT, {
        detail: (input.trim() ? "listen" : "idle") as LumaMood,
      }),
    );
  }, [loading, loadingStage, input, sortPhase, clarifyInput]);

  // Rotate placeholder every 3s, but pause while focused or while user has typed something.
  useEffect(() => {
    if (layout === "journal") return;
    if (focused || input || recording) return;
    const id = setInterval(
      () => setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_PROMPTS.length),
      3000,
    );
    return () => clearInterval(id);
  }, [focused, input, recording, layout]);

  const startVoice = () => {
    if (!voiceSupported) {
      toast({
        title: "Voice not supported",
        description:
          "Your browser doesn't support voice input. Try Chrome or Edge on desktop.",
      });
      return;
    }
    modeRef.current = "voice";
    const baseline = input.trim();
    recRef.current = createRecognizer({
      onResult: (t, isFinal) => {
        if (isFinal) {
          setInput((baseline ? baseline + "\n\n" : "") + t);
          setInterim("");
        } else {
          setInterim(t);
        }
      },
      onError: (msg) => {
        toast({ title: "Voice error", description: msg });
        setRecording(false);
      },
      onEnd: () => setRecording(false),
    });
    recRef.current?.start();
    setRecording(true);
  };

  const stopVoice = () => {
    recRef.current?.stop();
    setRecording(false);
  };

  // Submit raw text straight to the analysis endpoint. Used both by the
  // initial submission (after the thin-input gate passes) and by the
  // clarification branch (which merges the original input with the answer).
  const runSift = async (
    text: string,
    fragmentOpts?: {
      fragmentSort?: { fragment: string; bucket: FragmentBucket }[];
      skippedFragmentSort?: boolean;
      forceAnalysis?: boolean;
    },
  ) => {
    setLoading(true);
    setLoadingStage("full");
    try {
      const body: Record<string, unknown> = {
        input: text,
        inputMode: modeRef.current,
      };
      if (fragmentOpts?.forceAnalysis) {
        body.forceAnalysis = true;
      }
      if (fragmentOpts?.skippedFragmentSort) {
        body.skippedFragmentSort = true;
      } else if (fragmentOpts?.fragmentSort?.length) {
        body.fragmentSort = fragmentOpts.fragmentSort;
      }
      const res = await apiRequest("POST", "/api/sift", body);
      const data = (await res.json()) as
        | SiftResult
        | CareResponse
        | SiftRedundancyGateResult;
      if (isCareResponse(data)) {
        if (onCare) onCare(text);
        return;
      }
      if (isRedundancyGateResult(data)) {
        if (onRedundancyGate) onRedundancyGate(data);
        return;
      }
      let out = data as SiftResult;
      queryClient.invalidateQueries({ queryKey: ["/api/sifts"] });
      onResult(out);
      setInput("");
      setInterim("");
      setClarifyInput(null);
      setSortPhase(null);
      modeRef.current = "text";
    } catch (err: any) {
      toast({
        title: "Couldn't sift that",
        description: err?.message ?? "Try again in a moment.",
      });
    } finally {
      setLoading(false);
      setLoadingStage(null);
    }
  };

  const beginFragmentSort = async (text: string) => {
    setLoading(true);
    setLoadingStage("fragments");
    try {
      const res = await apiRequest("POST", "/api/sift/fragments", {
        input: text,
      });
      const data = await res.json();
      if (isCareResponse(data)) {
        if (onCare) onCare(text);
        return;
      }
      const fragments = (data as { fragments?: string[] }).fragments ?? [];
      if (fragments.length < 4) {
        await runSift(text, { skippedFragmentSort: true });
        return;
      }
      setSortPhase({
        fragments,
        inputSnapshot: text,
        classifications: Object.fromEntries(
          fragments.map((_, i) => [i, null]),
        ) as Record<number, FragmentBucket | null>,
      });
    } catch {
      await runSift(text, { skippedFragmentSort: true });
    } finally {
      setLoading(false);
      setLoadingStage(null);
    }
  };

  const submit = async () => {
    const text = input.trim();
    if (!text) return;
    if (recording) stopVoice();
    if (layout === "room" && onRoomSubmitEcho) onRoomSubmitEcho(text);
    // Thin-input gate — show the clarification prompt instead of sending.
    // The original text stays in the composer state so "Edit my thought"
    // returns the user cleanly to what they typed.
    if (isThinInput(text)) {
      setClarifyInput(text);
      return;
    }
    await beginFragmentSort(text);
  };

  const submitClarification = async (answer: string) => {
    const base = clarifyInput ?? input.trim();
    if (!base) return;
    // Merge the original thought with the clarification answer. Labeled so
    // the model sees both passes as one coherent submission.
    const merged = `${base}\n\nOne more angle: ${answer}`;
    if (layout === "room" && onRoomSubmitEcho) {
      onRoomSubmitEcho(`Add: ${answer.trim()}`);
    }
    await beginFragmentSort(merged);
  };

  const finishFragmentSort = (skipped: boolean) => {
    if (!sortPhase) return;
    const text = sortPhase.inputSnapshot;
    if (skipped) {
      setSortPhase(null);
      void runSift(text, { skippedFragmentSort: true });
      return;
    }
    const allAnswered = sortPhase.fragments.every(
      (_, i) => sortPhase.classifications[i] !== null,
    );
    if (!allAnswered) {
      toast({
        title: "Sort each line",
        description:
          "Pick Matters, Noise, or Not sure for every line — or tap Skip sorting.",
      });
      return;
    }
    const fragmentSort = sortPhase.fragments
      .map((fragment, i) => ({
        fragment,
        bucket: sortPhase.classifications[i],
      }))
      .filter(
        (x): x is { fragment: string; bucket: FragmentBucket } =>
          x.bucket !== null,
      );
    if (fragmentSort.length === 0) {
      toast({
        title: "Pick one line",
        description: "Mark at least one fragment, or skip this step.",
      });
      return;
    }
    setSortPhase(null);
    void runSift(text, { fragmentSort });
  };

  const setFragmentBucket = (index: number, bucket: FragmentBucket) => {
    setSortPhase((sp) => {
      if (!sp) return sp;
      return {
        ...sp,
        classifications: { ...sp.classifications, [index]: bucket },
      };
    });
  };

  const pickFragmentBucket = (index: number, bucket: FragmentBucket) => {
    if (!sortPhase) return;
    const n = sortPhase.fragments.length;
    if (index < 0 || index >= n) return;
    setFragmentBucket(index, bucket);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const displayText = recording && interim ? input + (input ? " " : "") + interim : input;

  if (clarifyInput !== null) {
    return (
      <ClarifyPrompt
        originalInput={clarifyInput}
        submitting={loading}
        onAnswer={submitClarification}
        onCancel={() => setClarifyInput(null)}
      />
    );
  }

  if (sortPhase) {
    const n = sortPhase.fragments.length;
    const firstOpen = sortPhase.fragments.findIndex(
      (_, i) => sortPhase.classifications[i] === null,
    );
    const allAnswered = firstOpen === -1;
    const roomShell = embedded && layout === "room";

    return (
      <div className="relative" data-testid="composer">
        <div
          className={cn(
            "mx-auto w-full max-w-[min(92vw,52ch)] space-y-5 px-2 py-2 sm:px-3",
            roomShell
              ? "rounded-2xl border border-white/45 bg-card/80 py-5 shadow-lg shadow-black/12 backdrop-blur-md dark:border-white/12 dark:bg-black/45"
              : "rounded-2xl border border-border/55 bg-card/65 p-5 shadow-[var(--shadow-md)] backdrop-blur-sm md:p-6",
          )}
        >
          <p
            className={cn("mb-1 w-full text-[12px] leading-snug text-muted-foreground")}
          >
            Quick scan — tap what each line feels like.
          </p>

          <div
            className="flex items-center justify-between gap-3"
            data-testid="fragment-sort-progress"
          >
            <p
              className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground/80"
            >
              {allAnswered
                ? `Sorted · ${n} of ${n}`
                : `Line ${firstOpen + 1} of ${n}`}
            </p>
            <div className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
              {sortPhase.fragments.map((_, i) => {
                const assigned = sortPhase.classifications[i];
                return (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      assigned === null ? "w-1.5 bg-border" : "w-2.5",
                      assigned === "matters" && "bg-primary/75",
                      assigned === "noise" && "bg-muted-foreground/50",
                      assigned === "unsure" && "bg-muted-foreground/30",
                    )}
                  />
                );
              })}
            </div>
          </div>

          <div className="mx-auto w-full max-w-[46ch] space-y-1">
            {sortPhase.fragments.map((fragment, lineIndex) => {
              const picked = sortPhase.classifications[lineIndex];
              const needsAttention =
                firstOpen !== -1 &&
                lineIndex === firstOpen &&
                picked === null;
              return (
                <div
                  key={lineIndex}
                  className={cn(
                    "mb-3 w-full space-y-1.5 last:mb-0",
                    needsAttention &&
                      "-mx-1 rounded-lg bg-primary/[0.06] px-2 py-2 ring-1 ring-primary/20 sm:-mx-0",
                  )}
                  data-testid={`fragment-sort-row-${lineIndex}`}
                >
                  <p
                    className={cn(
                      "text-[12.5px] leading-snug text-foreground/85",
                    )}
                  >
                    {fragment}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                    {(["matters", "noise", "unsure"] as FragmentBucket[]).map(
                      (b) => (
                        <button
                          type="button"
                          key={b}
                          data-testid={`fragment-${lineIndex}-${b}`}
                          onClick={() => pickFragmentBucket(lineIndex, b)}
                          disabled={loading}
                          className={cn(
                            "transition-colors disabled:opacity-50",
                            picked === b
                              ? "text-foreground underline decoration-primary/70 [text-decoration-thickness:1.5px] [text-underline-offset:4px]"
                              : "text-muted-foreground/70 hover:text-foreground",
                          )}
                        >
                          {b === "matters"
                            ? "Matters"
                            : b === "noise"
                              ? "Noise"
                              : "Not sure"}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {allAnswered ? (
            <p
              className="text-[12px] leading-relaxed text-muted-foreground"
              data-testid="fragment-sort-wrap-up"
            >
              Every line has a sort. Continue when you are ready — tap any line
              to change it.
            </p>
          ) : null}

          <div
            className={cn(
              "flex flex-wrap items-center gap-5 border-t pt-3",
              roomShell ? "border-border/40 dark:border-white/15" : "border-border/60",
            )}
          >
            <button
              type="button"
              onClick={() => finishFragmentSort(false)}
              disabled={loading || !allAnswered}
              data-testid="button-fragment-continue"
              className={cn(
                "text-sm underline underline-offset-4 transition-colors disabled:opacity-45",
                roomShell
                  ? "text-foreground decoration-primary/45 hover:decoration-primary"
                  : "text-foreground/85 decoration-border hover:text-foreground hover:decoration-foreground",
              )}
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => finishFragmentSort(true)}
              disabled={loading}
              data-testid="button-fragment-skip"
              className={cn(
                "text-xs transition-colors disabled:opacity-50",
                roomShell
                  ? "text-muted-foreground/85 hover:text-foreground"
                  : "text-muted-foreground/80 hover:text-foreground",
              )}
            >
              Skip sorting
            </button>
            <button
              type="button"
              onClick={() => setSortPhase(null)}
              disabled={loading}
              className={cn(
                "text-xs transition-colors disabled:opacity-50",
                roomShell
                  ? "text-muted-foreground/70 hover:text-foreground"
                  : "text-muted-foreground/60 hover:text-foreground",
              )}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (embedded && (layout === "journal" || layout === "room")) {
    const room = layout === "room";
    return (
      <div className="relative w-full max-w-xl mx-auto" data-testid="composer">
        <div
          className={cn(
            "flex min-h-[3rem] w-full items-end gap-0.5 px-1 py-1 transition-colors duration-200",
            room
              ? "rounded-full border border-white/55 bg-[#efe8dc]/92 pl-3.5 backdrop-blur-md shadow-[0_12px_40px_-12px_rgba(15,70,70,0.14),0_2px_12px_-6px_rgba(15,70,70,0.06)]"
              : "rounded-full border bg-background/95 pl-3 shadow-sm",
            !room && recording ? "border-primary/40" : !room && "border-border/50",
            room && recording && "border-teal-600/35 ring-1 ring-teal-600/18",
          )}
        >
          <Textarea
            ref={textareaRef}
            data-testid="input-thoughts"
            value={displayText}
            onChange={(e) => {
              modeRef.current = recording ? "voice" : "text";
              setInput(e.target.value);
              setInterim("");
            }}
            onKeyDown={handleKey}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={loading}
            placeholder={room ? ROOM_PLACEHOLDER : JOURNAL_PLACEHOLDER}
            rows={1}
            className={cn(
              "min-h-[2.5rem] max-h-[7rem] flex-1 resize-none border-0 bg-transparent py-2.5 pr-1 text-[15px] leading-snug focus-visible:ring-0",
              room
                ? "text-teal-950 placeholder:text-teal-800/42"
                : "placeholder:text-muted-foreground/55",
            )}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={recording ? stopVoice : startVoice}
            disabled={loading || !voiceSupported}
            data-testid="button-voice"
            aria-label={recording ? "Stop recording" : "Start voice input"}
            title={
              voiceSupported
                ? recording
                  ? "Stop recording"
                  : "Speak your thoughts"
                : "Voice not supported in this browser"
            }
            className={cn(
              "h-9 w-9 shrink-0 rounded-full",
              room
                ? "text-teal-900/40 hover:bg-teal-950/[0.06] hover:text-teal-900/75"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              recording && !room && "text-primary hover:text-primary hover:bg-primary/10",
              recording && room && "text-teal-700 hover:text-teal-800",
            )}
          >
            {recording ? (
              <MicOff className="w-4 h-4" aria-hidden />
            ) : (
              <Mic className="w-4 h-4" aria-hidden />
            )}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="default"
            onClick={submit}
            disabled={loading || !input.trim()}
            data-testid="button-sift"
            className={cn(
              "h-9 w-9 shrink-0 rounded-full",
              room &&
                "border-0 bg-teal-600 text-white shadow-md shadow-teal-900/20 hover:bg-teal-700 hover:text-white focus-visible:ring-teal-500 disabled:bg-teal-600/35",
            )}
            aria-label="Send"
          >
            {loading ? (
              <Sparkles className="w-4 h-4 animate-pulse" aria-hidden />
            ) : room ? (
              <Send className="w-4 h-4 translate-x-px translate-y-px" aria-hidden />
            ) : (
              <ArrowUp className="w-4 h-4" aria-hidden />
            )}
          </Button>
        </div>
        {loading && !(layout === "room" && onRoomBusyChange) ? (
          <div
            className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"
            data-testid="sifting-subline"
            aria-live="polite"
          >
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-primary inline-block" />
            <span
              key={loadingStage === "full" ? siftingIdx : "frag"}
              className={loadingStage === "full" ? "fade-in-slow" : ""}
            >
              {loadingStage === "fragments"
                ? FRAGMENT_FETCH_LINE
                : SIFTING_SUBLINES[siftingIdx]}
            </span>
          </div>
        ) : !loading ? (
          <p
            className={cn(
              "mt-2.5 text-center text-[11px] leading-relaxed",
              room ? "text-muted-foreground/75" : "text-muted-foreground/70",
            )}
          >
            {room ? "Messy is fine · ⌘ Enter to send" : "⌘ Enter to sift · Messy is fine."}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative" data-testid="composer">
      <div
        className={[
          "relative rounded-2xl border bg-card transition-all duration-200 ease-smooth",
          recording
            ? "border-primary/40 shadow-xl shadow-primary/10 ring-1 ring-primary/15"
            : embedded
              ? "rounded-[1.35rem] border border-border/40 bg-muted/[0.12] dark:bg-muted/[0.14] shadow-inner shadow-black/[0.04] ring-1 ring-black/[0.03] dark:ring-white/[0.05]"
              : "border-card-border shadow-md ring-1 ring-black/[0.02] dark:ring-white/[0.04]",
        ].join(" ")}
      >
        <Textarea
          ref={textareaRef}
          data-testid="input-thoughts"
          value={displayText}
          onChange={(e) => {
            modeRef.current = recording ? "voice" : "text";
            setInput(e.target.value);
            setInterim("");
          }}
          onKeyDown={handleKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={loading}
          placeholder={PLACEHOLDER_PROMPTS[placeholderIdx]}
          className="min-h-[11.5rem] md:min-h-[13.5rem] resize-none border-0 bg-transparent px-5 py-5 md:px-7 md:py-6 text-base md:text-[17px] leading-relaxed focus-visible:ring-0 placeholder:text-muted-foreground/60 placeholder:transition-opacity"
        />

        <div className="flex items-center justify-between gap-3 px-3 md:px-4 py-3 border-t border-border/60">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={recording ? "default" : "ghost"}
              size="sm"
              onClick={recording ? stopVoice : startVoice}
              disabled={loading || !voiceSupported}
              data-testid="button-voice"
              aria-label={recording ? "Stop recording" : "Start voice input"}
              className={recording ? "gap-2" : "gap-2 text-muted-foreground hover:text-foreground"}
              title={
                voiceSupported
                  ? recording
                    ? "Stop recording"
                    : "Speak your thoughts"
                  : "Voice not supported in this browser"
              }
            >
              {recording ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span className="hidden sm:inline">Stop</span>
                  <WaveBars />
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span className="hidden sm:inline">Speak</span>
                </>
              )}
            </Button>

            <span className="text-xs text-muted-foreground hidden md:inline">
              {recording ? "Listening…" : voiceSupported ? "Type or speak" : "Typing only"}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <ComposerModePill input={input} />
            <Button
              type="button"
              onClick={submit}
              disabled={loading || !input.trim()}
              data-testid="button-sift"
              className="gap-2"
            >
              {loading ? (
                <>
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  Sifting…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Sift
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      {loading ? (
        <div
          className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"
          data-testid="sifting-subline"
          aria-live="polite"
        >
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-primary inline-block" />
          <span
            key={loadingStage === "full" ? siftingIdx : "frag"}
            className={loadingStage === "full" ? "fade-in-slow" : ""}
          >
            {loadingStage === "fragments"
              ? FRAGMENT_FETCH_LINE
              : SIFTING_SUBLINES[siftingIdx]}
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-3 text-center">
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/60">
            ⌘
          </kbd>{" "}
          +{" "}
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/60">
            Enter
          </kbd>{" "}
          to sift
        </p>
      )}
    </div>
  );
}

// ComposerModePill — a quiet preview of what the server will route to.
// Mirrors server/routes.ts routeThread() via previewModeFromInput. The
// server remains the source of truth; this is a visual hint so the user
// can see Personal/Operator before they submit. Hidden on short input
// where the routing signal is too thin to be honest.
function ComposerModePill({ input }: { input: string }) {
  const trimmed = input.trim();
  // Below ~6 words there isn't enough signal to honestly preview. The
  // server applies its own thin-input gate after submit; the pill stays
  // silent here so it doesn't flicker on every keystroke.
  if (trimmed.split(/\s+/).filter(Boolean).length < 6) return null;
  const mode = previewModeFromInput(trimmed);
  const label = mode === "operator" ? "Operator" : "Personal";
  const className =
    mode === "operator"
      ? "inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-primary/80"
      : "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/85";
  return (
    <span
      className={className}
      data-testid={`pill-composer-mode-${mode}`}
      title={
        mode === "operator"
          ? "This looks like work — Sift will route as Operator."
          : "This looks personal — Sift will route as Personal."
      }
    >
      <span
        aria-hidden="true"
        className={
          mode === "operator"
            ? "h-1.5 w-1.5 rounded-full bg-primary/70"
            : "h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
        }
      />
      {label}
    </span>
  );
}

function WaveBars() {
  return (
    <span className="inline-flex items-end gap-0.5 ml-1 h-3">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="wave-bar block w-0.5 bg-current rounded-full h-full origin-bottom"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

/** Thread id to pin when highlighting smart re-entry (compare uses current sift id). */
export function reentrySuggestedThreadId(
  data: ReEntryResponse | undefined,
): string | null {
  const a = data?.action;
  if (!a) return null;
  if (a.type === "compare") return a.currentSiftId;
  return a.threadId;
}

/** One contextual prompt for returning users — home / threads compose surfaces */
export function ReEntryBlock({
  enabled,
  variant = "card",
  onDismiss,
}: {
  enabled: boolean;
  variant?: "card" | "strip";
  onDismiss?: () => void;
}) {
  const [sessionDismissed, setSessionDismissed] = useState(() => {
    try {
      return (
        typeof window !== "undefined" &&
        sessionStorage.getItem("sift.reentry.dismiss") === "1"
      );
    } catch {
      return false;
    }
  });

  const { data } = useQuery<ReEntryResponse>({
    queryKey: ["/api/reentry"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/reentry");
      return res.json();
    },
    enabled: enabled && !sessionDismissed,
    staleTime: 60_000,
  });

  if (!enabled || sessionDismissed || !data?.prompt || !data.action) {
    return null;
  }

  const { prompt, action } = data;

  const primaryHref = reentryPrimaryHref(action);
  const primaryLabel = reentryPrimaryLabel(action);

  const dismiss = () => {
    try {
      sessionStorage.setItem("sift.reentry.dismiss", "1");
    } catch {
      /* ignore */
    }
    setSessionDismissed(true);
    onDismiss?.();
  };

  if (variant === "strip") {
    return (
      <div
        className="mb-6 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 md:px-5 md:py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        data-testid="reentry-strip"
      >
        <p className="text-sm text-muted-foreground leading-snug flex-1 min-w-0">
          {prompt}
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 shrink-0">
          <Link href={primaryHref}>
            <a className="text-sm font-medium text-foreground/90 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors">
              {primaryLabel}
            </a>
          </Link>
          <button
            type="button"
            onClick={dismiss}
            data-testid="reentry-dismiss"
            className="text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            not now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mb-8 rounded-2xl border border-border/60 bg-card/40 px-5 py-5 md:px-6 md:py-6"
      data-testid="reentry-block"
    >
      <p className="text-base md:text-[17px] text-muted-foreground/90 leading-relaxed">
        {prompt}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link href={primaryHref}>
          <a className="text-sm text-foreground/85 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors">
            {primaryLabel}
          </a>
        </Link>
        <button
          type="button"
          onClick={dismiss}
          data-testid="reentry-dismiss"
          className="text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          not now
        </button>
      </div>
    </div>
  );
}

/** High redundancy gate — minimal surface before forcing analysis or mastery ack */
export function RedundancyGateCard({
  gate,
  onSomethingChanged,
  onKnowThis,
}: {
  gate: SiftRedundancyGateResult;
  onSomethingChanged: () => void | Promise<void>;
  onKnowThis: () => void | Promise<void>;
}) {
  const { redundancyGate: payload } = gate;
  return (
    <article className="fade-up space-y-8 max-w-3xl" data-testid="redundancy-gate">
      <p className="text-base md:text-[17px] text-foreground leading-relaxed">
        {payload.message}
      </p>
      <div>
        <p className="text-xs text-muted-foreground/80 mb-3">
          Here's what you found last time:
        </p>
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5 md:p-6">
          <p
            className="font-serif text-xl md:text-2xl leading-snug text-foreground"
            data-testid="text-gate-prior-step"
          >
            {payload.priorNextStep}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        <button
          type="button"
          data-testid="button-gate-something-changed"
          onClick={() => void onSomethingChanged()}
          className="text-sm text-foreground/85 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
        >
          {payload.options[0]}
        </button>
        <button
          type="button"
          data-testid="button-gate-know-this"
          onClick={() => void onKnowThis()}
          className="text-sm text-foreground/85 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
        >
          {payload.options[1]}
        </button>
      </div>
    </article>
  );
}

// ---------- Result ----------

interface ResultProps {
  result: SiftResult;
  onReset?: () => void;
  readOnly?: boolean;
  /**
   * When provided, the Result renders the post-response decision row:
   *   "Expand on this now"  |  "Come back to this later"
   * If omitted, the original action row (Share / Copy / Sift again) is rendered instead.
   */
  showFollowup?: boolean;
  /** Primary "Expand on this now" action. Switches the page into the expanding flow. */
  onExpand?: () => void;
  /** Primary "Come back to this later" action. Navigates to /s/:id or opens auth. */
  onCheckInLater?: () => void;
  /** Secondary "Save this" link. Usually opens auth dialog. Omit to hide. */
  onSave?: () => void;
  /** Saved-thread / permalink view: fewer nested boxes and borders. */
  quietChrome?: boolean;
}

export function Result({
  result,
  onReset,
  readOnly,
  showFollowup,
  onExpand,
  onCheckInLater,
  onSave,
  quietChrome = false,
}: ResultProps) {
  const { toast } = useToast();
  const [copiedText, setCopiedText] = useState(false);
  // Opens the standalone share card (same pattern as the daily prompt share).
  // Only the Quiet reflection travels — the full sift stays private unless
  // the viewer explicitly copies it as text.
  const [reflectionShareOpen, setReflectionShareOpen] = useState(false);

  // Soft interpretation state for "What this may be pointing to".
  // `view` is the currently displayed analysis (matters/noise, intent, next
  // step, reflection). It starts as the original result and is replaced in place
  // when the user submits a correction — the read and the rest of the result
  // refresh together so they stay coherent with the updated intent.
  // fitState tracks the small action row: null = show actions, "fits" = quietly
  // confirmed, "skipped" = hidden, "editing" = inline correction visible.
  const [view, setView] = useState<SiftResult>(result);
  const [fitState, setFitState] = useState<
    null | "fits" | "skipped" | "editing"
  >(null);
  // Quiet exhale: when the user chooses to let this sift rest, we swap
  // the followup row for a calm acknowledgment. No CTAs, no pressure —
  // just a soft close. They can still sift again from inside the panel
  // if something else surfaces, but the moment is allowed to end.
  const [resting, setResting] = useState(false);
  const [correction, setCorrection] = useState("");
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);
  const [closurePromptDismissed, setClosurePromptDismissed] = useState(false);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);
  const [breakdownFadeIn, setBreakdownFadeIn] = useState(false);
  // Step-check negotiation. The proposed step is a proposal, not a final
  // answer — the user replies with one of three options. "fits" quietly
  // confirms; "smaller" / "different" ask the server for a revised step
  // on the same underlying signal. We track loading so the row can dim
  // while the model re-spins the move.
  const [stepCheck, setStepCheck] = useState<null | "fits">(null);
  const [stepRevising, setStepRevising] = useState<
    null | "smaller" | "different" | "guided"
  >(null);
  const [stepFeedbackOpen, setStepFeedbackOpen] = useState(false);
  const [stepFeedbackDraft, setStepFeedbackDraft] = useState("");
  const [stepRevisionFadeIn, setStepRevisionFadeIn] = useState(false);
  // Signal/noise starts folded so the load-bearing move lands first; readers
  // open "Show signal & noise" when they want the split—not as an ambush.
  const [signalExpanded, setSignalExpanded] = useState(false);
  const checkinSig =
    result.checkins?.map((c) => c.id).join(",") ?? "";

  useEffect(() => {
    setView(result);
    setFitState(null);
    setResting(false);
    setCorrection("");
    setCorrectionSubmitting(false);
    setClosurePromptDismissed(false);
    setBreakdownLoading(false);
    setBreakdownError(null);
    setBreakdownFadeIn(false);
    setStepCheck(null);
    setStepRevising(null);
    setStepRevisionFadeIn(false);
    setStepFeedbackOpen(false);
    setStepFeedbackDraft("");
    setSignalExpanded(false);
  }, [
    result.id,
    result.coreIntent,
    result.nextStep,
    checkinSig,
    JSON.stringify(result.microTasks ?? null),
  ]);

  const requestBreakdown = async () => {
    if (!view.mine || readOnly || breakdownLoading) return;
    setBreakdownError(null);
    setBreakdownLoading(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const token = getAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(
        `/api/sift/${encodeURIComponent(view.id)}/breakdown`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ nextStep: view.nextStep }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        microTasks?: string[];
        error?: string;
      };
      if (res.status === 422) {
        setBreakdownError(
          typeof data.error === "string"
            ? data.error
            : "Could not break this down — try rephrasing the step.",
        );
        setBreakdownLoading(false);
        return;
      }
      if (!res.ok) {
        setBreakdownError(
          "Could not break this down — try rephrasing the step.",
        );
        setBreakdownLoading(false);
        return;
      }
      const tasks = data.microTasks;
      if (!Array.isArray(tasks) || tasks.length !== 3) {
        setBreakdownError(
          "Could not break this down — try rephrasing the step.",
        );
        setBreakdownLoading(false);
        return;
      }
      setBreakdownFadeIn(true);
      setView((v) => ({ ...v, microTasks: tasks }));
      setBreakdownLoading(false);
      queryClient.invalidateQueries({ queryKey: ["/api/sift", view.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/sifts"] });
    } catch {
      setBreakdownError(
        "Could not break this down — try rephrasing the step.",
      );
      setBreakdownLoading(false);
    }
  };

  const requestStepRevision = async (
    variant: "smaller" | "different",
    opts?: { feedback?: string },
  ) => {
    if (!view.mine || readOnly || stepRevising) return;
    const fb = opts?.feedback?.trim();
    const loadingKey: "smaller" | "different" | "guided" = fb
      ? "guided"
      : variant;
    setStepRevising(loadingKey);
    setStepCheck(null);
    setStepRevisionFadeIn(false);
    if (!fb) {
      setStepFeedbackOpen(false);
      setStepFeedbackDraft("");
    }
    try {
      const body: { variant: "smaller" | "different"; feedback?: string } = {
        variant,
      };
      if (fb) body.feedback = fb;
      const res = await apiRequest(
        "POST",
        `/api/sift/${encodeURIComponent(view.id)}/revise-step`,
        body,
      );
      const data = (await res.json()) as
        | {
            nextStep?: string;
            stepScope?: { durationEstimate: string; stoppingCondition: string };
            error?: string;
          }
        | CareResponse;
      if (isCareResponse(data)) {
        toast({
          title: "Let's take a breath",
          description: "Try rephrasing gently, or use the footer link.",
        });
        setStepRevising(null);
        return;
      }
      if (!res.ok || !data.nextStep) {
        toast({
          title: "Couldn't revise that step",
          description:
            typeof (data as { error?: string }).error === "string"
              ? (data as { error: string }).error
              : "Try again in a moment.",
        });
        setStepRevising(null);
        return;
      }
      setStepRevisionFadeIn(true);
      setView((v) => ({
        ...v,
        nextStep: data.nextStep!,
        stepScope: data.stepScope ?? v.stepScope,
        // A revised step invalidates the cached micro-tasks. Clearing here
        // matches the server, which sets micro_tasks to NULL on revision.
        microTasks: null,
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/sift", view.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/sifts"] });
      if (fb) {
        setStepFeedbackDraft("");
        setStepFeedbackOpen(false);
      }
    } catch (err: any) {
      toast({
        title: "Couldn't revise that step",
        description: err?.message ?? "Try again in a moment.",
      });
    } finally {
      setStepRevising(null);
    }
  };

  const applyCorrection = async () => {
    const v = correction.trim();
    if (!v || correctionSubmitting) return;
    // Re-run analysis with the original input plus the user's reframe, so
    // every section (the read, next step, reflection) realigns with the
    // updated intent. Falls back to a local intent-only update if the
    // re-analysis call fails.
    setCorrectionSubmitting(true);
    try {
      const res = await apiRequest(
        "PATCH",
        `/api/sift/${encodeURIComponent(view.id)}/correction`,
        { reframe: v },
      );
      const data = (await res.json()) as SiftResult | CareResponse;
      if (isCareResponse(data)) {
        // Crisis screen tripped on the reframe — keep the existing view and
        // surface a calm toast rather than navigating away from the result.
        toast({
          title: "Let's take a breath",
          description: "Try rephrasing this gently, or tap the footer link.",
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/sifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sift", view.id] });
      setView(data);
      setFitState("fits");
      setCorrection("");
    } catch (err: any) {
      // Soft fallback — at least reflect the user's words in the intent.
      setView((v0) => ({ ...v0, coreIntent: v }));
      setFitState("fits");
      setCorrection("");
      toast({
        title: "Couldn't re-sift",
        description: err?.message ?? "Updated here for now.",
      });
    } finally {
      setCorrectionSubmitting(false);
    }
  };

  const patchClosurePrompt = async (keepOpen: boolean) => {
    try {
      await apiRequest(
        "PATCH",
        `/api/sift/${encodeURIComponent(view.id)}/close`,
        keepOpen
          ? { closurePromptShown: true, keepOpen: true }
          : { closurePromptShown: true },
      );
      setClosurePromptDismissed(true);
    } catch (err: unknown) {
      toast({
        title: "Couldn't save that choice",
        description:
          err instanceof Error ? err.message : "Try again in a moment.",
      });
    }
  };

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}#/s/${result.id}`
      : "";

  const connectiveCaption =
    view.signalReason?.trim() ||
    "One possible shape of the move—not the only one.";

  const sortedCheckins = [...(view.checkins ?? [])].sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  const latestCheckin =
    sortedCheckins.length > 0
      ? sortedCheckins[sortedCheckins.length - 1]
      : null;

  /** Matters/noise read; older payloads only had `themes` — fold those in here. */
  const mattersForRead =
    (view.matters?.length ?? 0) > 0
      ? (view.matters ?? [])
      : (view.themes ?? [])
          .map((t) =>
            [t.title?.trim(), t.summary?.trim()].filter(Boolean).join(" — "),
          )
          .filter((line) => line.length > 0);

  const hasSignalRead =
    mattersForRead.length > 0 || (view.noise?.length ?? 0) > 0;

  const copyText = async () => {
    const hasNewFraming = hasSignalRead;
    const connective = connectiveCaption;
    const lines = [
      `Sift — ${new Date(view.createdAt).toLocaleString()}`,
      "",
      `What this may be pointing to:`,
      view.coreIntent,
      "",
    ];
    if (hasNewFraming) {
      lines.push(
        "What matters now:",
        ...(mattersForRead.length > 0
          ? mattersForRead.map((m, i) => `${i + 1}. ${m}`)
          : ["— (not broken out separately on this sift)"]),
        "",
      );
      lines.push(
        "What may be noise right now:",
        ...(view.noise?.length
          ? view.noise.map((n) => `— ${n}`)
          : ["—"]),
        "",
      );
      if (view.signalReason) {
        lines.push("Why this may be the signal:", view.signalReason, "");
      }
    }
    lines.push(
      `A possible next step:`,
      view.nextStep,
      "",
      connective,
      "",
    );
    if (view.stepScope) {
      lines.push(
        `${view.stepScope.durationEstimate} · clear stopping point: ${view.stepScope.stoppingCondition}`,
        "",
      );
    }
    lines.push(
      `Quiet reflection:`,
      view.reflection,
      "",
      shareUrl,
    );
    const body = lines.join("\n");
    try {
      await navigator.clipboard.writeText(body);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 1800);
    } catch {
      toast({ title: "Couldn't copy", description: "Try again." });
    }
  };

  return (
    <article className="fade-up" data-testid="result">
      <div className="space-y-10 md:space-y-12">
        {/* Core intent — softened headline. Presented as a possible read,
            with a quiet inline correction path if it doesn't fit. */}
        <section data-testid="section-intent">
          <Label>What this may be pointing to</Label>
          <p
            className="mt-1.5 text-xs md:text-sm text-muted-foreground/80"
            data-testid="text-intent-helper"
          >
            What you might want underneath this.
          </p>
          <p
            className="font-serif text-2xl md:text-3xl leading-[1.25] text-foreground mt-3"
            data-testid="text-intent"
          >
            {view.coreIntent}
          </p>

          {!readOnly && fitState !== "skipped" && (
            <div className="mt-4" data-testid="row-intent-fit">
              {fitState === "editing" ? (
                <div data-testid="box-intent-correction">
                  <p
                    className="text-sm text-muted-foreground"
                    data-testid="text-intent-correction-prompt"
                  >
                    What feels closer to it?
                  </p>
                  <Textarea
                    value={correction}
                    onChange={(e) => setCorrection(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        applyCorrection();
                      }
                    }}
                    placeholder="In your own words."
                    disabled={correctionSubmitting}
                    data-testid="input-intent-correction"
                    className="mt-2 min-h-[72px] resize-none text-base leading-relaxed"
                  />
                  <div className="mt-2 flex items-center gap-4 text-sm">
                    <button
                      type="button"
                      onClick={applyCorrection}
                      disabled={!correction.trim() || correctionSubmitting}
                      data-testid="button-intent-update"
                      className="text-foreground/85 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors disabled:opacity-50"
                    >
                      {correctionSubmitting ? "Re-sifting\u2026" : "Update this"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFitState(null);
                        setCorrection("");
                      }}
                      disabled={correctionSubmitting}
                      data-testid="link-intent-cancel"
                      className="text-muted-foreground/70 hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : fitState === "fits" ? (
                <p
                  className="text-xs text-muted-foreground/70"
                  data-testid="text-intent-fits"
                >
                  Noted.
                </p>
              ) : (
                <div className="flex items-center gap-5 text-sm">
                  <button
                    type="button"
                    onClick={() => setFitState("fits")}
                    data-testid="button-intent-fits"
                    className="text-foreground/80 hover:text-foreground transition-colors"
                  >
                    That fits
                  </button>
                  <button
                    type="button"
                    onClick={() => setFitState("editing")}
                    data-testid="button-intent-notquite"
                    className="text-foreground/80 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                  >
                    Not quite
                  </button>
                  <button
                    type="button"
                    onClick={() => setFitState("skipped")}
                    data-testid="link-intent-skip"
                    className="text-muted-foreground/70 hover:text-foreground transition-colors"
                  >
                    Skip
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Operator surfaces only when the routed mode is operator. Two
            quiet pills — front-burner rank and the artifact label — sit
            above the next-step card so the user knows the system is
            treating the situation as a live thread inside work. Personal
            mode keeps the simpler card without these affordances. */}
        {view.mode === "operator" &&
        (view.frontBurnerRank != null || view.artifactType) ? (
          <div
            className="flex flex-wrap items-center gap-2 -mt-4"
            data-testid="row-operator-pills"
          >
            {view.frontBurnerRank != null ? (
              <span
                data-testid="pill-front-burner-rank"
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-primary/80"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                Front burner #{view.frontBurnerRank}
              </span>
            ) : null}
            {view.artifactType ? (
              <span
                data-testid="pill-artifact-type"
                className="inline-flex items-center rounded-full border border-border/70 bg-card/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80"
              >
                {artifactTypeLabel(view.artifactType)}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Next step — promoted above the signal/noise grid so the
            load-bearing artifact sits where the eye lands first. The
            step-check chip row sits directly beneath it: the step is
            a proposal, not a final answer (AGENTS.md "step check
            mechanic"). */}
        <section data-testid="section-next">
          <Label>A possible next step</Label>
          <p className="mt-2 text-xs text-muted-foreground/80 leading-relaxed max-w-xl">
            A suggestion to react to—not an assignment. If the read above feels
            off, use{" "}
            <span className="text-foreground/80">Not quite</span> there. If the
            move feels off, use the reactions below—or say what&apos;s missing.
          </p>
          <div
            className={`mt-3 transition-opacity ${
              quietChrome
                ? "rounded-lg border-l-[3px] border-l-primary/40 bg-primary/[0.04] pl-4 pr-3 py-4 md:pl-5 md:pr-4 md:py-5"
                : "rounded-2xl border border-primary/25 bg-primary/5 p-5 md:p-6"
            } ${stepRevising ? "opacity-50" : "opacity-100"}`}
            style={
              stepRevisionFadeIn && !stepRevising
                ? {
                    animation:
                      "fade-in-slow 0.3s cubic-bezier(0.2, 0.7, 0.2, 1) both",
                  }
                : undefined
            }
          >
            <p
              className="font-serif text-xl md:text-2xl leading-snug text-foreground"
              data-testid="text-next-step"
            >
              {view.nextStep}
            </p>
          </div>
          <p
            className="mt-3 text-xs text-muted-foreground/75 leading-relaxed"
            data-testid="text-next-connective"
          >
            {connectiveCaption}
          </p>
          {view.stepScope ? (
            <p
              className="mt-1.5 text-xs text-muted-foreground/75 leading-relaxed"
              data-testid="text-next-scope"
            >
              {view.stepScope.durationEstimate} · clear stopping point:{" "}
              {view.stepScope.stoppingCondition}
            </p>
          ) : null}

          {/* Step-check negotiation. Three quiet chips — "That works" is
              the confirm; "Smaller, please" and "Different angle" each
              re-spin the move on the same signal. Hidden in read-only
              or non-owner views. */}
          {view.mine && !readOnly ? (
            <>
              <div
                className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
                data-testid="row-step-check"
                aria-live="polite"
              >
                {stepRevising ? (
                  <p
                    className="text-xs text-muted-foreground/80"
                    data-testid="text-step-revising"
                  >
                    {stepRevising === "guided"
                      ? "Shaping the step from what you wrote…"
                      : stepRevising === "smaller"
                        ? "Finding a smaller move…"
                        : "Finding a different angle…"}
                  </p>
                ) : stepCheck === "fits" ? (
                  <p
                    className="text-xs text-muted-foreground/70"
                    data-testid="text-step-fits"
                  >
                    Good. The move is yours to take.
                  </p>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setStepCheck("fits")}
                      data-testid="button-step-fits"
                      className="text-foreground/85 hover:text-foreground transition-colors"
                    >
                      That works
                    </button>
                    <span aria-hidden="true" className="text-muted-foreground/40">
                      ·
                    </span>
                    <button
                      type="button"
                      onClick={() => void requestStepRevision("smaller")}
                      data-testid="button-step-smaller"
                      className="text-foreground/85 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                    >
                      Smaller, please
                    </button>
                    <span aria-hidden="true" className="text-muted-foreground/40">
                      ·
                    </span>
                    <button
                      type="button"
                      onClick={() => void requestStepRevision("different")}
                      data-testid="button-step-different"
                      className="text-foreground/85 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                    >
                      Different angle
                    </button>
                  </>
                )}
              </div>
              {!stepRevising && stepCheck !== "fits" ? (
                <div
                  className="mt-3 max-w-xl"
                  data-testid="row-step-guided-feedback"
                >
                  {!stepFeedbackOpen ? (
                    <button
                      type="button"
                      onClick={() => setStepFeedbackOpen(true)}
                      data-testid="button-step-feedback-open"
                      className="text-xs text-muted-foreground/80 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                    >
                      The step still misses what I&apos;m carrying
                    </button>
                  ) : (
                    <div
                      className="space-y-2 rounded-lg border border-border/55 bg-card/45 p-3 md:p-4"
                      data-testid="panel-step-feedback"
                    >
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        A sentence or two is enough. Sift keeps the same read
                        and only changes the move—unless the read is what feels
                        off; then use{" "}
                        <span className="text-foreground/75">Not quite</span>{" "}
                        above.
                      </p>
                      <Textarea
                        value={stepFeedbackDraft}
                        onChange={(e) => setStepFeedbackDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (
                            (e.metaKey || e.ctrlKey) &&
                            e.key === "Enter" &&
                            stepFeedbackDraft.trim()
                          ) {
                            e.preventDefault();
                            void requestStepRevision("different", {
                              feedback: stepFeedbackDraft,
                            });
                          }
                        }}
                        placeholder="e.g. That assumes I have energy tonight—I don’t. Or: it skips the conversation I’m actually avoiding."
                        disabled={!!stepRevising}
                        data-testid="input-step-feedback"
                        className="min-h-[72px] resize-none text-sm leading-relaxed"
                      />
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <button
                          type="button"
                          onClick={() =>
                            void requestStepRevision("different", {
                              feedback: stepFeedbackDraft,
                            })
                          }
                          disabled={
                            !stepFeedbackDraft.trim() || !!stepRevising
                          }
                          data-testid="button-step-feedback-submit"
                          className="text-foreground/85 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors disabled:opacity-50"
                        >
                          Revise from this
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStepFeedbackOpen(false);
                            setStepFeedbackDraft("");
                          }}
                          disabled={!!stepRevising}
                          data-testid="button-step-feedback-cancel"
                          className="text-muted-foreground/70 hover:text-foreground transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          ) : null}

          {view.mine && !readOnly ? (
            <>
              {view.microTasks?.length === 3 ? (
                <div
                  className={`mt-4 px-4 py-3.5 text-sm md:text-[15px] text-foreground leading-relaxed ${
                    quietChrome
                      ? "rounded-lg bg-muted/25"
                      : "rounded-xl border border-border/55 bg-muted/35"
                  }`}
                  data-testid="panel-breakdown-microtasks"
                  style={
                    breakdownFadeIn
                      ? {
                          animation:
                            "fade-in-slow 0.3s cubic-bezier(0.2, 0.7, 0.2, 1) both",
                        }
                      : undefined
                  }
                >
                  <ol className="list-decimal space-y-1.5 pl-5 marker:text-muted-foreground/75">
                    {view.microTasks.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ol>
                </div>
              ) : breakdownLoading ? (
                <p
                  className="mt-3 text-sm text-muted-foreground"
                  aria-live="polite"
                  data-testid="text-breakdown-loading"
                >
                  Finding the smallest move…
                </p>
              ) : breakdownError ? (
                <div className="mt-3 space-y-2" data-testid="panel-breakdown-error">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {breakdownError}
                  </p>
                  <button
                    type="button"
                    data-testid="link-breakdown-retry"
                    onClick={() => {
                      setBreakdownError(null);
                      void requestBreakdown();
                    }}
                    className="text-xs text-muted-foreground/70 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="link-breakdown"
                  onClick={() => void requestBreakdown()}
                  className="mt-3 text-xs text-muted-foreground/70 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                >
                  Break it down
                </button>
              )}
            </>
          ) : null}

          {latestCheckin ? (
            <div
              className="mt-6 pt-6 border-t border-border/60 space-y-4"
              data-testid="checkin-step-diff"
            >
              <div className="space-y-2">
                <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-muted-foreground/80">
                  Originally
                </p>
                <p className="text-sm text-muted-foreground/90 leading-relaxed">
                  {(latestCheckin.priorNextStep ?? view.baselineNextStep)?.trim() ||
                    "—"}
                </p>
              </div>
              <div className="space-y-2 pt-2 border-t border-border/40">
                <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-muted-foreground/80">
                  After reality
                </p>
                <p className="font-serif text-lg md:text-xl text-foreground leading-snug">
                  {latestCheckin.nextStep}
                </p>
              </div>
              {latestCheckin.changeReason ? (
                <p className="text-xs text-muted-foreground/80 leading-relaxed pt-1">
                  {latestCheckin.changeReason}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* The read — signal/noise; older payloads had themes only, folded into the matters list. */}
        {hasSignalRead ? (
          <section data-testid="section-signal" className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <Label>The read underneath</Label>
              <button
                type="button"
                onClick={() => setSignalExpanded((v) => !v)}
                aria-expanded={signalExpanded}
                aria-controls="signal-grid-panel"
                data-testid="button-signal-toggle"
                className="text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                {signalExpanded ? "Quiet this" : "Show signal & noise"}
              </button>
            </div>

            {!signalExpanded ? (
              <p className="text-xs text-muted-foreground/75 leading-relaxed max-w-lg">
                Optional—open when you want to see how Sift split what matters from what may be loud right now.
              </p>
            ) : null}

            {signalExpanded ? (
              <div
                id="signal-grid-panel"
                className="space-y-6 fade-in-slow"
              >
                <div
                  className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10 md:gap-y-8 gap-8"
                  data-testid="section-signal-grid"
                >
                  <section data-testid="section-matters">
                    <Label>What matters now</Label>
                    <ul
                      className={`mt-4 ${
                        quietChrome
                          ? "divide-y divide-border/45"
                          : "divide-y divide-border/70 border-y border-border/70"
                      }`}
                    >
                      {mattersForRead.length > 0 ? (
                        mattersForRead.map((m, i) => (
                          <li
                            key={i}
                            className="py-3.5 md:py-4 flex gap-4 md:gap-6"
                            data-testid={`matters-${i}`}
                          >
                            <span className="font-mono text-xs text-muted-foreground pt-1 w-6">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <p className="flex-1 font-serif text-lg md:text-xl text-foreground leading-snug">
                              {m}
                            </p>
                          </li>
                        ))
                      ) : (
                        <li className="py-3.5 text-sm text-muted-foreground/70 leading-relaxed">
                          Nothing singled out on this side for now.
                        </li>
                      )}
                    </ul>
                  </section>

                  <section data-testid="section-noise">
                    <Label>What may be noise right now</Label>
                    <ul className="mt-4 space-y-2.5">
                      {(view.noise?.length ?? 0) > 0 ? (
                        (view.noise ?? []).map((n, i) => (
                          <li
                            key={i}
                            className="text-sm md:text-[15px] text-muted-foreground/85 leading-relaxed flex gap-3"
                            data-testid={`noise-${i}`}
                          >
                            <span
                              aria-hidden="true"
                              className="text-muted-foreground/50 select-none"
                            >
                              —
                            </span>
                            <span className="flex-1">{n}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-muted-foreground/60 leading-relaxed">
                          Nothing singled out on this side for now.
                        </li>
                      )}
                    </ul>
                  </section>
                </div>

                {view.recurringSignal ? (
                  <p
                    className="text-xs text-muted-foreground/75 leading-relaxed"
                    data-testid="caption-recurring-signal"
                  >
                    This signal has come up before. You may already know what
                    it's pointing to.
                  </p>
                ) : null}

                {view.redundancyHint ? (
                  <p
                    className="text-xs text-muted-foreground/75 leading-relaxed"
                    data-testid="caption-redundancy-hint"
                  >
                    {view.redundancyHint.message}
                  </p>
                ) : null}

                {view.signalReason && (
                  <section data-testid="section-signal-reason">
                    <Label>Why this may be the signal</Label>
                    <p
                      className="mt-3 font-serif text-lg md:text-xl text-foreground leading-relaxed"
                      data-testid="text-signal-reason"
                    >
                      {view.signalReason}
                    </p>
                  </section>
                )}
              </div>
            ) : (
              <p
                className="text-xs text-muted-foreground/70 leading-relaxed"
                data-testid="text-signal-summary"
              >
                {mattersForRead.length}{" "}
                {mattersForRead.length === 1 ? "thing matters" : "things matter"}
                {(view.noise?.length ?? 0) > 0
                  ? `, ${view.noise!.length} may be noise`
                  : ""}
                .
              </p>
            )}
          </section>
        ) : null}

        {/* Reflection */}
        <section data-testid="section-reflection">
          <Label>Quiet reflection</Label>
          <p
            className="mt-3 text-base md:text-[17px] text-muted-foreground italic leading-relaxed"
            data-testid="text-reflection"
          >
            "{view.reflection}"
          </p>
        </section>

        {view.showClosurePrompt && !closurePromptDismissed && !readOnly ? (
          <section
            className="pt-6 mt-2 border-t border-border/50 space-y-4"
            data-testid="closure-prompt"
          >
            <p className="text-sm text-muted-foreground/85 leading-relaxed">
              You've sorted through something like this several times, and your
              reads are landing well. It might be time to close this loop. You
              can always come back if it shifts.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <button
                type="button"
                data-testid="link-close-thread-prompt"
                onClick={() => void patchClosurePrompt(false)}
                className="text-xs text-muted-foreground/70 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
              >
                Close this thread
              </button>
              <button
                type="button"
                data-testid="link-keep-thread-open"
                onClick={() => void patchClosurePrompt(true)}
                className="text-xs text-muted-foreground/70 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
              >
                Keep it open
              </button>
            </div>
          </section>
        ) : null}

        {/* Actions */}
        {showFollowup && !readOnly && resting ? (
          // Quiet exhale: the moment after a sift, when the answer is
          // enough. Replaces the followup row with a calm close. No
          // urgent CTAs — the user can still sift again or come back to
          // this, but they can also just leave.
          <div
            className="pt-2 fade-in-slow"
            data-testid="panel-quiet-exhale"
          >
            <div
              className={
                quietChrome
                  ? "rounded-lg border border-primary/15 bg-primary/[0.03] px-5 py-6 md:px-6 md:py-7"
                  : "rounded-2xl border border-primary/20 bg-primary/5 px-6 py-7 md:px-8 md:py-8"
              }
            >
              <p
                className="text-[11px] tracking-[0.25em] uppercase text-primary/70 mb-3 font-medium"
                data-testid="text-rest-eyebrow"
              >
                Let it rest
              </p>
              <p
                className="font-serif text-xl md:text-2xl leading-snug text-foreground"
                data-testid="text-rest-line"
              >
                That’s enough for now.
              </p>
              <p className="mt-3 text-sm md:text-[15px] text-muted-foreground leading-relaxed">
                Nothing more is required of this thought today. Come
                back when something else surfaces.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              {onCheckInLater && (
                <button
                  type="button"
                  onClick={onCheckInLater}
                  data-testid="link-rest-checkin-later"
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                >
                  Come back to this later
                </button>
              )}
              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  data-testid="link-rest-sift-again"
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                >
                  Sift something else
                </button>
              )}
              <button
                type="button"
                onClick={() => setResting(false)}
                data-testid="link-rest-undo"
                className="text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                Not yet
              </button>
            </div>
          </div>
        ) : showFollowup && !readOnly ? (
          <div className="pt-2" data-testid="followup-row">
            <p
              className="text-sm text-muted-foreground mb-4"
              data-testid="text-followup-microcopy"
            >
              When you&apos;re ready, choose a next move.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {onCheckInLater && (
                <Button
                  type="button"
                  onClick={() => {
                    track("sn.come_back_later");
                    onCheckInLater();
                  }}
                  data-testid="button-checkin-later"
                  className="gap-2"
                >
                  <Clock className="w-4 h-4" />
                  Come back to this later
                </Button>
              )}
              {onExpand && (
                <Button
                  type="button"
                  variant={onCheckInLater ? "outline" : "default"}
                  onClick={() => {
                    track("sn.expand_now");
                    onExpand();
                  }}
                  data-testid="button-expand-now"
                  className="gap-2"
                >
                  <ArrowRight className="w-4 h-4" />
                  Expand on this now
                </Button>
              )}
              <button
                type="button"
                onClick={() => setResting(true)}
                data-testid="link-let-it-rest"
                className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors px-1"
              >
                Let it rest
              </button>
            </div>
            <div
              className="mt-4 flex flex-wrap items-center gap-4 fade-in-slow"
              style={{ animationDelay: "420ms" }}
            >
              {onSave && (
                <button
                  type="button"
                  onClick={onSave}
                  data-testid="link-save-this"
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                >
                  Save this
                </button>
              )}
              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  data-testid="link-try-again"
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                >
                  Try again
                </button>
              )}
            </div>
            {/* Share reflection + copy text — "Share" opens a standalone share
                card (reflection only), matching the daily prompt pattern. */}
            <div
              className="mt-6 flex flex-wrap items-center gap-3 fade-in-slow"
              style={{ animationDelay: "620ms" }}
            >
              <button
                type="button"
                onClick={() => setReflectionShareOpen(true)}
                data-testid="button-share-reflection"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share reflection
              </button>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <button
                type="button"
                onClick={copyText}
                data-testid="button-copy-text"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {copiedText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedText ? "Copied" : "Copy as text"}
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReflectionShareOpen(true)}
              data-testid="button-share-reflection"
              className="gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share reflection
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyText}
              data-testid="button-copy-text"
              className="gap-2"
            >
              {copiedText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedText ? "Copied" : "Copy as text"}
            </Button>
            {!readOnly && onReset && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onReset}
                data-testid="button-reset"
                className="gap-2 text-muted-foreground"
              >
                <RotateCcw className="w-4 h-4" />
                Sift something else
              </Button>
            )}
          </div>
        )}

        {/* Original input (collapsed) */}
        {result.input && (
          <details className="group pt-4 border-t border-border/60" data-testid="details-original">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-2">
              <span className="group-open:rotate-90 transition-transform inline-block">›</span>
              Read the original
            </summary>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-muted-foreground leading-relaxed">
              {result.input}
            </pre>
          </details>
        )}
      </div>

      {/* Standalone reflection share card. Only the reflection travels —
          mirrors the daily prompt share pattern. */}
      <SharePromptDialog
        open={reflectionShareOpen}
        onOpenChange={setReflectionShareOpen}
        eyebrow="From Sift"
        title="Quiet reflection"
        line={view.reflection}
      />
    </article>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px w-6 bg-primary/40" />
      <span className="text-[11px] tracking-[0.2em] uppercase font-medium text-primary/80">
        {children}
      </span>
    </div>
  );
}

// Short, calm labels for the four operator artifact types. These render
// as a small pill above the next-step card in Operator mode only —
// Personal mode hides them entirely.
function artifactTypeLabel(t: NonNullable<SiftResult["artifactType"]>): string {
  switch (t) {
    case "decision_memo":
      return "Decision memo";
    case "project_brief":
      return "Project brief";
    case "stakeholder_brief":
      return "Stakeholder read";
    case "writing_sift":
      return "Writing Sift";
    case "operator_card":
    default:
      return "Operator card";
  }
}

// ---------- Skeleton while thinking ----------

export function Thinking() {
  const [subIdx, setSubIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setSubIdx((i) => (i + 1) % SIFTING_SUBLINES.length),
      2200,
    );
    return () => clearInterval(id);
  }, []);
  return (
    <div className="fade-up space-y-8" data-testid="thinking">
      <div className="flex items-baseline gap-3">
        <span className="pulse-dot h-2 w-2 rounded-full bg-primary shrink-0" />
        <span className="text-base font-medium text-foreground">Sifting…</span>
        <span
          key={subIdx}
          className="text-sm text-muted-foreground fade-in-slow"
          data-testid="text-thinking-subline"
        >
          {SIFTING_SUBLINES[subIdx]}
        </span>
      </div>
      <div className="space-y-3">
        <div className="h-7 w-3/4 rounded bg-muted/70 animate-pulse" />
        <div className="h-7 w-2/3 rounded bg-muted/70 animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-1/2 rounded bg-muted/60 animate-pulse" />
        <div className="h-4 w-11/12 rounded bg-muted/60 animate-pulse" />
        <div className="h-4 w-10/12 rounded bg-muted/60 animate-pulse" />
      </div>
    </div>
  );
}
