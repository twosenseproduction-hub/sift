/** Local calendar + clock parts for IANA timezone scheduling. */
export function localDateTimeParts(
  ms: number,
  timezone: string,
): { dateKey: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const year = get("year");
  const month = get("month");
  const day = get("day");
  let hour = Number(get("hour"));
  const minute = Number(get("minute"));
  // Midnight is sometimes formatted as hour 24 in some locales.
  if (hour === 24) hour = 0;

  return {
    dateKey: `${year}-${month}-${day}`,
    hour,
    minute,
  };
}

export function localDateKeyForMs(ms: number, timezone: string): string {
  return localDateTimeParts(ms, timezone).dateKey;
}

export type DailyPromptEligibilityInput = {
  nowMs: number;
  timezone: string;
  targetLocalHour: number;
  lastSentAt: number | null;
  pausedUntil: number | null;
  /** First N minutes of the target hour when cron may send (default 15). */
  sendWindowMinutes?: number;
};

export type DailyPromptEligibilityResult = {
  eligible: boolean;
  reason: string;
  localDateKey: string;
  localHour: number;
};

export function evaluateDailyPromptEligibility(
  input: DailyPromptEligibilityInput,
): DailyPromptEligibilityResult {
  const window = input.sendWindowMinutes ?? 15;
  const { dateKey, hour, minute } = localDateTimeParts(
    input.nowMs,
    input.timezone,
  );

  if (input.pausedUntil != null && input.nowMs < input.pausedUntil) {
    return {
      eligible: false,
      reason: "paused",
      localDateKey: dateKey,
      localHour: hour,
    };
  }

  if (
    input.lastSentAt != null &&
    localDateKeyForMs(input.lastSentAt, input.timezone) === dateKey
  ) {
    return {
      eligible: false,
      reason: "already_sent_today",
      localDateKey: dateKey,
      localHour: hour,
    };
  }

  if (hour !== input.targetLocalHour) {
    return {
      eligible: false,
      reason: "wrong_hour",
      localDateKey: dateKey,
      localHour: hour,
    };
  }

  if (minute >= window) {
    return {
      eligible: false,
      reason: "outside_send_window",
      localDateKey: dateKey,
      localHour: hour,
    };
  }

  return {
    eligible: true,
    reason: "ready",
    localDateKey: dateKey,
    localHour: hour,
  };
}

export function isDailyPromptEmailFeatureEnabled(): boolean {
  const raw = (process.env.DAILY_PROMPT_EMAIL_ENABLED ?? "false").toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
