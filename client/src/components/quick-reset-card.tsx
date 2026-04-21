import { Button } from "@/components/ui/button";

interface Props {
  onStart: () => void;
  onSkip: () => void;
}

/**
 * QuickResetCard
 *
 * A very small, optional card that sits above the composer on the home screen.
 * Matches the visual weight of TodayFromSiftCard so it stays a quiet ritual,
 * not a product area.
 */
export function QuickResetCard({ onStart, onSkip }: Props) {
  return (
    <section
      aria-labelledby="quick-reset-title"
      className="mb-6 md:mb-8 rounded-xl border border-border/60 bg-card/60 px-5 py-4 md:px-6 md:py-5"
      data-testid="card-quick-reset"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            id="quick-reset-title"
            className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-medium"
            data-testid="text-quick-reset-eyebrow"
          >
            Quick reset
          </p>
          <p
            className="mt-2 font-serif text-base md:text-lg leading-snug text-foreground"
            data-testid="text-quick-reset-line"
          >
            Sort what feels loud from what feels real.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={onSkip}
            data-testid="link-quick-reset-skip"
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
          >
            Skip
          </button>
          <Button
            size="sm"
            variant="outline"
            onClick={onStart}
            data-testid="button-quick-reset-start"
            className="whitespace-nowrap"
          >
            Start
          </Button>
        </div>
      </div>
    </section>
  );
}
