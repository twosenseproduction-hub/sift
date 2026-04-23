import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send, Copy, Link2, RotateCcw, Check, Sparkles, Clock, ArrowRight, Share2 } from "lucide-react";
import { SharePromptDialog } from "./share-prompt-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  createRecognizer,
  isVoiceSupported,
  type RecognitionHandle,
} from "@/lib/voice";
import type { SiftResult, CareResponse } from "@shared/schema";
import { isCareResponse } from "@shared/schema";
import { ClarifyPrompt } from "./clarify-prompt";

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
  /**
   * Called when the server screens the submitted input as a crisis signal
   * (suicide, self-harm, harm-to-others). The flagged text is neither
   * persisted nor sent to the LLM; the caller should render a CareScreen.
   * The original input is passed back so the caller can restore it if the
   * user taps "this wasn't what I meant".
   */
  onCare?: (originalInput: string) => void;
  /**
   * Optional seed text. When `prefillToken` changes to a new value, the
   * composer's textarea is re-seeded with `initialText`. Lets callers
   * prefill the composer imperatively (e.g. "Free write from today's
   * prompt") even with the same text multiple times.
   */
  initialText?: string;
  prefillToken?: number;
}

const PLACEHOLDER_PROMPTS = [
  "I have too many ideas and don't know what to focus on.",
  "I know what I need to do, but I'm not doing it.",
  "I can't tell what matters most right now.",
];

const SIFTING_SUBLINES = [
  "Finding what matters",
  "Separating signal from noise",
  "Making sense of this",
];

