import { useState } from "react";
import { Header, Footnote } from "@/components/brand";
import { Composer, Result } from "@/components/sift-ui";
import { AuthDialog } from "@/components/auth-dialog";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/auth";
import { Bookmark } from "lucide-react";
import type { SiftResult } from "@shared/schema";

export default function Home() {
  const [result, setResult] = useState<SiftResult | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const { data: meData } = useMe();
  const me = meData?.me;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 md:px-8 pb-16">
          {!result ? (
            <div className="pt-10 md:pt-16">
              <div className="text-center mb-10 md:mb-14">
                <p className="text-[11px] tracking-[0.25em] uppercase text-primary/80 mb-4 font-medium">
                  Clarity over comfort
                </p>
                <h1 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
                  What are you holding
                  <br />
                  <em className="text-primary not-italic" style={{ fontStyle: "italic" }}>
                    right now?
                  </em>
                </h1>
                <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
                  Speak it or type it. Sift strips away the noise and returns
                  the themes, the real want, and one next step you can take.
                </p>
              </div>

              <Composer onResult={setResult} />
            </div>
          ) : (
            <div className="pt-8 md:pt-12">
              {!me && <SaveThreadBanner onOpen={() => setAuthOpen(true)} />}
              <Result result={result} onReset={() => setResult(null)} />
            </div>
          )}
        </div>
      </main>

      <Footnote />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode="signup" />
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
