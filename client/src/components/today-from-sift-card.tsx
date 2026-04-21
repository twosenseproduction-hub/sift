import { Button } from "@/components/ui/button";

interface TodayFromSiftCardProps {
  onOpen?: () => void;
}

/**
 * TodayFromSiftCard
 *
 * A quiet, daily nudge shown to returning signed-in users above the composer.
 * Intentionally minimal — one eyebrow, one title, one reflective line, one CTA.
 * Matches the visual language of SaveThreadBanner (rounded-xl, light border,
 * measured padding) but leans calmer: neutral surface instead of tinted,
 * serif main line, and generous whitespace.
 */
export function TodayFromSiftCard({ onOpen }: TodayFromSiftCardProps) {
  const handleOpen = () => {
    if (onOpen) {
      onOpen();
      return;
    }
    // Placeholder: no destination yet. Kept silent so the page does not
    // navigate or surface state until the feature is wired up.
  };

  return (
    <section
      aria-labelledby="today-from-sift-title"
      className="mb-8 md:mb-10 rounded-xl border border-border/70 bg-card px-6 py-6 md:px-8 md:py-8"
      data-testid="card-today-from-sift"
    >
      <p
        className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground font-medium"
        data-testid="text-today-eyebrow"
      >
        Today from Sift
      </p>

      <h2
        id="today-from-sift-title"
        className="mt-3 text-sm text-muted-foreground"
        data-testid="text-today-title"
      >
        What matters today
      </h2>

      <p
        className="mt-4 font-serif text-xl md:text-2xl leading-snug text-foreground"
        data-testid="text-today-line"
      >
        You do not need a full plan. You need one visible start.
      </p>

      <div className="mt-6">
        <Button
          size="sm"
          onClick={handleOpen}
          data-testid="button-today-open"
        >
          Open today’s move
        </Button>
      </div>
    </section>
  );
}
