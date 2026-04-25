import { useEffect, useState } from "react";
import { Header, Footnote } from "@/components/brand";
import { Composer, Result } from "@/components/sift-ui";
import { AuthDialog } from "@/components/auth-dialog";
import { ContactPromptDialog } from "@/components/contact-prompt-dialog";
import { ExampleSheet } from "@/components/example-sheet";
import { TodayFromSiftCard } from "@/components/today-from-sift-card";
import {
  TodayPromptSheet,
  TODAY_PROMPT_TITLE,
  TODAY_PROMPT_LINE,
} from "@/components/today-prompt-sheet";
import { SharePromptDialog } from "@/components/share-prompt-dialog";
import { QuickResetCard } from "@/components/quick-reset-card";
import { QuickResetDialog } from "@/components/quick-reset-dialog";
import { BreathingDot } from "@/components/breathing-dot";
import { CareScreen } from "@/components/care-screen";
import { DeepeningThread } from "@/components/deepening-thread";
import { FeedbackPrompt } from "@/components/feedback-prompt";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/auth";
import { useDailyPrompt } from "@/lib/useDailyPrompt";
import { useResume, clearResume } from "@/lib/resume";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, ChevronDown, ArrowRight } from "lucide-react";
import type { SiftResult, SiftListItem } from "@shared/schema";

// Hardcoded seed for "Free write from this". Keeps the app voice:
// reflective, calm, introspective. No prompt gymnastics.
const FREE_WRITE_SEED = "What feels hardest about starting right now is...";

// Explicit flow states for the home page. One variable, no scattered booleans.
//   idle      — composer
//   sifting   — request in flight (Composer owns its own loading UI, so this
//               state is informational; we still track it for clarity)
//   result    — show result + decision row (expand / come back later)
//   expanding — result stays visible above a threaded deepening surface
//   saved     — user chose "come back to this later" (navigation handles it)
//   care      — server crisis screen tripped. Flagged input is not persisted
//               and not sent to the LLM. Renders a calm resource screen.
type Flow = "idle" | "sifting" | "result" | "expanding" | "saved" | "care";

