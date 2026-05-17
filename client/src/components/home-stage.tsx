import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Primary workspace tray on home — one quiet surface (avoid stacking blur + heavy shadow). */
export function HomeStage({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & React.ComponentPropsWithoutRef<"section">) {
  return (
    <section
      data-testid="home-stage"
      className={cn(
        "rounded-2xl border border-border/40",
        "bg-card/70 dark:bg-card/80",
        "shadow-sm",
        "px-4 py-5 sm:px-6 sm:py-6 md:px-7 md:py-8",
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  );
}
