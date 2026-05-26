import { useEffect } from "react";

/**
 * Hash links like `#/?dailyPrompt=1` parse as path `/?` in wouter — 404.
 * Normalize to `#/sift?...` while preserving query params.
 * Email deep links with a prompt id route to the public Daily Sift page.
 */
export function HashQueryRedirect() {
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const qIndex = hash.indexOf("?");
    if (qIndex !== -1) {
      const params = new URLSearchParams(hash.slice(qIndex));
      const promptId = params.get("promptId");
      if (params.get("dailyPrompt") === "1" && promptId && /^\d+$/.test(promptId)) {
        window.location.replace(
          `${window.location.pathname}${window.location.search}#/daily-sift/${promptId}`,
        );
        return;
      }
    }

    if (!hash.startsWith("/?")) return;
    const qs = hash.slice(1);
    window.location.replace(
      `${window.location.pathname}${window.location.search}#/sift${qs.startsWith("?") ? qs : `?${qs}`}`,
    );
  }, []);
  return null;
}
