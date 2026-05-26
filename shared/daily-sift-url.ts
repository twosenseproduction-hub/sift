/** Hash-router path for a shareable Daily Sift (library prompt by id). */
export function dailySiftSharePath(promptId: number): string {
  return `/daily-sift/${promptId}`;
}

/** Full app URL for sharing (hash router on app.siftnow.io). */
export function dailySiftShareUrl(
  promptId: number,
  baseUrl = "https://app.siftnow.io",
): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/#${dailySiftSharePath(promptId)}`;
}
