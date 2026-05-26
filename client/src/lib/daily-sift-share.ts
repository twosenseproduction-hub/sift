import { dailySiftShareUrl } from "@shared/daily-sift-url";

export type DailySiftSharePayload = {
  promptId: number;
  themeName: string;
  promptText: string;
};

export type DailySiftShareOutcome = "shared" | "copied" | "cancelled";

export function buildDailySiftShareUrl(
  promptId: number,
  baseUrl?: string,
): string {
  const origin =
    baseUrl ??
    (typeof window !== "undefined" ? window.location.origin : undefined);
  return dailySiftShareUrl(promptId, origin ?? "https://app.siftnow.io");
}

export function dailySiftShareTitle(themeName: string): string {
  return `Today from Sift · ${themeName}`;
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard?.writeText
  ) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard is not available");
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  if (!ok) throw new Error("Clipboard is not available");
}

/**
 * Prefer native share with URL; fall back to copying the link.
 */
export async function shareDailySiftLink(
  payload: DailySiftSharePayload,
  options?: { baseUrl?: string },
): Promise<DailySiftShareOutcome> {
  const url = buildDailySiftShareUrl(payload.promptId, options?.baseUrl);
  const title = dailySiftShareTitle(payload.themeName);
  const text = payload.promptText.trim();

  const nav =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { canShare?: (data: ShareData) => boolean })
      : undefined;

  if (nav && typeof nav.share === "function") {
    const shareData: ShareData = { title, text, url };
    const canUseNative =
      typeof nav.canShare !== "function" || nav.canShare(shareData);

    if (canUseNative) {
      try {
        await nav.share(shareData);
        return "shared";
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return "cancelled";
        }
      }
    }
  }

  await copyTextToClipboard(url);
  return "copied";
}
