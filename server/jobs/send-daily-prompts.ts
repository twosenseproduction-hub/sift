import { selectDailyPrompt } from "../daily-prompt";
import { buildDailyPromptInputForUser } from "../daily-prompt-context";
import {
  evaluateDailyPromptEligibility,
  isDailyPromptEmailFeatureEnabled,
} from "../lib/daily-prompt-eligibility";
import {
  buildDailyPromptCtaUrl,
  sendDailyPromptEmail,
} from "../email/daily-prompt-email";
import { storage } from "../storage";

export type DailyPromptJobResult = {
  scanned: number;
  eligible: number;
  sent: number;
  skipped: number;
  failed: number;
  featureEnabled: boolean;
  details: Array<{
    userId: number;
    status: "sent" | "skipped" | "failed";
    reason?: string;
    promptId?: number;
    error?: string;
  }>;
};

function firstNameFromHandle(handle: string): string | null {
  const trimmed = handle.trim();
  if (!trimmed) return null;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export async function runSendDailyPromptsJob(
  nowMs = Date.now(),
): Promise<DailyPromptJobResult> {
  const featureEnabled = isDailyPromptEmailFeatureEnabled();
  const result: DailyPromptJobResult = {
    scanned: 0,
    eligible: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    featureEnabled,
    details: [],
  };

  if (!featureEnabled) {
    console.log("[daily-prompt-job] DAILY_PROMPT_EMAIL_ENABLED is off — skipping batch");
    return result;
  }

  const candidates = await storage.listDailyPromptEmailCandidates();
  result.scanned = candidates.length;

  for (const candidate of candidates) {
    const { userId, email, handle, prefs } = candidate;
    const timezone = prefs.dailyPromptTimezone!;
    const targetHour = prefs.dailyPromptLocalHour!;

    const eligibility = evaluateDailyPromptEligibility({
      nowMs,
      timezone,
      targetLocalHour: targetHour,
      lastSentAt: prefs.lastDailyPromptSentAt,
      pausedUntil: prefs.dailyPromptPausedUntil,
    });

    if (!eligibility.eligible) {
      result.skipped += 1;
      result.details.push({
        userId,
        status: "skipped",
        reason: eligibility.reason,
      });
      continue;
    }

    result.eligible += 1;

    let selection;
    try {
      const input = buildDailyPromptInputForUser(
        userId,
        eligibility.localHour,
        nowMs,
      );
      selection = selectDailyPrompt(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Prompt selection failed";
      result.failed += 1;
      result.details.push({ userId, status: "failed", error: message });
      console.error(`[daily-prompt-job] select failed user=${userId}: ${message}`);
      continue;
    }

    const claimed = storage.claimDailyPromptSend(
      userId,
      eligibility.localDateKey,
      selection.prompt.id,
      nowMs,
    );
    if (!claimed) {
      result.skipped += 1;
      result.details.push({
        userId,
        status: "skipped",
        reason: "claim_failed_or_duplicate",
      });
      continue;
    }

    try {
      const sendResult = await sendDailyPromptEmail({
        to: email,
        firstName: firstNameFromHandle(handle),
        promptText: selection.prompt.text,
        themeName: selection.themeName,
        promptId: selection.prompt.id,
        ctaUrl: buildDailyPromptCtaUrl(selection.prompt.id),
      });

      if (!sendResult.ok) {
        // Release claim so a later cron pass can retry today.
        await storage.upsertNotificationPreferences(userId, {
          lastDailyPromptSentAt: prefs.lastDailyPromptSentAt,
          lastDailyPromptPromptId: prefs.lastDailyPromptPromptId,
        });
        result.failed += 1;
        result.details.push({
          userId,
          status: "failed",
          error: sendResult.error,
        });
        console.error(
          `[daily-prompt-job] send failed user=${userId}: ${sendResult.error}`,
        );
        continue;
      }

      result.sent += 1;
      result.details.push({
        userId,
        status: "sent",
        promptId: selection.prompt.id,
      });
      console.log(
        `[daily-prompt-job] sent user=${userId} prompt=${selection.prompt.id} resend=${sendResult.id}`,
      );
    } catch (err) {
      await storage.upsertNotificationPreferences(userId, {
        lastDailyPromptSentAt: prefs.lastDailyPromptSentAt,
        lastDailyPromptPromptId: prefs.lastDailyPromptPromptId,
      });
      const message = err instanceof Error ? err.message : "Unknown error";
      result.failed += 1;
      result.details.push({
        userId,
        status: "failed",
        error: message,
      });
      console.error(`[daily-prompt-job] error user=${userId}: ${message}`);
    }
  }

  console.log(
    `[daily-prompt-job] done scanned=${result.scanned} eligible=${result.eligible} sent=${result.sent} skipped=${result.skipped} failed=${result.failed}`,
  );
  return result;
}
