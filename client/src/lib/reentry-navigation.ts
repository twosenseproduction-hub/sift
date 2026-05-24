import type { ReEntryAction } from "@shared/schema";
import { isRedesignV3Enabled } from "@/lib/use-redesign-v3";

/** Where smart re-entry should land — v3 avoids legacy /s/:id Shared. */
export function reentryPrimaryHref(action: ReEntryAction): string {
  if (isRedesignV3Enabled()) {
    switch (action.type) {
      case "compare":
        return `/library/${encodeURIComponent(action.currentSiftId)}`;
      case "checkin":
      case "revisit":
        return `/s/${encodeURIComponent(action.threadId)}/chat`;
    }
  }

  switch (action.type) {
    case "compare":
      return `/s/${encodeURIComponent(action.currentSiftId)}`;
    case "checkin":
    case "revisit":
      return `/s/${encodeURIComponent(action.threadId)}`;
  }
}

export function reentryPrimaryLabel(action: ReEntryAction): string {
  switch (action.type) {
    case "compare":
      return "Open this sift";
    case "checkin":
      return "Check in";
    case "revisit":
      return "Pick it up";
  }
}
