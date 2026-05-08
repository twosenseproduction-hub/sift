import { useState, useEffect } from "react";

type ResumeEntry = {
  siftId: string;
  lastCheckpointAt?: number;
  lastSortAt?: number;
  draftText?: string;
  updatedAt: number;
};

const KEY = "sift.resume";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function safeWindow(): Window | null {
  try {
    return typeof window !== "undefined" ? window : null;
  } catch {
    return null;
  }
}

export function readResume(): ResumeEntry | null {
  const w = safeWindow();
  if (!w) return null;
  try {
    const raw = w.localStorage?.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResumeEntry;
    if (!parsed || typeof parsed.siftId !== "string" || !parsed.siftId) {
      return null;
    }
    if (typeof parsed.updatedAt !== "number") return null;
    if (Date.now() - parsed.updatedAt > MAX_AGE_MS) {
      w.localStorage?.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeResume(entry: {
  siftId: string;
  lastCheckpointAt?: number;
  lastSortAt?: number;
  draftText?: string;
}) {
  const w = safeWindow();
  if (!w) return;
  try {
    const prior = readResume();
    const merged: ResumeEntry = {
      ...(prior && prior.siftId === entry.siftId ? prior : { siftId: entry.siftId, updatedAt: 0 }),
      ...entry,
      updatedAt: Date.now(),
    };
    w.localStorage?.setItem(KEY, JSON.stringify(merged));
    w.dispatchEvent(new CustomEvent("sift:resume-updated"));
  } catch {
    /* swallow — resume is best-effort */
  }
}

export function getResumeDraft(siftId: string): string | null {
  const resume = readResume();
  if (!resume) return null;
  if (resume.siftId !== siftId) return null;
  return resume.draftText ?? null;
}

export function clearResume() {
  const w = safeWindow();
  if (!w) return;
  try {
    w.localStorage?.removeItem(KEY);
    w.dispatchEvent(new CustomEvent("sift:resume-updated"));
  } catch {
    /* swallow */
  }
}

// DEPRECATED — kept for source compatibility during transition.
// The old interface had optional lastCheckpointAt/lastSortAt on the shape
// but no draftText. New call sites should use writeResume({ siftId, ... })
// with explicit draftText instead.
export function writeResumeLegacy(partial: { siftId: string; lastCheckpointAt?: number; lastSortAt?: number }) {
  writeResume(partial);
}

// useResume — React hook that wraps readResume and subscribes to resume-change
// events so the UI re-renders reactively when localStorage is updated.
export function useResume(): ResumeEntry | null {
  const [resume, setResume] = useState<ResumeEntry | null>(null);
  useEffect(() => {
    setResume(readResume());
    const onUpdate = () => setResume(readResume());
    window.addEventListener("sift:resume-updated", onUpdate);
    return () => window.removeEventListener("sift:resume-updated", onUpdate);
  }, []);
  return resume;
}