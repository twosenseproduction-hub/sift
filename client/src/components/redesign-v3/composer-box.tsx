import { useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

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
  const taRef = useRef<HTMLTextAreaElement>(null);
  const trimmed = value.trim();

  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 175)}px`;
  }, [value]);

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
    <div className={cn("v3-composer-box", className)}>
      <textarea
        ref={taRef}
        value={value}
        disabled={disabled}
        rows={6}
        onChange={(e) => onChange(e.target.value)}
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