export function Composer({ onResult, onCare, initialText, prefillToken }: ComposerProps) {
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

  useEffect(() => () => recRef.current?.stop(), []);

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
      // Scroll into view on small screens so the keyboard doesn't hide the
      // seeded text. "center" is friendlier than "start" on desktop too.
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        // older browsers — ignore.
      }
      el.focus();
      const len = initialText.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        // ignore — some browsers may throw on readonly inputs.
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillToken]);

  // Rotate the "Sifting…" subline every 2.2s while loading.
  useEffect(() => {
    if (!loading) {
      setSiftingIdx(0);
      return;
    }
    const id = setInterval(
      () => setSiftingIdx((i) => (i + 1) % SIFTING_SUBLINES.length),
      2200,
    );
    return () => clearInterval(id);
  }, [loading]);

  // Rotate placeholder every 6s, but pause while focused or while user has typed something.
  useEffect(() => {
    if (focused || input || recording) return;
    const id = setInterval(
      () => setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_PROMPTS.length),
      6000,
    );
    return () => clearInterval(id);
  }, [focused, input, recording]);

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
  const runSift = async (text: string) => {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/sift", {
        input: text,
        inputMode: modeRef.current,
      });
      const data = (await res.json()) as SiftResult | CareResponse;
      if (isCareResponse(data)) {
        if (onCare) onCare(text);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/sifts"] });
      onResult(data);
      setInput("");
      setInterim("");
      setClarifyInput(null);
      modeRef.current = "text";
    } catch (err: any) {
      toast({
        title: "Couldn't sift that",
        description: err?.message ?? "Try again in a moment.",
      });
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    const text = input.trim();
    if (!text) return;
    if (recording) stopVoice();
    // Thin-input gate — show the clarification prompt instead of sending.
    // The original text stays in the composer state so "Edit my thought"
    // returns the user cleanly to what they typed.
    if (isThinInput(text)) {
      setClarifyInput(text);
      return;
    }
    await runSift(text);
  };

  const submitClarification = async (answer: string) => {
    const base = clarifyInput ?? input.trim();
    if (!base) return;
    // Merge the original thought with the clarification answer. Labeled so
    // the model sees both passes as one coherent submission.
    const merged = `${base}\n\nOne more angle: ${answer}`;
    await runSift(merged);
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

  return (
    <div className="relative" data-testid="composer">
      <div
        className={[
          "relative rounded-2xl border bg-card transition-all",
          recording
            ? "border-primary/40 shadow-lg shadow-primary/5"
            : "border-card-border shadow-sm",
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
          className="min-h-[220px] md:min-h-[260px] resize-none border-0 bg-transparent px-5 py-5 md:px-7 md:py-6 text-base md:text-[17px] leading-relaxed focus-visible:ring-0 placeholder:text-muted-foreground/60 placeholder:transition-opacity"
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
      {loading ? (
        <div
          className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"
          data-testid="sifting-subline"
          aria-live="polite"
        >
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-primary inline-block" />
          <span key={siftingIdx} className="fade-in-slow">
            {SIFTING_SUBLINES[siftingIdx]}
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
}

export function Result({
  result,
  onReset,
  readOnly,
  showFollowup,
  onExpand,
  onCheckInLater,
  onSave,
}: ResultProps) {
  const { toast } = useToast();
  const [copiedText, setCopiedText] = useState(false);
  // Opens the standalone share card (same pattern as the daily prompt share).
  // Only the Quiet reflection travels — the full sift stays private unless
  // the viewer explicitly copies it as text.
  const [reflectionShareOpen, setReflectionShareOpen] = useState(false);

  // Soft interpretation state for "What this may be pointing to".
  // intentText is the currently displayed intent (user may have corrected it).
  // fitState tracks the small action row: null = show actions, "fits" = quietly
  // confirmed, "skipped" = hidden, "editing" = inline correction visible.
  const [intentText, setIntentText] = useState(result.coreIntent);
  useEffect(() => {
    setIntentText(result.coreIntent);
    setFitState(null);
    setCorrection("");
  }, [result.id, result.coreIntent]);
  const [fitState, setFitState] = useState<
    null | "fits" | "skipped" | "editing"
  >(null);
  const [correction, setCorrection] = useState("");

  const applyCorrection = () => {
    const v = correction.trim();
    if (!v) return;
    setIntentText(v);
    setFitState("fits");
    setCorrection("");
  };

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}#/s/${result.id}`
      : "";

  const copyText = async () => {
    const body = [
      `Sift — ${new Date(result.createdAt).toLocaleString()}`,
      "",
      "Themes:",
      ...result.themes.map((t, i) => `${i + 1}. ${t.title} — ${t.summary}`),
      "",
      `What this may be pointing to:`,
      intentText,
      "",
      `Next step:`,
      result.nextStep,
      "",
      `Reflection:`,
      result.reflection,
      "",
      shareUrl,
    ].join("\n");
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
            {intentText}
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
                    data-testid="input-intent-correction"
                    className="mt-2 min-h-[72px] resize-none text-base leading-relaxed"
                  />
                  <div className="mt-2 flex items-center gap-4 text-sm">
                    <button
                      type="button"
                      onClick={applyCorrection}
                      disabled={!correction.trim()}
                      data-testid="button-intent-update"
                      className="text-foreground/85 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors disabled:opacity-50"
                    >
                      Update this
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFitState(null);
                        setCorrection("");
                      }}
                      data-testid="link-intent-cancel"
                      className="text-muted-foreground/70 hover:text-foreground transition-colors"
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

        {/* Themes */}
        <section data-testid="section-themes">
          <Label>Themes underneath</Label>
          <ul className="mt-4 divide-y divide-border/70 border-y border-border/70">
            {result.themes.map((t, i) => (
              <li
                key={i}
                className="py-4 md:py-5 flex gap-4 md:gap-6"
                data-testid={`theme-${i}`}
              >
                <span className="font-mono text-xs text-muted-foreground pt-1 w-6">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <h3 className="font-serif text-lg md:text-xl text-foreground">
                    {t.title}
                  </h3>
                  <p className="text-sm md:text-[15px] text-muted-foreground mt-1.5 leading-relaxed">
                    {t.summary}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Next step */}
        <section data-testid="section-next">
          <Label>One next step</Label>
          <div className="mt-3 rounded-2xl border border-primary/25 bg-primary/5 p-5 md:p-6">
            <p
              className="font-serif text-xl md:text-2xl leading-snug text-foreground"
              data-testid="text-next-step"
            >
              {result.nextStep}
            </p>
          </div>
        </section>

        {/* Reflection */}
        <section data-testid="section-reflection">
          <Label>Quiet reflection</Label>
          <p
            className="mt-3 text-base md:text-[17px] text-muted-foreground italic leading-relaxed"
            data-testid="text-reflection"
          >
            "{result.reflection}"
          </p>
        </section>

        {/* Actions */}
        {showFollowup && !readOnly ? (
          <div className="pt-2" data-testid="followup-row">
            <p
              className="text-sm text-muted-foreground mb-4"
              data-testid="text-followup-microcopy"
            >
              Where do you want to take this?
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {onExpand && (
                <Button
                  type="button"
                  onClick={onExpand}
                  data-testid="button-expand-now"
                  className="gap-2"
                >
                  <ArrowRight className="w-4 h-4" />
                  Expand on this now
                </Button>
              )}
              {onCheckInLater && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCheckInLater}
                  data-testid="button-checkin-later"
                  className="gap-2"
                >
                  <Clock className="w-4 h-4" />
                  Come back to this later
                </Button>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
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
            <div className="mt-6 flex flex-wrap items-center gap-3">
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
        line={result.reflection}
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
