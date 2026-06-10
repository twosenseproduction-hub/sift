import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const COMPOSER_MIN_HEIGHT_PX = 175;

function readComposerMaxHeight(el: HTMLTextAreaElement): number {
  const maxHeight = getComputedStyle(el).maxHeight;
  if (!maxHeight || maxHeight === "none") return Number.POSITIVE_INFINITY;
  const parsed = Number.parseFloat(maxHeight);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function V3ComposerBox({
  value,
  onChange,
  onSubmit,
  disabled,
  onVoiceClick,
  voiceListening = false,
  thinking = false,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  onVoiceClick: () => void;
  voiceListening?: boolean;
  thinking?: boolean;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const trimmed = value.trim();

  const keepComposerInView = useCallback(() => {
    window.requestAnimationFrame(() => {
      boxRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, []);

  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = readComposerMaxHeight(el);
    const next = Math.min(
      Math.max(el.scrollHeight, COMPOSER_MIN_HEIGHT_PX),
      maxHeight,
    );
    el.style.height = `${next}px`;
  }, [value]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const onViewportChange = () => {
      if (document.activeElement === taRef.current) {
        keepComposerInView();
      }
    };

    viewport.addEventListener("resize", onViewportChange);
    viewport.addEventListener("scroll", onViewportChange);
    return () => {
      viewport.removeEventListener("resize", onViewportChange);
      viewport.removeEventListener("scroll", onViewportChange);
    };
  }, [keepComposerInView]);

  useEffect(() => {
    function onComposerFocus(e: Event) {
      const ce = e as CustomEvent<{ select?: boolean }>;
      window.setTimeout(() => {
        taRef.current?.focus();
        if (ce.detail?.select) taRef.current?.select();
      }, 0);
    }
    window.addEventListener("sift:focus-composer", onComposerFocus as EventListener);
    return () =>
      window.removeEventListener("sift:focus-composer", onComposerFocus as EventListener);
  }, []);

  return (
    <div ref={boxRef} className={cn("v3-composer-box", className)}>
      <textarea
        ref={taRef}
        value={value}
        disabled={disabled}
        rows={6}
        onChange={(e) => onChange(e.target.value)}
        onFocus={keepComposerInView}
        onPaste={() => {
          window.setTimeout(keepComposerInView, 0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (!disabled && trimmed) onSubmit();
          }
        }}
        placeholder="Type or paste the tangle. Unpolished is fine."
        className="v3-composer-textarea"
        data-testid="bedroom-composer-input"
      />
      <div className="v3-composer-toolbar">
        <div className="v3-toolbar-hints">
          {voiceListening ? (
            <div className="v3-voice-recording active">
              <div className="v3-voice-pulse" aria-hidden />
              <div className="v3-voice-bars" aria-hidden>
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="v3-voice-bar" />
                ))}
              </div>
              <button type="button" className="v3-voice-stop" onClick={onVoiceClick}>
                tap to stop
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={disabled}
                className="v3-hint-tag"
                onClick={() => {
                  if (trimmed) onChange("");
                  taRef.current?.focus();
                }}
              >
                clear
              </button>
              <button
                type="button"
                disabled={disabled}
                className="v3-hint-tag"
                onClick={onVoiceClick}
              >
                use voice
              </button>
            </>
          )}
        </div>
        <button
          type="button"
          disabled={disabled || !trimmed || thinking}
          onClick={() => trimmed && onSubmit()}
          className="v3-sift-btn"
        >
          {thinking ? "Sifting…" : "Sift →"}
        </button>
      </div>
    </div>
  );
}
