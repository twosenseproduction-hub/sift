const PREFILL_KEY = "sift:daily-prefill";

export function stashDailySiftPrefill(text: string) {
  try {
    sessionStorage.setItem(PREFILL_KEY, text);
  } catch {
    // ignore quota / private mode
  }
}

export function takeDailySiftPrefill(): string | null {
  try {
    const value = sessionStorage.getItem(PREFILL_KEY);
    if (value) sessionStorage.removeItem(PREFILL_KEY);
    return value;
  } catch {
    return null;
  }
}
