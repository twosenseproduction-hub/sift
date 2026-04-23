import { useState } from "react";
import { Check, Circle, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  CheckinResult,
  CheckinStatus,
  SiftResult,
} from "@shared/schema";
import { isCareResponse } from "@shared/schema";
import { CareScreen } from "./care-screen";

interface Props {
  sift: SiftResult;
  readOnly?: boolean; // true when viewing someone else's shared sift
}

const STATUS_LABEL: Record<CheckinStatus, string> = {
  did_it: "Did it",
  did_not: "Didn't",
  in_progress: "Still working",
};

const STATUS_NOTE: Record<CheckinStatus, string> = {
  did_it: "What changed after you took the step?",
  did_not: "What got in the way?",
  in_progress: "Where are you right now with it?",
};

export function CheckinBlock({ sift, readOnly }: Props) {
  const [status, setStatus] = useState<CheckinStatus | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // If the check-in note trips the server crisis screen, the composer is
  // replaced by the CareScreen until the user dismisses it. Flagged text is
  // never persisted server-side.
  const [careOpen, setCareOpen] = useState(false);
  const [careOriginalNote, setCareOriginalNote] = useState<string | null>(
    null,
  );
  // First-time check-in intro: shown only for the sift owner when they
  // haven't checked in yet on this sift, and they haven't dismissed the
  // intro in this session. React state only (no localStorage) — returning
  // across a full reload will show it once more, which is acceptable.
  const [introDismissed, setIntroDismissed] = useState(false);
  const [introResponse, setIntroResponse] = useState<
    null | "did_it" | "did_not"
  >(null);
  const { toast } = useToast();

  const checkins = sift.checkins ?? [];
  const showIntro = !readOnly && checkins.length === 0 && !introDismissed;

  // If not the owner and there are no past check-ins, don't render anything.
  if (readOnly && checkins.length === 0) return null;

  const submit = async () => {
    if (!status) return;
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", `/api/sift/${sift.id}/checkin`, {
        status,
        note: note.trim(),
      });
      const data = await res.json();
      // Server crisis screen tripped. Flagged note is not stored; surface a
      // care screen instead of a check-in card.
      if (isCareResponse(data)) {
        setCareOriginalNote(note);
        setCareOpen(true);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/sift", sift.id] });
      setStatus(null);
      setNote("");
    } catch (err: any) {
      toast({
        title: "Couldn't save the check-in",
        description: err?.message ?? "Try again in a moment.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // If the crisis screen tripped on this check-in, render it in place of the
  // entire check-in section. "Go back" clears the composer; "this wasn't what
  // I meant" restores the note so the user can rephrase.
  if (careOpen) {
    return (
      <section
        className="pt-12 mt-12 border-t border-border/60"
        data-testid="section-checkin"
      >
        <CareScreen
          onClose={() => {
            setCareOpen(false);
            setCareOriginalNote(null);
            setStatus(null);
            setNote("");
          }}
          onDismiss={() => {
            setCareOpen(false);
            if (careOriginalNote !== null) setNote(careOriginalNote);
            setCareOriginalNote(null);
          }}
        />
      </section>
    );
  }

  return (
    <section className="pt-12 mt-12 border-t border-border/60" data-testid="section-checkin">
      <div className="flex items-center gap-3 mb-6">
        <span className="h-px w-6 bg-primary/40" />
        <span className="text-[11px] tracking-[0.2em] uppercase font-medium text-primary/80">
          Check in
        </span>
      </div>

      {/* Past check-ins */}
      {checkins.length > 0 && (
        <div className="space-y-10 mb-10">
          {checkins.map((c) => (
            <CheckinCard key={c.id} checkin={c} />
          ))}
        </div>
      )}

      {/* First-time check-in intro — owner only, first sift, not dismissed */}
      {showIntro && (
        <FirstCheckinIntro
          response={introResponse}
          onAnswer={(answer) => {
            setIntroResponse(answer);
            // Pre-select the matching status so the composer below is already
            // oriented around the user's answer.
            setStatus(answer === "did_it" ? "did_it" : "did_not");
          }}
          onContinue={() => setIntroDismissed(true)}
        />
      )}

      {/* New check-in composer (owner only) */}
      {!readOnly && !showIntro && (
      <div className="rounded-2xl border border-border/70 bg-card/50 p-5 md:p-6">
        {checkins.length === 0 ? (
          <>
            <p className="text-[11px] tracking-[0.22em] uppercase font-medium text-muted-foreground/80 mb-2">
              The step Sift suggested
            </p>
            <p className="font-serif text-lg md:text-xl text-foreground leading-snug">
              <span className="text-muted-foreground">“</span>
              {sift.nextStep}
              <span className="text-muted-foreground">”</span>
            </p>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              How did it go? Not a habit tracker — just a way to adjust the
              direction as the work unfolds.
            </p>
          </>
        ) : (
          <>
            <p className="font-serif text-lg md:text-xl text-foreground leading-snug">
              Another update on {sift.coreIntent ? (
                <em className="not-italic text-primary/90" style={{ fontStyle: "italic" }}>
                  {sift.coreIntent.replace(/\.$/, "").toLowerCase()}
                </em>
              ) : "this"}?
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Tell Sift where you are now.
            </p>
          </>
        )}

        <div className="mt-5 flex flex-wrap gap-2" data-testid="checkin-status">
          {(["did_it", "did_not", "in_progress"] as CheckinStatus[]).map((s) => {
            const caption =
              s === "did_it"
                ? "Did it"
                : s === "did_not"
                ? "Didn't get to it"
                : "Still working on it";
            return (
              <button
                key={s}
                type="button"
                data-testid={`checkin-${s}`}
                onClick={() => setStatus(s)}
                className={[
                  "px-4 py-2 rounded-full border text-sm transition-all text-left",
                  status === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/70 bg-background text-muted-foreground hover:text-foreground hover:border-border",
                ].join(" ")}
              >
                <span className="inline-flex items-center gap-2">
                  {s === "did_it" && <Check className="w-3.5 h-3.5 shrink-0" />}
                  {s === "did_not" && <Circle className="w-3.5 h-3.5 shrink-0" />}
                  {s === "in_progress" && <Clock className="w-3.5 h-3.5 shrink-0" />}
                  {caption}
                </span>
              </button>
            );
          })}
        </div>

        {status && (
          <div className="mt-5">
            <Textarea
              data-testid="checkin-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={STATUS_NOTE[status]}
              className="min-h-[120px] resize-none bg-background"
              disabled={submitting}
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatus(null);
                  setNote("");
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={submit}
                disabled={submitting}
                data-testid="button-checkin-submit"
                className="gap-2"
              >
                {submitting ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    Sifting…
                  </>
                ) : (
                  <>Sift this update</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
      )}
    </section>
  );
}

// ---------- First-time check-in intro ----------

interface FirstCheckinIntroProps {
  response: null | "did_it" | "did_not";
  onAnswer: (answer: "did_it" | "did_not") => void;
  onContinue: () => void;
}

function FirstCheckinIntro({
  response,
  onAnswer,
  onContinue,
}: FirstCheckinIntroProps) {
  return (
    <div
      className="fade-up rounded-2xl border border-primary/25 bg-primary/5 p-5 md:p-7 mb-6"
      data-testid="first-checkin-intro"
    >
      <h3
        className="font-serif text-xl md:text-2xl text-foreground leading-snug"
        data-testid="text-intro-title"
      >
        Quick check-in
      </h3>
      <p
        className="mt-2 text-base md:text-[17px] text-foreground/85 leading-relaxed"
        data-testid="text-intro-body"
      >
        Were you able to try this?
      </p>

      {!response ? (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => onAnswer("did_it")}
              data-testid="button-intro-yes"
              className="gap-2"
            >
              <Check className="w-4 h-4" />
              Yes, I did
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onAnswer("did_not")}
              data-testid="button-intro-no"
              className="gap-2"
            >
              <Circle className="w-4 h-4" />
              No, not yet
            </Button>
          </div>
          <p
            className="mt-4 text-xs text-muted-foreground"
            data-testid="text-intro-microcopy"
          >
            This helps Sift suggest a better next step.
          </p>
        </>
      ) : (
        <div className="mt-5 fade-in-slow">
          <p
            className="text-base text-foreground/90 leading-relaxed"
            data-testid="text-intro-response"
          >
            {response === "did_it"
              ? "Good. Let's build from there."
              : "That's okay. We'll make the next step smaller."}
          </p>
          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onContinue}
              data-testid="button-intro-continue"
            >
              Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckinCard({ checkin }: { checkin: CheckinResult }) {
  const date = new Date(checkin.createdAt).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });

  return (
    <article className="fade-up" data-testid={`checkin-card-${checkin.id}`}>
      {/* Status + date line */}
      <div className="flex items-center gap-3 mb-5">
        <StatusBadge status={checkin.status} />
        <span className="text-xs text-muted-foreground">{date}</span>
      </div>

      {/* User note (if any) */}
      {checkin.note && (
        <div className="mb-6 pl-4 border-l-2 border-border/70">
          <p className="text-sm text-muted-foreground italic leading-relaxed whitespace-pre-wrap">
            {checkin.note}
          </p>
        </div>
      )}

      {/* What I'm hearing */}
      <section className="mb-7">
        <MiniLabel>What I'm hearing</MiniLabel>
        <p className="font-serif text-lg md:text-xl leading-[1.4] text-foreground mt-2.5">
          {checkin.hearing}
        </p>
      </section>

      {/* What matters */}
      <section className="mb-7">
        <MiniLabel>What matters</MiniLabel>
        <ul className="mt-3 space-y-2">
          {checkin.matters.map((m, i) => (
            <li key={i} className="flex gap-3 text-[15px] text-foreground/90 leading-relaxed">
              <span className="text-primary/60 mt-1.5">—</span>
              <span>{m}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* What's noise */}
      <section className="mb-7">
        <MiniLabel>What's noise</MiniLabel>
        <ul className="mt-3 space-y-2">
          {checkin.noise.map((n, i) => (
            <li
              key={i}
              className="flex gap-3 text-[15px] text-muted-foreground leading-relaxed"
            >
              <span className="text-muted-foreground/50 mt-1.5">—</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* New next step */}
      <section>
        <MiniLabel>Next step</MiniLabel>
        <div className="mt-3 rounded-xl border border-primary/25 bg-primary/5 px-5 py-4">
          <p className="font-serif text-lg md:text-xl leading-snug text-foreground">
            {checkin.nextStep}
          </p>
        </div>
      </section>
    </article>
  );
}

function StatusBadge({ status }: { status: CheckinStatus }) {
  const styles =
    status === "did_it"
      ? "bg-primary/10 text-primary border-primary/30"
      : status === "did_not"
      ? "bg-muted text-muted-foreground border-border"
      : "bg-accent/40 text-foreground border-border";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] tracking-wide font-medium border ${styles}`}
    >
      {status === "did_it" && <Check className="w-3 h-3" />}
      {status === "did_not" && <Circle className="w-3 h-3" />}
      {status === "in_progress" && <Clock className="w-3 h-3" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

function MiniLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] tracking-[0.22em] uppercase font-medium text-muted-foreground/80">
      {children}
    </span>
  );
}
