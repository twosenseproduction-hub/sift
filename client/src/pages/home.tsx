import { useState } from "react";
import { Header, Footnote } from "@/components/brand";
import { Composer, Result } from "@/components/sift-ui";
import { AuthDialog } from "@/components/auth-dialog";
import { ExampleSheet } from "@/components/example-sheet";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import type { SiftResult, SiftListItem } from "@shared/schema";

export default function Home() {
  const [result, setResult] = useState<SiftResult | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false);
  const { data: meData } = useMe();
  const me = meData?.me;

  // For signed-in users, check if they have any prior sifts.
  // If they do, hide onboarding affordances (See example, hero copy).
  const { data: sifts } = useQuery<SiftListItem[]>({
    queryKey: ["/api/sifts"],
    enabled: !!me,
  });
  const isReturning = !!me && (sifts?.length ?? 0) > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-6 md:px-8 pb-16">
          {!result ? (
            <div className="pt-10 md:pt-16">
              {/* Hero — first-time users get the full reflective hero.
                  Returning users get a minimal prompt label only. */}
              {!isReturning ? (
                <div className="mb-8 md:mb-10 text-center">
                  <p
                    className="text-xs md:text-sm tracking-[0.2em] uppercase text-muted-foreground/80"
                    data-testid="text-eyebrow"
                  >
                    Clarity over comfort
                  </p>
                  <h1
                    className="mt-4 font-serif text-4xl md:text-5xl leading-[1.1] text-foreground"
                    data-testid="text-hero"
                  >
                    What are you holding{" "}
                    <em className="italic text-primary">right now?</em>
                  </h1>
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

              <Composer onResult={setResult} />

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
