const BYOK_KEY = "sift.byokAnthropicKey";

export function getBYOKAnthropicKey(): string | null {
  try {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem(BYOK_KEY)?.trim() || null
      : null;
  } catch {
    return null;
  }
}

export function setBYOKAnthropicKey(key: string | null): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (key && key.trim()) localStorage.setItem(BYOK_KEY, key.trim());
    else localStorage.removeItem(BYOK_KEY);
  } catch {
    /* ignore */
  }
}
