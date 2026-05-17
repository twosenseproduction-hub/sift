import type { ResumeState } from "@/lib/resume";
import type { SiftListItem } from "@shared/schema";

/**
 * Chooses the sift to open in conversational / deepening mode from resume hint
 * and the user's thread list. Prefers an open resume target, then any open sift.
 */
export function pickConversationSiftId(
  resume: ResumeState | null,
  sifts: SiftListItem[] | undefined,
): string | null {
  if (resume?.siftId) {
    if (!sifts?.length) return resume.siftId;
    const row = sifts.find((s) => s.id === resume.siftId);
    if (!row || row.status === "open") return resume.siftId;
  }
  const open = sifts?.find((s) => s.status === "open");
  return open?.id ?? null;
}
