import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "sift.redesignV3";

function readEnabled(): boolean {
  return true;
}

let listeners: Array<() => void> = [];

function subscribe(onStoreChange: () => void) {
  listeners = [...listeners, onStoreChange];
  return () => {
    listeners = listeners.filter((l) => l !== onStoreChange);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

export function useRedesignV3() {
  const enabled = useSyncExternalStore(subscribe, readEnabled, () => true);

  const setEnabled = useCallback((next: boolean) => {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    emit();
  }, []);

  return { enabled, setEnabled };
}

export function isRedesignV3Enabled() {
  return readEnabled();
}
