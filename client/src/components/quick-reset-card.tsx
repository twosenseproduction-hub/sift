interface Props {
  onStart: () => void;
  onSkip: () => void;
}

/**
 * QuickResetCard
 *
 * A quiet, optional module. Lives lower on the home screen — secondary to
 * the main composer flow. Intentionally text-only and low-contrast so it
 * reads as an aside rather than a feature. No card chrome, no CTA button:
 * a soft line with two small text actions keeps the tone reflective.
 */
export function QuickResetCard({ onStart, onSkip }: Props) {
  return (
    <section
      aria-labelledby="quick-reset-title"
      className="mt-12 md:mt-16 pt-6 md:pt-8 border-t border-border/40"
      data-testid="card-quick-reset"
    >
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p
            id="quick-reset-title"
            className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground/80 font-medium"
            data-testid="text-quick-reset-eyebrow"
          >
            Quick reset
          </p>
          <p
            className="mt-1.5 text-sm md:text-[15px] leading-snug text-muted-foreground"
            data-testid="text-quick-reset-line"
          >
            Sort what matters from what is just noise.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-4 text-sm">
          <button
            type="button"
            onClick={onStart}
            data-testid="button-quick-reset-start"
            className="text-foreground/80 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
          >
            Try it
          </button>
          <button
            type="button"
            onClick={onSkip}
            data-testid="link-quick-reset-skip"
            className="text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            Hide
          </button>
        </div>
      </div>
    </section>
  );
}
