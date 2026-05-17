import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Horizontal inset for header, footnote, and main column — keep in sync everywhere. */
export const APP_SHELL_PADDING_X = "px-6 md:px-8";

/** Inner width row used by `Header` and `Footnote` (always default column width). */
export const APP_SHELL_HEADER_COLUMN = cn(
  "mx-auto w-full max-w-3xl",
  APP_SHELL_PADDING_X,
);

export type AppShellVariant = "narrow" | "default" | "reading" | "wide";

const VARIANT_MAX: Record<AppShellVariant, string> = {
  narrow: "max-w-xl",
  default: "max-w-3xl",
  reading: "max-w-2xl",
  wide: "max-w-4xl",
};

/** Classes for a standalone column matching the shell (e.g. legacy layouts). */
export function appShellMainColumnClasses(
  variant: AppShellVariant = "default",
  extra?: string,
) {
  return cn(
    "mx-auto w-full",
    VARIANT_MAX[variant],
    APP_SHELL_PADDING_X,
    extra,
  );
}

type AppShellProps = {
  header?: ReactNode;
  footer?: ReactNode;
  /** Full-viewport layer behind the shell stack (grain, particles, etc.). */
  backdrop?: ReactNode;
  /** Inside `<main>`, before the width-constrained column — use with `mainClassName="relative"` for full-bleed washes. */
  ambientMain?: ReactNode;
  children: ReactNode;
  variant?: AppShellVariant;
  className?: string;
  /** Flex stack above `backdrop` (header + main + footer). Override z-index when backdrop uses fixed z-0. */
  stackClassName?: string;
  /** Classes on `<main>`. */
  mainClassName?: string;
  /** Classes on the constrained content column (padding-bottom defaults here). */
  contentClassName?: string;
  /** Optional sticky bottom region inside `<main>` (primary CTA strip). */
  stickyFooter?: ReactNode;
  stickyFooterClassName?: string;
};

export function AppShell({
  header,
  footer,
  backdrop,
  ambientMain,
  children,
  variant = "default",
  className,
  stackClassName,
  mainClassName,
  contentClassName,
  stickyFooter,
  stickyFooterClassName,
}: AppShellProps) {
  const maxW = VARIANT_MAX[variant];

  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col",
        backdrop && "isolate",
        className,
      )}
    >
      {backdrop}
      <div
        className={cn(
          "relative flex min-h-screen flex-1 flex-col bg-transparent",
          backdrop && "z-[1]",
          stackClassName,
        )}
      >
        {header}
        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col bg-transparent",
            mainClassName,
          )}
        >
          {ambientMain}
          <div
            className={cn(
              "mx-auto w-full bg-transparent",
              APP_SHELL_PADDING_X,
              maxW,
              "pb-16",
              ambientMain && "relative",
              contentClassName,
            )}
          >
            {children}
          </div>
          {stickyFooter ? (
            <div
              className={cn(
                "sticky bottom-0 z-10 mt-auto border-t border-border/40",
                "bg-background/92 backdrop-blur-xl supports-[backdrop-filter]:bg-background/78",
                "pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3",
              )}
            >
              <div
                className={cn(
                  "mx-auto w-full",
                  APP_SHELL_PADDING_X,
                  maxW,
                  stickyFooterClassName,
                )}
              >
                {stickyFooter}
              </div>
            </div>
          ) : null}
        </main>
        {footer}
      </div>
    </div>
  );
}
