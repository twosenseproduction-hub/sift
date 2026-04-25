import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  POSITIVE_TAGS,
  NEGATIVE_TAGS,
  type FeedbackStage,
  type FeedbackSentiment,
} from "@shared/schema";

// FeedbackPrompt
//
// A small, calm "Was this helpful?" affordance that sits beneath the result
// card (and other staged moments). The flow is:
//
//   1. "Was this helpful?"  — Helpful / Not helpful
//   2. Pick an optional tag (the suggested set, scoped by sentiment)
//   3. Optionally write a short note
//   4. Submit — single POST to /api/feedback
//
// Native to Sift: no exclamation points, no emojis, no hype. Native widgets
// (links, small pill buttons, the existing Textarea component). Submitting is
// optional at every step — the user can stop after step 1 without writing
// anything more, and we'll still record their sentiment.

type Step = "ask" | "tags" | "thanks";

interface FeedbackPromptProps {
  stage: FeedbackStage;
  siftId?: string | null;
  // Shown above the buttons. Defaults to "Was this helpful?".
  question?: string;
  // Tightens the visual footprint — used in tighter contexts like inside a
  // bookmark recap or summary card.
  compact?: boolean;
}

const tagLabel: Record<string, string> = {
  felt_accurate: "Felt accurate",
  made_things_clearer: "Made things clearer",
  good_next_step: "Good next step",
  calming: "Calming",
  helped_me_focus: "Helped me focus",
  too_vague: "Too vague",
  missed_the_point: "Missed the point",
  too_wordy: "Too wordy",
  not_actionable: "Not actionable",
  felt_repetitive: "Felt repetitive",
};

export function FeedbackPrompt({
  stage,
  siftId,
  question = "Was this helpful?",
  compact = false,
}: FeedbackPromptProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("ask");
  const [sentiment, setSentiment] = useState<FeedbackSentiment | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // We submit immediately on the sentiment tap — that's the most important
  // signal and we don't want to lose it if the user wanders away mid-tag-pick.
  // Subsequent tag/message submits are PATCH-style "enrich the same row";
  // we keep it simple by sending separate POSTs and letting the server treat
  // each as its own datapoint. Cheap and stable. The server-side dedupe is
  // not needed for v1 — admin can group by siftId/userId if it gets noisy.
  async function submit(args: {
    sentiment: FeedbackSentiment;
    tag?: string | null;
    message?: string | null;
  }) {
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/feedback", {
        siftId: siftId ?? undefined,
        stage,
        sentiment: args.sentiment,
        tag: args.tag ?? undefined,
        message: args.message ?? undefined,
      });
    } catch (err: any) {
      toast({
        title: "Couldn't save that",
        description: err?.message ?? "Try again in a moment.",
        variant: "destructive",
      });
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  async function chooseSentiment(s: FeedbackSentiment) {
    if (submitting) return;
    setSentiment(s);
    try {
      await submit({ sentiment: s });
      setStep("tags");
    } catch {
      // Stay on ask step so user can retry.
      setSentiment(null);
    }
  }

  async function chooseTag(t: string) {
    if (!sentiment || submitting) return;
    const next = tag === t ? null : t;
    setTag(next);
    if (next) {
      try {
        await submit({ sentiment, tag: next });
      } catch {
        /* toast handles it */
      }
    }
  }

  async function submitMessage() {
    if (!sentiment) return;
    const v = message.trim();
    if (!v) {
      setStep("thanks");
      return;
    }
    try {
      await submit({ sentiment, tag, message: v });
      setStep("thanks");
    } catch {
      /* toast handles it */
    }
  }

  const tags = sentiment === "helpful" ? POSITIVE_TAGS : NEGATIVE_TAGS;

  const containerCls = compact
    ? "mt-4 pt-4 border-t border-border/60"
    : "mt-8 pt-6 border-t border-border/60";

  if (step === "thanks") {
    return (
      <div className={containerCls} data-testid={`feedback-thanks-${stage}`}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Check className="w-3.5 h-3.5 text-primary" />
          <span>Thanks. This helps shape Sift.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={containerCls} data-testid={`feedback-${stage}`}>
      {step === "ask" && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p
            className="text-xs uppercase tracking-widest text-muted-foreground"
            data-testid="text-feedback-question"
          >
            {question}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => chooseSentiment("helpful")}
              disabled={submitting}
              className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/40 hover:text-foreground text-muted-foreground transition-colors disabled:opacity-50"
              data-testid="button-feedback-helpful"
            >
              Helpful
            </button>
            <button
              type="button"
              onClick={() => chooseSentiment("not_helpful")}
              disabled={submitting}
              className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-foreground/30 hover:text-foreground text-muted-foreground transition-colors disabled:opacity-50"
              data-testid="button-feedback-not-helpful"
            >
              Not helpful
            </button>
          </div>
        </div>
      )}

      {step === "tags" && sentiment && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {sentiment === "helpful" ? "What worked?" : "What missed?"}
            </p>
            <button
              type="button"
              onClick={() => setStep("thanks")}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
              data-testid="button-feedback-skip-tags"
            >
              Skip
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => {
              const selected = tag === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => chooseTag(t)}
                  disabled={submitting}
                  className={[
                    "text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50",
                    selected
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  ].join(" ")}
                  data-testid={`button-feedback-tag-${t}`}
                >
                  {tagLabel[t] ?? t}
                </button>
              );
            })}
          </div>
          <div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Anything else? Optional."
              rows={2}
              maxLength={2000}
              className="text-sm resize-none"
              data-testid="input-feedback-message"
            />
            <div className="flex items-center justify-end mt-2 gap-3">
              <button
                type="button"
                onClick={() => setStep("thanks")}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                data-testid="button-feedback-done"
              >
                Done
              </button>
              <button
                type="button"
                onClick={submitMessage}
                disabled={submitting || !message.trim()}
                className="text-xs px-3 py-1.5 rounded-full border border-primary/40 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                data-testid="button-feedback-send-message"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Sending
                  </>
                ) : (
                  "Send note"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
