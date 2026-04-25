// Resume state — "pick up where you left off"
//
// Smallest clean implementation of a recovery hint. We persist just enough to
// route the user back into a thread that was in progress: the sift id, an
// "in progress" flag, and the last-touched timestamp. Bookmark content itself
// is NOT duplicated here — the server is the source of truth for /s/:id.
//
// Storage: localStorage key "sift.resume". This is one of the narrowly-scoped
// overrides of the no-storage rule (same pattern as sift.authToken and
// sift.contactPromptDismissed) — persistence across a full page reload is
// required for this feature to exist.
//
// Expiry: if a resume entry is older than 7 days we treat it as stale and
// ignore it. This keeps the card from showing up weeks later out of nowhere.

const KEY = "sift.resume";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface ResumeState {
  siftId: string;
  updatedAt: number; // epoch ms
  // Optional breadcrumbs — purely cosmetic for the recovery card. The
  // authoritative data lives on the server.
  lastCheckpointAt?: number;
  lastSortAt?: number;
}

function safeWindow(): Window | null {
  try {
    return typeof window !== "undefined" ? window : null;
  } catch {
    return null;
  }
}

export function readResume(): ResumeState | null {
  const w = safeWindow();
  if (!w) return null;
  try {
    const raw = w.localStorage?.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResumeState;
    if (!parsed || typeof parsed.siftId !== "string" || !parsed.siftId) {
      return null;
    }
    if (typeof parsed.updatedAt !== "number") return null;
    if (Date.now() - parsed.updatedAt > MAX_AGE_MS) {
      // Stale — clear silently so we don't keep surfacing an old thread.
      w.localStorage?.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeResume(partial: Partial<ResumeState> & { siftId: string }) {
  const w = safeWindow();
  if (!w) return;
  try {
    const prior = readResume();
    const merged: ResumeState = {
      ...(prior && prior.siftId === partial.siftId ? prior : { siftId: partial.siftId, updatedAt: 0 }),
      ...partial,
      updatedAt: Date.now(),
    };
    w.localStorage?.setItem(KEY, JSON.stringify(merged));
    // Let listeners (Home) react without waiting for a remount or focus event.
    w.dispatchEvent(new CustomEvent("sift:resume-updated"));
  } catch {
    /* swallow — resume is best-effort */
  }
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

// React hook — reads the current resume state and keeps in sync with
// write/clear events from anywhere in the app, plus cross-tab storage events.
import { useEffect, useState } from "react";

export function useResume(): ResumeState | null {
  const [state, setState] = useState<ResumeState | null>(() => readResume());

  useEffect(() => {
    const sync = () => setState(readResume());
    window.addEventListener("sift:resume-updated", sync);
    window.addEventListener("storage", (e) => {
      if (e.key === null || e.key === KEY) sync();
    });
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("sift:resume-updated", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  return state;
}
