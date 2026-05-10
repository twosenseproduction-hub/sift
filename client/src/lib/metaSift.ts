const STORAGE_PENDING = "sift.pendingMetaSift";
const STORAGE_BANNER = "sift.metaSiftBanner";
const STORAGE_PREFILL = "sift.metaSiftPrefill";

/**
 * Navigate home with composer pre-filled for a pattern-level sift (meta-sift).
 * POST /api/sift picks up `metaSift: true` via sessionStorage in apiRequest.
 */
export function triggerMetaSift(theme: string, threadIds: string[]) {
  const count = threadIds.length;
  const text = `I keep coming back to ${theme}. It's shown up in ${count} different threads.
Help me understand what this pattern is really about and what one move would address the root, not just the instance.`;
  try {
    sessionStorage.setItem(STORAGE_PENDING, "1");
    sessionStorage.setItem(STORAGE_BANNER, `Sifting a pattern across ${count} threads`);
    sessionStorage.setItem(STORAGE_PREFILL, text.trim());
  } catch {
    /* ignore */
  }
  window.location.hash = "/";
}
