import { forwardRef } from "react";
import { LogoMark } from "@/components/brand";

export const SHARE_CARD_EXPORT_WIDTH = 1080;
export const SHARE_CARD_EXPORT_HEIGHT = 1920;
/** Matches export canvas for story-style portrait shares. */
export const SHARE_CARD_EXPORT_ASPECT = "9 / 16" as const;

interface SharePromptCardProps {
  eyebrow?: string;
  /** Optional label above the main line (e.g. reflection title). */
  title?: string;
  line: string;
  date?: Date;
  /**
   * When true, renders at a fixed export size (suitable for html-to-image).
   * When false, renders fluid for on-screen preview.
   */
  exportMode?: boolean;
}

const DEFAULT_EYEBROW = "Today from Sift";

const SERIF =
  "'Cormorant Garamond', 'Instrument Serif', Georgia, 'Times New Roman', serif";
const SANS =
  "'DM Sans', 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Base fill for PNG export — matches card gradient endpoint. */
export const SHARE_CARD_EXPORT_BACKGROUND = "#152420";

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
 * SharePromptCard — editorial 9:16 portrait surface for Daily Sift (and
 * reflection shares). Full-bleed botanical atmosphere, white serif prompt,
 * restrained Sift mark. Renders as a self-contained DOM node for preview +
 * html-to-image export.
 */
export const SharePromptCard = forwardRef<HTMLDivElement, SharePromptCardProps>(
  function SharePromptCard(
    {
      eyebrow = DEFAULT_EYEBROW,
      title,
      line,
      date,
      exportMode = false,
    },
    ref,
  ) {
    const dateLabel = date ? formatDate(date) : "";

    const wrapperStyle = exportMode
      ? {
          width: SHARE_CARD_EXPORT_WIDTH,
          height: SHARE_CARD_EXPORT_HEIGHT,
          padding: 88,
        }
      : undefined;

    const eyebrowClass = exportMode
      ? "text-[20px] tracking-[0.32em]"
      : "text-[9px] md:text-[10px] tracking-[0.28em]";
    const titleClass = exportMode
      ? "text-[44px] leading-[1.2]"
      : "text-xl md:text-2xl leading-[1.2]";
    const lineClass = exportMode
      ? "text-[64px] leading-[1.22]"
      : "text-[1.65rem] md:text-[1.85rem] leading-[1.25]";
    const footerClass = exportMode
      ? "text-[18px] tracking-[0.22em]"
      : "text-[9px] md:text-[10px] tracking-[0.2em]";
    const wordmarkClass = exportMode
      ? "text-[32px] leading-none"
      : "text-base md:text-lg leading-none";
    const logoSize = exportMode ? 40 : 20;

    return (
      <div
        ref={ref}
        data-testid="share-prompt-card"
        data-export-mode={exportMode ? "true" : "false"}
        className={[
          "relative flex flex-col justify-between overflow-hidden",
          "text-white",
          exportMode ? "" : "w-full aspect-[9/16] rounded-2xl",
          !exportMode ? "p-8 md:p-10" : "",
        ].join(" ")}
        style={{
          ...wrapperStyle,
          fontFamily: SANS,
        }}
      >
        {/* Atmospheric background */}
        <div
          className="absolute inset-0"
          aria-hidden
          style={{
            background:
              "linear-gradient(168deg, #1a3328 0%, #2a4a3c 38%, #243d32 62%, #152420 100%)",
          }}
        />
        <div
          className="absolute -left-[18%] top-[8%] h-[55%] w-[70%] rounded-full opacity-70 blur-[80px]"
          aria-hidden
          style={{ background: "radial-gradient(circle, #4a7c59 0%, transparent 70%)" }}
        />
        <div
          className="absolute -right-[12%] bottom-[18%] h-[48%] w-[62%] rounded-full opacity-55 blur-[90px]"
          aria-hidden
          style={{ background: "radial-gradient(circle, #3d6b52 0%, transparent 72%)" }}
        />
        <div
          className="absolute left-[20%] top-[42%] h-[38%] w-[50%] rounded-full opacity-35 blur-[70px]"
          aria-hidden
          style={{ background: "radial-gradient(circle, #5a8f6a 0%, transparent 68%)" }}
        />
        {/* Subtle grain */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-overlay"
          aria-hidden
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
            backgroundSize: "128px 128px",
          }}
        />

        <div className="relative z-[1] flex h-full min-h-0 flex-col justify-between">
          <div className="flex items-start justify-between gap-6">
            <p
              className={[
                "font-medium uppercase text-white/72",
                eyebrowClass,
              ].join(" ")}
            >
              {eyebrow}
            </p>
            {dateLabel ? (
              <p
                className={[
                  "font-medium uppercase text-white/55 text-right whitespace-nowrap",
                  exportMode ? "" : "hidden sm:block",
                  eyebrowClass,
                ].join(" ")}
              >
                {dateLabel}
              </p>
            ) : null}
          </div>

          <div
            className={exportMode ? "flex flex-col gap-8 py-6" : "flex flex-col gap-4 py-4 md:gap-5"}
            style={{ fontFamily: SERIF }}
          >
            {title ? (
              <p className={["font-light text-white/80", titleClass].join(" ")}>
                {title}
              </p>
            ) : null}
            <p className={["font-light text-white", lineClass].join(" ")}>
              {line}
            </p>
          </div>

          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-3 text-white/90">
              <LogoMark size={logoSize} />
              <span
                className={["tracking-tight whitespace-nowrap", wordmarkClass].join(" ")}
                style={{ fontFamily: SERIF }}
              >
                Sift
              </span>
            </div>
            <span
              className={[
                "font-medium uppercase text-white/50 whitespace-nowrap",
                footerClass,
              ].join(" ")}
            >
              siftnow.io
            </span>
          </div>
        </div>
      </div>
    );
  },
);