export default function Home() {
  const [flow, setFlow] = useState<Flow>("idle");
  const [result, setResult] = useState<SiftResult | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [todayOpen, setTodayOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Prefill token — bumping this value re-seeds the composer. Using a token
  // instead of the text itself lets repeated "Free write" taps work even when
  // the user has edited or cleared the textarea in between.
  const [composerPrefillToken, setComposerPrefillToken] = useState(0);
  const [contactPromptOpen, setContactPromptOpen] = useState(false);
  // Quick reset (Signal / Noise) — kept local to the home screen.
  // `quickResetSeed` is the soft composer seed produced by the completion
  // state; it transiently overrides FREE_WRITE_SEED when the user taps the
  // completion CTA. `quickResetDismissed` hides the card for the rest of the
  // session once the user finishes or skips it.
  const [quickResetOpen, setQuickResetOpen] = useState(false);
  const [quickResetDismissed, setQuickResetDismissed] = useState(false);
  const [quickResetSeed, setQuickResetSeed] = useState<string | null>(null);
  // When the crisis screen trips, we keep the original input around locally
  // so "this wasn't what I meant" can restore the composer exactly as typed.
  // It is never sent to the server or persisted.
  const [careOriginalInput, setCareOriginalInput] = useState<string | null>(
    null,
  );
  // Collapsed support section below the composer. Holds Today from Sift,
  // Quick Reset, and Breath as a single progressive-disclosure row so the
  // composer stays the unambiguous hero. Starts closed on every mount — a
  // calm, not-always-visible shelf for different ways in.
  const [supportOpen, setSupportOpen] = useState(false);
  const { data: meData } = useMe();
  const me = meData?.me;

  // Today's personalized prompt from the library. Drives the card's one-line
  // blurb, the bottom-sheet line, and the share-dialog copy. Falls back to
  // the hardcoded default copy until the query resolves (or if it fails).
  const { data: dailyPrompt } = useDailyPrompt();
  const dailyPromptText = dailyPrompt?.prompt.text;

  // One-time prompt for existing users who signed up before we collected
  // a contact. Dismissal is persisted so we only ask once.
  useEffect(() => {
    if (!me) return;
    if (!me.contactMissing) return;
    let dismissed = false;
    try {
      dismissed = typeof window !== "undefined"
        && window.localStorage?.getItem("sift.contactPromptDismissed") === "1";
    } catch {
      dismissed = false;
    }
    if (dismissed) return;
    const t = setTimeout(() => setContactPromptOpen(true), 600);
    return () => clearTimeout(t);
  }, [me?.id, me?.contactMissing]);

  // Reset home to the idle composer when the logo dispatches sift:home-reset.
  // Covers the case where the user is already on '/' — the <Link> is a no-op
  // but we still want to clear any lingering result/expanding/care state.
  useEffect(() => {
    const onReset = () => {
      setResult(null);
      setFlow("idle");
      setCareOriginalInput(null);
    };
    window.addEventListener("sift:home-reset", onReset);
    return () => window.removeEventListener("sift:home-reset", onReset);
  }, []);

  const dismissContactPrompt = () => {
    try {
      window.localStorage?.setItem("sift.contactPromptDismissed", "1");
    } catch {}
  };

  // For signed-in users, check if they have any prior sifts.
  // If they do, hide onboarding affordances (See example, hero copy).
  // Server returns { sifts: [...] } — matches the shape used in history.tsx.
  const { data: siftsData } = useQuery<{ sifts: SiftListItem[] }>({
    queryKey: ["/api/sifts"],
    enabled: !!me,
  });
  const isReturning = !!me && (siftsData?.sifts.length ?? 0) > 0;

  // Resume state — surfaced only on the idle home view. If the referenced
  // sift is known to be closed in the user's list, we silently clear so the
  // card never misleads.
  const resume = useResume();
  useEffect(() => {
    if (!resume || !siftsData) return;
    const match = siftsData.sifts.find((s) => s.id === resume.siftId);
    if (match && match.status === "closed") clearResume();
  }, [resume?.siftId, siftsData]);
  const canShowResume =
    !!me && !!resume && (flow === "idle" || flow === "sifting");

  const onResumeThread = () => {
    if (!resume) return;
    window.location.hash = `/s/${resume.siftId}`;
  };
  const onStartFresh = () => {
    clearResume();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 md:px-8 pb-16">
          {flow === "idle" || flow === "sifting" ? (
            <div className="pt-10 md:pt-16">
              {canShowResume && (
                <ResumeCard
                  onResume={onResumeThread}
                  onStartFresh={onStartFresh}
                />
              )}
              {/* Hero — first-time users get the full reflective hero.
                  Returning users get a minimal prompt label only. */}
              {!isReturning ? (
                <div className="text-center mb-10 md:mb-14">
                  <p
                    className="text-[11px] tracking-[0.25em] uppercase text-primary/80 mb-4 font-medium"
                    data-testid="text-eyebrow"
                  >
                    A quiet tool for a noisy mind
                  </p>
                  <h1
                    className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight"
                    data-testid="text-hero"
                  >
                    What are you holding
                    <br />
                    <em
                      className="text-primary not-italic"
                      style={{ fontStyle: "italic" }}
                    >
                      right now?
                    </em>
                  </h1>
                  <p
                    className="mt-5 text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
                    data-testid="text-hero-sub"
                  >
                    Speak it or type it. Sift strips away the noise and returns
                    the themes, the real want, and one next step you can take.
                  </p>
                </div>
              ) : (
                <div className="mb-6 md:mb-8">
                  <p
                    className="text-sm text-muted-foreground/80"
                    data-testid="text-prompt-label"
                  >
                    What's on your mind?
                  </p>
                </div>
              )}

              <Composer
                onResult={(r) => {
                  setResult(r);
                  setFlow("result");
                }}
                onCare={(originalInput) => {
                  setCareOriginalInput(originalInput);
                  setFlow("care");
                }}
                initialText={quickResetSeed ?? FREE_WRITE_SEED}
                prefillToken={composerPrefillToken}
              />

              {/* Helper line below composer */}
              <p
                className="mt-3 text-xs text-muted-foreground/70"
                data-testid="text-helper"
              >
                Messy is fine.
              </p>

              {/* See example — only for first-time users */}
              {!isReturning && (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setExampleOpen(true)}
                    data-testid="link-see-example"
                    className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                  >
                    See example
                  </button>
                </div>
              )}

              {/* Collapsed support section. One quiet row that expands to
                  reveal Today from Sift, Quick Reset, and Breath. Keeps the
                  composer as the unambiguous primary path. All three tools
                  are preserved with their existing behavior — just moved
                  behind one disclosure. */}
              <section
                className="mt-10 md:mt-12 pt-6 md:pt-8 border-t border-border/40"
                data-testid="section-support"
              >
                <button
                  type="button"
                  onClick={() => setSupportOpen((v) => !v)}
                  aria-expanded={supportOpen}
                  aria-controls="support-panel"
                  data-testid="button-support-toggle"
                  className="w-full flex items-center justify-between gap-4 text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>Need a different way in?</span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform duration-300 ${
                      supportOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {supportOpen && (
                  <div
                    id="support-panel"
                    data-testid="panel-support"
                    className="mt-5 space-y-5 fade-in-slow"
                  >
                    {/* 1. Today from Sift — daily nudge, preserves sheet
                         + share + free-write wiring from the page. */}
                    <TodayFromSiftCard
                      onOpen={() => setTodayOpen(true)}
                      line={dailyPromptText}
                    />

                    {/* 2. Quick Reset — optional ritual. Hides after use
                         for the rest of the session, same as before. */}
                    {!quickResetDismissed && (
                      <QuickResetCard
                        onStart={() => setQuickResetOpen(true)}
                        onSkip={() => setQuickResetDismissed(true)}
                      />
                    )}

                    {/* 3. Breath — grounding module. Fullscreen breathing
                         experience is untouched; onContinue still re-seeds
                         the composer when the user returns to writing. */}
                    <BreathingDot
                      onContinue={() => {
                        setComposerPrefillToken((n) => n + 1);
                      }}
                    />
                  </div>
                )}
              </section>
            </div>
          ) : flow === "expanding" && result ? (
            <div className="pt-8 md:pt-12">
              {/* Keep the current sift visible — continuing the thread, not
                  starting over. Action row is hidden (readOnly) so the only
                  action below is the threaded deepening surface. */}
              <Result result={result} readOnly />
              <div className="mt-10 md:mt-12 border-t border-border/60 pt-8 md:pt-10">
                <p
                  className="text-[11px] tracking-[0.25em] uppercase text-primary/80 mb-3 font-medium"
                  data-testid="text-expand-eyebrow"
                >
                  Keep going
                </p>
                {me ? (
                  <DeepeningThread
                    siftId={result.id}
                    initialTurns={result.turns ?? []}
                    initialBookmark={result.bookmark}
                    onCare={() => setFlow("care")}
                    onClosed={() => {
                      // Leave the thread visible so the user can read the
                      // closure reflection — they can navigate away via the
                      // logo or "Back to result".
                    }}
                    onBookmarkUpdate={(bookmark) => {
                      setResult((prev) =>
                        prev ? { ...prev, bookmark } : prev,
                      );
                    }}
                  />
                ) : (
                  <div
                    className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-5"
                    data-testid="panel-deepen-signin"
                  >
                    <p className="text-sm text-foreground/80 mb-3">
                      Deepening saves the thread across visits. Start a thread
                      to continue with us remembering what unfolded.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setAuthOpen(true)}
                      data-testid="button-signup-to-deepen"
                    >
                      Start a thread
                    </Button>
                  </div>
                )}
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setFlow("result")}
                    data-testid="link-back-to-result"
                    className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                  >
                    Back to result
                  </button>
                </div>
              </div>
            </div>
          ) : flow === "care" ? (
            <CareScreen
              onClose={() => {
                // "Go back" — return to the composer idle state. We deliberately
                // don't restore the flagged text here; this is the "I heard
                // you, I'll step away" path.
                setCareOriginalInput(null);
                setFlow("idle");
              }}
              onDismiss={() => {
                // "this wasn't what I meant" — put the user back in the
                // composer with their original text, so they can rephrase.
                if (careOriginalInput) {
                  setQuickResetSeed(careOriginalInput);
                  setComposerPrefillToken((n) => n + 1);
                }
                setCareOriginalInput(null);
                setFlow("idle");
              }}
            />
          ) : result ? (
            <div className="pt-8 md:pt-12">
              {!me && <SaveThreadBanner onOpen={() => setAuthOpen(true)} />}
              <Result
                result={result}
                onReset={() => {
                  setResult(null);
                  setFlow("idle");
                }}
                showFollowup
                onExpand={() => {
                  // Signed-in users enter the threaded deepening flow.
                  // Anonymous users still get the expanding view, which
                  // prompts them to start a thread to continue.
                  setFlow("expanding");
                }}
                onCheckInLater={() => {
                  setFlow("saved");
                  if (me) {
                    // Signed in: jump to this sift's page where they can check in.
                    window.location.hash = `/s/${result.id}`;
                  } else {
                    // Anonymous: they need an account to check in later.
                    setAuthOpen(true);
                  }
                }}
                onSave={!me ? () => setAuthOpen(true) : undefined}
              />
              <FeedbackPrompt stage="result" siftId={result.id} />
            </div>
          ) : null}
        </div>
      </main>

      <Footnote />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode="signup" />
      <ContactPromptDialog
        open={contactPromptOpen}
        onOpenChange={setContactPromptOpen}
        onDismiss={dismissContactPrompt}
      />
      <ExampleSheet open={exampleOpen} onOpenChange={setExampleOpen} />
      <TodayPromptSheet
        open={todayOpen}
        onOpenChange={setTodayOpen}
        line={dailyPromptText}
        onShare={() => {
          // Close the bottom sheet first, then open the share dialog on the
          // next tick. Sequencing the two overlays avoids a focus-trap race
          // between Radix Sheet and Dialog.
          setTodayOpen(false);
          setTimeout(() => setShareOpen(true), 120);
        }}
        onFreeWrite={() => {
          // Close the sheet and re-seed the composer with today's prompt
          // text (falls back to FREE_WRITE_SEED when the daily prompt hasn't
          // loaded). Bumping the token triggers the composer's prefill
          // effect, which sets the text and focuses the textarea.
          setTodayOpen(false);
          if (dailyPromptText && dailyPromptText.trim().length > 0) {
            setQuickResetSeed(dailyPromptText);
          }
          setComposerPrefillToken((n) => n + 1);
        }}
      />
      <SharePromptDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        title={TODAY_PROMPT_TITLE}
        line={dailyPromptText ?? TODAY_PROMPT_LINE}
      />
      <QuickResetDialog
        open={quickResetOpen}
        onOpenChange={(open) => {
          setQuickResetOpen(open);
          // When the user closes without completing (Skip / Close / outside-tap),
          // hide the card for the rest of the session but do not alter the seed.
          if (!open) setQuickResetDismissed(true);
        }}
        onComplete={({ seed }) => {
          // Set the soft seed and bump the prefill token so the composer
          // re-seeds from it. No auto-submit.
          setQuickResetSeed(seed);
          setQuickResetDismissed(true);
          setComposerPrefillToken((n) => n + 1);
        }}
      />
    </div>
  );
}

