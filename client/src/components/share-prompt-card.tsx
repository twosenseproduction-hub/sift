import { forwardRef } from "react";
import { Logo } from "@/components/brand";

interface SharePromptCardProps {
  eyebrow?: string;
  title: string;
  line: string;
  date?: Date;
  /**
   * When true, renders at a fixed export size (suitable for html-to-image).
   * When false, renders fluid for on-screen preview.
   */
  exportMode?: boolean;
}

const DEFAULT_EYEBROW = "Today from Sift";

function formatDate(d: Date) {
  try {
    return d
      .toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
      .toUpperCase();
  } catch {
    return "";
  }
}

/**
 * SharePromptCard
 *
 * A standalone, screenshot-friendly surface for the daily prompt. Renders as a
 * self-contained DOM node (no outer app chrome) so it can be both previewed
 * inside a dialog and captured to PNG via html-to-image.
 *
 * Design: warm editorial. Cream surface, thin hairline borders, serif for the
 * prompt itself, tracked sans for the eyebrow and date. One primary typographic
 * moment — the prompt line. Decoration is a single thin divider.
 */
export const SharePromptCard = forwardRef<HTMLDivElement, SharePromptCardProps>(
  function SharePromptCard(
    { eyebrow = DEFAULT_EYEBROW, title, line, date, exportMode = false },
    ref,
  ) {
    const dateLabel = date ? formatDate(date) : "";

    // Fixed dimensions for export keep the captured PNG predictable across
    // viewports. On-screen, the card scales with its container so it reads
    // well on small phones.
    const wrapperClass = exportMode
      ? "w-[1080px] h-[1350px] p-24"
      : "w-full aspect-[4/5] p-8 md:p-12";

    // Typographic scale differs between export (pixel-exact 1080px canvas) and
    // preview (fluid). Pairs: serif display + sans eyebrow/date.
    const eyebrowClass = exportMode
      ? "text-[22px] tracking-[0.28em]"
      : "text-[10px] md:text-[11px] tracking-[0.25em]";
    const titleClass = exportMode
      ? "text-[72px] leading-[1.1]"
      : "text-2xl md:text-4xl leading-[1.15]";
    const lineClass = exportMode
      ? "text-[56px] leading-[1.3]"
      : "text-lg md:text-2xl leading-[1.3]";
    // Footer tagline uses the same uppercase tracked label style as the eyebrow.
    const footerClass = exportMode
      ? "text-[20px] tracking-[0.25em]"
      : "text-[10px] md:text-[11px] tracking-[0.22em]";
    // The "Sift" wordmark next to the logo is the brand signature — serif,
    // title-case, matching the site header. Never uppercase.
    const wordmarkClass = exportMode
      ? "text-[40px] leading-none"
      : "text-lg md:text-xl leading-none";
    const logoSize = exportMode ? 48 : 22;
    const rulerClass = exportMode ? "h-px w-24" : "h-px w-10 md:w-12";

    return (
      <div
        ref={ref}
        data-testid="share-prompt-card"
        className={[
          "relative flex flex-col justify-between",
          "bg-[#F7F6F2] text-[#28251D]",
          "border border-[#D4D1CA] rounded-2xl",
          "overflow-hidden",
          wrapperClass,
        ].join(" ")}
        style={{
          // Inline font-family so the exported PNG matches the preview
          // even if Tailwind classes are purged differently at runtime.
          fontFamily:
            "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {/* Top: eyebrow + optional date. Date is hidden on narrow previews so
            the two labels never collide — the export canvas is wide enough
            to always show both. */}
        <div className="flex items-start justify-between gap-6">
          <p
            className={[
              "font-medium uppercase text-[#7A7974]",
              eyebrowClass,
            ].join(" ")}
          >
            {eyebrow}
          </p>
          {dateLabel && (
            <p
              className={[
                "font-medium uppercase text-[#7A7974] text-right whitespace-nowrap",
                exportMode ? "" : "hidden sm:block",
                eyebrowClass,
              ].join(" ")}
            >
              {dateLabel}
            </p>
          )}
        </div>

        {/* Middle: category title + prompt line. Serif for the editorial moment. */}
        <div
          className={exportMode ? "flex flex-col gap-10" : "flex flex-col gap-4 md:gap-6"}
          style={{
            fontFamily:
              "'Instrument Serif', 'Source Serif 4', Georgia, 'Times New Roman', serif",
          }}
        >
          <div className={rulerClass + " bg-[#01696F]/60"} aria-hidden />
          <h2
            className={["font-normal text-[#28251D]", titleClass].join(" ")}
          >
            {title}
          </h2>
          <p
            className={["font-normal text-[#28251D]/75 italic", lineClass].join(" ")}
          >
            {line}
          </p>
        </div>

        {/* Footer: small Sift wordmark + hairline. Quiet brand signature.
            The tagline is hidden on narrow previews so the logo row never
            wraps — the export canvas always shows both. */}
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 text-[#28251D]">
            <Logo size={logoSize} />
            <span
              className={[
                "text-[#28251D] tracking-tight whitespace-nowrap",
                wordmarkClass,
              ].join(" ")}
              style={{
                fontFamily:
                  "'Instrument Serif', 'Source Serif 4', Georgia, 'Times New Roman', serif",
              }}
            >
              Sift
            </span>
          </div>
          <span
            className={[
              "font-medium uppercase text-[#7A7974] whitespace-nowrap",
              exportMode ? "" : "hidden sm:inline",
              footerClass,
            ].join(" ")}
          >
            Clarity over comfort
          </span>
        </div>
      </div>
    );
  },
);
