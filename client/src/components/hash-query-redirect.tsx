import { useEffect } from "react";

/**
 * Hash links like `#/?dailyPrompt=1` parse as path `/?` in wouter — 404.
 * Normalize to `#/sift?...` while preserving query params.
 */
export function HashQueryRedirect() {
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash.startsWith("/?")) return;
    const qs = hash.slice(1);
    window.location.replace(`${window.location.pathname}${window.location.search}#/sift${qs.startsWith("?") ? qs : `?${qs}`}`);
  }, []);
  return null;
}
