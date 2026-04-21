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
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import type { SiftResult, SiftListItem } from "@shared/schema";

// Hardcoded seed for "Free write from this". Keeps the app voice:
// reflective, calm, introspective. No prompt gymnastics.
const FREE_WRITE_SEED = "What feels hardest about starting right now is...";

// Seed for the continuation composer when a user chooses "Expand on this now".
// Short, inviting, and in the app voice — picks up the thread rather than
// restarting it.
const EXPAND_SEED = "Staying with this, what I want to say next is...";

// Explicit flow states for the home page. One variable, no scattered booleans.
//   idle      — composer
//   sifting   — request in flight (Composer owns its own loading UI, so this
//               state is informational; we still track it for clarity)
//   result    — show result + decision row (expand / come back later)
//   expanding — result stays visible above a continuation composer
//   saved     — user chose "come back to this later" (navigation handles it)
type Flow = "idle" | "sifting" | "result" | "expanding" | "saved";

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
  // Separate token for the continuation composer used in the expanding flow.
  const [expandPrefillToken, setExpandPrefillToken] = useState(0);
  const [contactPromptOpen, setContactPromptOpen] = useState(false);
  // Quick reset (Signal / Noise) — kept local to the home screen.
  // `quickResetSeed` is the soft composer seed produced by the completion
  // state; it transiently overrides FREE_WRITE_SEED when the user taps the
  // completion CTA. `quickResetDismissed` hides the card for the rest of the
  // session once the user finishes or skips it.
  const [quickResetOpen, setQuickResetOpen] = useState(false);
  const [quickResetDismissed, setQuickResetDismissed] = useState(false);
  const [quickResetSeed, setQuickResetSeed] = useState<string | null>(null);
  const { data: meData } = useMe();
  const me = meData?.me;

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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 md:px-8 pb-16">
          {flow === "idle" || flow === "sifting" ? (
            <div className="pt-10 md:pt-16">
              {/* Hero — first-time users get the full reflective hero.
                  Returning users get a minimal prompt label only. */}
              {!isReturning ? (
                <div className="text-center mb-10 md:mb-14">
                  <p
                    className="text-[11px] tracking-[0.25em] uppercase text-primary/80 mb-4 font-medium"
                    data-testid="text-eyebrow"
                  >
                    Clarity over comfort
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

              {/* Returning signed-in users: a quiet daily nudge above the composer. */}
              {isReturning && (
                <TodayFromSiftCard onOpen={() => setTodayOpen(true)} />
              )}

              {/* Quick reset — a very small optional ritual. Sits above the
                  composer; once started or skipped, hides for the session. */}
              {!quickResetDismissed && (
                <QuickResetCard
                  onStart={() => setQuickResetOpen(true)}
                  onSkip={() => setQuickResetDismissed(true)}
                />
              )}

              <Composer
                onResult={(r) => {
                  setResult(r);
                  setFlow("result");
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
            </div>
          ) : flow === "expanding" && result ? (
            <div className="pt-8 md:pt-12">
              {/* Keep the current sift visible — continuing the thread, not
                  starting over. Action row is hidden (readOnly) so the only
                  action below is the continuation composer. */}
              <Result result={result} readOnly />
              <div className="mt-10 md:mt-12 border-t border-border/60 pt-8 md:pt-10">
                <p
                  className="text-[11px] tracking-[0.25em] uppercase text-primary/80 mb-3 font-medium"
                  data-testid="text-expand-eyebrow"
                >
                  Keep going
                </p>
                <Composer
                  onResult={(r) => {
                    // Continuation becomes the new focal sift. Old result is
                    // still saved server-side; this keeps the UI simple.
                    setResult(r);
                    setFlow("result");
                  }}
                  initialText={EXPAND_SEED}
                  prefillToken={expandPrefillToken}
                />
                <div className="mt-4">
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
                  // Bump the continuation composer's prefill token so it
                  // re-seeds every time the user enters the expanding flow.
                  setExpandPrefillToken((n) => n + 1);
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
        onShare={() => {
          // Close the bottom sheet first, then open the share dialog on the
          // next tick. Sequencing the two overlays avoids a focus-trap race
          // between Radix Sheet and Dialog.
          setTodayOpen(false);
          setTimeout(() => setShareOpen(true), 120);
        }}
        onFreeWrite={() => {
          // Close the sheet and re-seed the composer. Bumping the token
          // triggers the composer's prefill effect, which sets the text
          // and focuses the textarea.
          setTodayOpen(false);
          setComposerPrefillToken((n) => n + 1);
        }}
      />
      <SharePromptDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        title={TODAY_PROMPT_TITLE}
        line={TODAY_PROMPT_LINE}
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
