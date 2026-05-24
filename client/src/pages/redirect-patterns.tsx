import { useEffect } from "react";
import { useLocation } from "wouter";

/** Legacy garden route → Patterns (v3). */
export default function RedirectPatterns() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/patterns");
  }, [setLocation]);
  return null;
}
