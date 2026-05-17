const STORAGE_KEY = "sift.exerciseHandoff";

/** Stages Ways-in walk text for Home to POST as the first sift and open deepening. */
export function stageExerciseSiftHandoff(input: string): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(STORAGE_KEY, input.trim());
  } catch {
    /* ignore */
  }
}

export function readExerciseSiftHandoff(): string | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const t = sessionStorage.getItem(STORAGE_KEY);
    const v = t?.trim();
    return v ? v : null;
  } catch {
    return null;
  }
}

export function clearExerciseSiftHandoff(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
