import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Stage = "intro" | "output";

export function ExampleSheet({ open, onOpenChange }: Props) {
  const [stage, setStage] = useState<Stage>("intro");

  // Reset to intro every time the sheet opens
  useEffect(() => {
    if (open) setStage("intro");
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[92vh] overflow-y-auto border-t border-border bg-background px-6 pt-6 pb-10 md:max-w-2xl md:mx-auto"
        data-testid="sheet-example"
      >
        {stage === "intro" ? (
          <IntroStage
            onTryOwn={() => onOpenChange(false)}
            onShowExample={() => setStage("output")}
          />
        ) : (
          <OutputStage onTryOwn={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function IntroStage({
  onTryOwn,
  onShowExample,
}: {
  onTryOwn: () => void;
  onShowExample: () => void;
}) {
  return (
    <div className="fade-up" data-testid="stage-intro">
      <SheetHeader className="text-left space-y-3 mb-6">
        <SheetTitle className="font-serif text-2xl md:text-3xl leading-tight">
          How Sift works
        </SheetTitle>
        <SheetDescription className="text-base text-muted-foreground leading-relaxed">
          Write what's on your mind. Sift reflects what matters, what's noise,
          and one next step.
        </SheetDescription>
      </SheetHeader>

      <div className="rounded-xl border border-border bg-card/50 p-5 mb-8">
        <p className="text-[11px] tracking-[0.2em] uppercase font-medium text-primary/80 mb-2">
          Example
        </p>
        <p className="text-base leading-relaxed text-foreground/90">
          I want to start something for myself, but I keep second guessing
          everything and end up doing nothing.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <Button
          type="button"
          onClick={onTryOwn}
          data-testid="button-try-own-intro"
          className="sm:flex-1"
        >
          Try my own
        </Button>
        <button
          type="button"
          onClick={onShowExample}
          data-testid="button-show-example"
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors px-3 py-2"
        >
          Show me an example
        </button>
      </div>
    </div>
  );
}

function OutputStage({ onTryOwn }: { onTryOwn: () => void }) {
  return (
    <div className="fade-up space-y-8" data-testid="stage-output">
      {/* Original input — shown as context */}
      <div className="rounded-xl border border-border bg-card/50 p-5">
        <p className="text-[11px] tracking-[0.2em] uppercase font-medium text-muted-foreground mb-2">
          Example input
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          I want to start something for myself, but I keep second guessing
          everything and end up doing nothing.
        </p>
      </div>

      <section data-testid="example-hearing">
        <Label>What I'm hearing</Label>
        <p className="mt-3 text-base md:text-[17px] leading-relaxed text-foreground/90">
          You're not actually short on ideas. You're overloaded by trying to
          make the right long-term move before giving yourself a simple place
          to start.
        </p>
      </section>

      <section data-testid="example-matters">
        <Label>What matters</Label>
        <ul className="mt-3 space-y-2 text-base md:text-[17px] leading-relaxed text-foreground/90">
          <li className="flex gap-3">
            <span className="text-primary/60 mt-[0.6em] h-px w-3 shrink-0" />
            <span>You need a starting point that lowers pressure.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary/60 mt-[0.6em] h-px w-3 shrink-0" />
            <span>Momentum matters more right now than certainty.</span>
          </li>
        </ul>
      </section>

      <section data-testid="example-noise">
        <Label>What's noise</Label>
        <ul className="mt-3 space-y-2 text-base md:text-[17px] leading-relaxed text-muted-foreground">
          <li className="flex gap-3">
            <span className="text-muted-foreground/50 mt-[0.6em] h-px w-3 shrink-0" />
            <span>Trying to pick the perfect path before taking real action.</span>
          </li>
        </ul>
      </section>

      <section data-testid="example-next">
        <Label>Next step</Label>
        <div className="mt-3 rounded-2xl border border-primary/25 bg-primary/5 p-5">
          <p className="font-serif text-xl md:text-2xl leading-snug text-foreground">
            Set a 10-minute timer and write the easiest version of the thing
            you've been avoiding.
          </p>
        </div>
      </section>

      <div className="pt-2">
        <Button
          type="button"
          onClick={onTryOwn}
          data-testid="button-try-own-output"
          className="w-full sm:w-auto"
        >
          Now try yours
        </Button>
      </div>
    </div>
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