function ResumeCard({
  onResume,
  onStartFresh,
}: {
  onResume: () => void;
  onStartFresh: () => void;
}) {
  return (
    <div
      className="mb-8 md:mb-10 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 md:px-5 md:py-5"
      data-testid="card-resume"
    >
      <div className="flex items-start gap-3">
        <Bookmark className="w-4 h-4 mt-1 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p
            className="text-[11px] tracking-[0.25em] uppercase text-primary/80 mb-1.5 font-medium"
            data-testid="text-resume-eyebrow"
          >
            Pick up where you left off
          </p>
          <p
            className="text-sm text-foreground/85 leading-relaxed mb-3"
            data-testid="text-resume-body"
          >
            You were in the middle of a thread.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              onClick={onResume}
              data-testid="button-resume-thread"
              className="gap-2"
            >
              Resume thread
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
            <button
              type="button"
              onClick={onStartFresh}
              data-testid="button-resume-start-fresh"
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
            >
              Start fresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveThreadBanner({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      className="mb-8 flex items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3"
      data-testid="banner-save-thread"
    >
      <div className="flex items-start gap-3 text-sm">
        <Bookmark className="w-4 h-4 mt-0.5 text-primary shrink-0" />
        <span className="text-foreground/80">
          <span className="font-medium text-foreground">Save this to a thread.</span>{" "}
          Sign in to keep your sifts and come back to them later.
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onOpen}
        data-testid="button-banner-signup"
        className="shrink-0"
      >
        Start a thread
      </Button>
    </div>
  );
}
