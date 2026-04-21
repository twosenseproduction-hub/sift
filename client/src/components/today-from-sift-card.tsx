import { Button } from "@/components/ui/button";

interface TodayFromSiftCardProps {
  onOpen?: () => void;
}

/**
 * TodayFromSiftCard
 *
 * A quiet, daily nudge shown to returning signed-in users above the composer.
 * Intentionally small — eyebrow, one reflective line, one CTA.
 * Stays smaller than the composer so the header invitation above remains
 * the primary moment on the page.
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
      className="mb-6 md:mb-8 rounded-xl border border-border/60 bg-card/60 px-5 py-4 md:px-6 md:py-5"
      data-testid="card-today-from-sift"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-medium"
            data-testid="text-today-eyebrow"
          >
            Today from Sift
          </p>
          <p
            id="today-from-sift-title"
            className="mt-2 font-serif text-base md:text-lg leading-snug text-foreground"
            data-testid="text-today-line"
          >
            You do not need a full plan. You need one visible start.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleOpen}
          data-testid="button-today-open"
          className="shrink-0 whitespace-nowrap"
        >
          Open today’s prompt
        </Button>
      </div>
    </section>
  );
}
