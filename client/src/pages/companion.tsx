import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { HomeTopBar } from "@/components/home-app-chrome";
import { CompanionSceneCard } from "@/components/companion-scene-card";
import { HomeStage } from "@/components/home-stage";
import { CompanionAvatar } from "@/components/companion-avatar";
import { SiftPresenceBubble } from "@/components/sift-presence-bubble";
import { Composer, Result, RedundancyGateCard } from "@/components/sift-ui";
import { DeepeningThread } from "@/components/deepening-thread";
import { CareScreen } from "@/components/care-screen";
import { FeedbackPrompt } from "@/components/feedback-prompt";
import { AuthDialog } from "@/components/auth-dialog";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMe } from "@/lib/auth";
import { writeResume } from "@/lib/resume";
import { cn } from "@/lib/utils";
import type { SiftResult, SiftRedundancyGateResult } from "@shared/schema";
import { isCareResponse, isRedundancyGateResult } from "@shared/schema";

type Flow = "idle" | "result" | "expanding" | "care";

/**
 * Companion home — one room + presence + the same sift / deepen engine as classic home.
 * Route: #/companion
 */
export default function CompanionPage() {
  const [flow, setFlow] = useState<Flow>("idle");
  const [result, setResult] = useState<SiftResult | null>(null);
  const [redundancyGate, setRedundancyGate] =
    useState<SiftRedundancyGateResult | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [composerPrefillToken, setComposerPrefillToken] = useState(0);
  const [quickResetSeed, setQuickResetSeed] = useState<string | null>(null);
  const [careOriginalInput, setCareOriginalInput] = useState<string | null>(null);

  const { data: meData } = useMe();
  const me = meData?.me;

  const companionIdle = flow === "idle";

  return (
    <>
      <AppShell
        backdrop={
          <div
            className="pointer-events-none fixed inset-0 z-0 bg-[hsl(var(--background))]"
            aria-hidden
          />
        }
        header={
          <HomeTopBar
            onRequestSignIn={() => setAuthOpen(true)}
            variant={companionIdle ? "roomCozy" : "default"}
          />
        }
        footer={null}
        contentClassName={cn(
          "flex flex-col flex-1 min-h-0 relative",
          companionIdle
            ? "gap-3 pt-2 pb-[calc(3rem+env(safe-area-inset-bottom))]"
            : "pb-[calc(4rem+env(safe-area-inset-bottom))]",
        )}
        mainClassName="min-h-0"
      >
        {companionIdle ? (
          <div className="flex min-h-0 flex-1 flex-col px-2">
            <CompanionSceneCard>
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 pt-2">
                  <CompanionAvatar placement="inRoom" />
                </div>
                <div className="flex shrink-0 justify-center pb-0.5 pt-3">
                  <SiftPresenceBubble tone="glass" />
                </div>
              </div>
            </CompanionSceneCard>

            <div className="mx-auto w-full max-w-[min(100%,22rem)] shrink-0 px-0 pb-1 sm:max-w-md">
              <Composer
                embedded
                layout="room"
                initialText={quickResetSeed ?? ""}
                onResult={(r) => {
                  queryClient.invalidateQueries({ queryKey: ["/api/reentry"] });
                  setRedundancyGate(null);
                  setResult(r);
                  setFlow("result");
                }}
                onRedundancyGate={(g) => {
                  setResult(null);
                  setRedundancyGate(g);
                  setFlow("result");
                }}
                onCare={(originalInput) => {
                  setCareOriginalInput(originalInput);
                  setFlow("care");
                }}
                prefillToken={composerPrefillToken}
              />
            </div>
          </div>
        ) : flow === "expanding" && result ? (
          <div className="pt-6 md:pt-10">
            <HomeStage>
              <Result result={result} readOnly />
              <div className="mt-10 md:mt-12 border-t border-border/60 pt-8 md:pt-10">
                <p className="text-[11px] tracking-[0.25em] uppercase text-primary/80 mb-3 font-medium">
                  Keep going
                </p>
                {me ? (
                  <DeepeningThread
                    siftId={result.id}
                    initialTurns={result.turns ?? []}
                    initialBookmark={result.bookmark}
                    onCare={() => setFlow("care")}
                    onClosed={() => {}}
                    onBookmarkUpdate={(bookmark) => {
                      setResult((prev) => (prev ? { ...prev, bookmark } : prev));
                    }}
                  />
                ) : (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-5">
                    <p className="text-sm text-foreground/80 mb-3">
                      Deepening saves the thread across visits. Start a thread to
                      continue.
                    </p>
                    <Button size="sm" onClick={() => setAuthOpen(true)}>
                      Start a thread
                    </Button>
                  </div>
                )}
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setFlow("result")}
                    className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
                  >
                    Back to result
                  </button>
                </div>
              </div>
            </HomeStage>
          </div>
        ) : flow === "care" ? (
          <CareScreen
            onClose={() => {
              setCareOriginalInput(null);
              setFlow("idle");
            }}
            onDismiss={() => {
              if (careOriginalInput) {
                setQuickResetSeed(careOriginalInput);
                setComposerPrefillToken((n) => n + 1);
              }
              setCareOriginalInput(null);
              setFlow("idle");
            }}
          />
        ) : redundancyGate ? (
          <div className="pt-6 md:pt-10">
            <HomeStage>
              <RedundancyGateCard
                gate={redundancyGate}
                onSomethingChanged={async () => {
                  try {
                    const res = await apiRequest("POST", "/api/sift", {
                      input: redundancyGate.input,
                      inputMode: redundancyGate.inputMode,
                      forceAnalysis: true,
                    });
                    const data = (await res.json()) as unknown;
                    if (isCareResponse(data)) {
                      setCareOriginalInput(redundancyGate.input);
                      setRedundancyGate(null);
                      setFlow("care");
                      return;
                    }
                    if (isRedundancyGateResult(data)) {
                      setRedundancyGate(data);
                      return;
                    }
                    queryClient.invalidateQueries({ queryKey: ["/api/reentry"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/sifts"] });
                    setRedundancyGate(null);
                    setResult(data as SiftResult);
                  } catch {
                    setRedundancyGate(null);
                    setFlow("idle");
                  }
                }}
                onKnowThis={async () => {
                  try {
                    await apiRequest(
                      "PATCH",
                      `/api/sift/${encodeURIComponent(
                        redundancyGate.redundancyGate.priorSiftId,
                      )}/close-loop`,
                      {},
                    );
                  } catch {
                    /* ignore */
                  }
                  setRedundancyGate(null);
                  setFlow("idle");
                }}
              />
            </HomeStage>
          </div>
        ) : result ? (
          <div className="pt-6 md:pt-10 space-y-6">
            {!me ? <SaveThreadBanner onOpen={() => setAuthOpen(true)} /> : null}
            <HomeStage>
              <Result
                result={result}
                onReset={() => {
                  setResult(null);
                  setFlow("idle");
                }}
                showFollowup
                onExpand={() => {
                  writeResume({ siftId: result.id });
                  setFlow("expanding");
                }}
                onCheckInLater={() => {
                  if (me) {
                    window.location.hash = `/s/${result.id}`;
                  } else {
                    setAuthOpen(true);
                  }
                }}
                onSave={!me ? () => setAuthOpen(true) : undefined}
              />
              <FeedbackPrompt stage="result" siftId={result.id} />
            </HomeStage>
          </div>
        ) : null}
      </AppShell>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode="signup" />
    </>
  );
}

function SaveThreadBanner({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-center text-sm text-muted-foreground">
      <span className="text-foreground">Save this thread</span> to return later.{" "}
      <button
        type="button"
        onClick={onOpen}
        className="text-primary underline underline-offset-4 font-medium"
      >
        Sign in
      </button>
    </div>
  );
}
