import { useEffect } from "react";

/**
 * Keeps the UI on the warm light palette (same tokens as the room home).
 * Dark mode is not exposed in the product chrome.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);
  return <>{children}</>;
}
