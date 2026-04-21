import { useState } from "react";
import { Header, Footnote } from "@/components/brand";
import { Composer, Result } from "@/components/sift-ui";
import { AuthDialog } from "@/components/auth-dialog";
import { ExampleSheet } from "@/components/example-sheet";
import { TodayFromSiftCard } from "@/components/today-from-sift-card";
import {
  TodayPromptSheet,
  TODAY_PROMPT_TITLE,
  TODAY_PROMPT_LINE,
} from "@/components/today-prompt-sheet";
import { SharePromptDialog } from "@/components/share-prompt-dialog";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import type { SiftResult, SiftListItem } from "@shared/schema";

// Hardcoded seed for "Free write from this". Keeps the app voice:
// reflective, calm, introspective. No prompt gymnastics.
const FREE_WRITE_SEED = "What feels hardest about starting right now is...";

export default function Home() {
  const [result, setResult] = useState<SiftResult | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [todayOpen, setTodayOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Prefill token — bumping this value re-seeds the composer. Using a token
  // instead of the text itself lets repeated "Free write" taps work even when
  // the user has edited or cleared the textarea in between.
  const [composerPrefillToken, setComposerPrefillToken] = useState(0);
  const { data: meData } = useMe();
  const me = meData?.me;

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
          {!result ? (
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

              <Composer
                onResult={setResult}
                initialText={FREE_WRITE_SEED}
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
          ) : (
            <div className="pt-8 md:pt-12">
              {!me && <SaveThreadBanner onOpen={() => setAuthOpen(true)} />}
              <Result
                result={result}
                onReset={() => setResult(null)}
                showFollowup
                onCheckInLater={() => {
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
          )}
        </div>
      </main>

      <Footnote />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode="signup" />
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
