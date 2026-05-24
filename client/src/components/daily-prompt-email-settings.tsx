import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Me } from "@shared/schema";
import { DAILY_PROMPT_HOUR_MIN, DAILY_PROMPT_HOUR_MAX } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "America/Los_Angeles";
  }
}

function formatHourLabel(hour: number): string {
  const h = hour % 24;
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

export function DailyPromptEmailSettings({
  me,
  canPersist,
}: {
  me?: Me;
  canPersist: boolean;
}) {
  const { toast } = useToast();
  const { data, isLoading } = useNotificationPreferences(canPersist);
  const update = useUpdateNotificationPreferences();
  const [savedFlash, setSavedFlash] = useState(false);

  const prefs = data?.preferences;
  const featureEnabled = data?.featureEnabled ?? false;
  const hasEmail = data?.hasEmail ?? Boolean(me?.email?.trim());

  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(8);
  const [timezone, setTimezone] = useState(browserTimezone);

  useEffect(() => {
    if (!prefs) return;
    setEnabled(prefs.dailyPromptEmailEnabled);
    setHour(prefs.dailyPromptLocalHour ?? 8);
    setTimezone(prefs.dailyPromptTimezone ?? browserTimezone());
  }, [prefs]);

  const hourOptions = useMemo(() => {
    const min = data?.hourRange.min ?? DAILY_PROMPT_HOUR_MIN;
    const max = data?.hourRange.max ?? DAILY_PROMPT_HOUR_MAX;
    const opts: number[] = [];
    for (let h = min; h <= max; h += 1) opts.push(h);
    return opts;
  }, [data?.hourRange]);

  const save = async (patch: Parameters<typeof update.mutateAsync>[0]) => {
    try {
      await update.mutateAsync(patch);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2500);
      toast({ title: "Daily prompt settings saved" });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message.replace(/^\d+:\s*/, "")
          : "Something went wrong.";
      toast({ title: "Could not save settings", description: message });
    }
  };

  const toggleEnabled = async (next: boolean) => {
    setEnabled(next);
    if (!next) {
      await save({ dailyPromptEmailEnabled: false });
      return;
    }
    if (!hasEmail) {
      setEnabled(false);
      toast({
        title: "Add an email first",
        description: "Daily prompts are email-only. Add your email under Profile.",
      });
      return;
    }
    await save({
      dailyPromptEmailEnabled: true,
      dailyPromptLocalHour: hour,
      dailyPromptTimezone: timezone,
    });
  };

  if (!canPersist) {
    return (
      <p className="sift-v3-settings-desc text-[13px] leading-relaxed">
        Sign in to receive a gentle daily check-in by email.
      </p>
    );
  }

  if (isLoading) {
    return <p className="sift-v3-settings-desc text-[13px]">Loading notification settings…</p>;
  }

  return (
    <div className="space-y-4">
      {!featureEnabled ? (
        <p className="sift-v3-settings-desc rounded-[3px] border border-[color:var(--v3-border)] bg-[color:var(--v3-surface)] px-3 py-2 text-[12px] leading-relaxed">
          Daily prompt emails are not enabled on this server yet. You can still save preferences for when they roll out.
        </p>
      ) : null}

      <MemoryToggle
        label="Daily prompt emails"
        description="A gentle daily check-in based on what you've been circling."
        checked={enabled}
        onChange={(checked) => void toggleEnabled(checked)}
        disabled={update.isPending || (!featureEnabled && !enabled)}
      />

      {enabled ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel>Send around</FieldLabel>
            <select
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              disabled={update.isPending}
              className="sift-v3-field-box h-10 w-full px-3 text-sm"
            >
              {hourOptions.map((h) => (
                <option key={h} value={h}>
                  {formatHourLabel(h)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Timezone</FieldLabel>
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={update.isPending}
              placeholder="America/Los_Angeles"
              className="sift-v3-field-box h-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <button
              type="button"
              disabled={update.isPending}
              onClick={() =>
                void save({
                  dailyPromptLocalHour: hour,
                  dailyPromptTimezone: timezone,
                  dailyPromptEmailEnabled: true,
                })
              }
              className="sift-v3-btn-outline"
            >
              Save time
            </button>
            <button
              type="button"
              disabled={update.isPending}
              className="sift-v3-btn-ghost"
              onClick={() => void save({ pauseForDays: 7 })}
            >
              Pause for 7 days
            </button>
            {savedFlash ? (
              <span className="text-[12px] text-[color:var(--v3-leaf-mid)]">Saved</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {!hasEmail ? (
        <p className="sift-v3-settings-desc text-[12px] leading-relaxed">
          Add an email under Profile to turn this on.
        </p>
      ) : null}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="sift-v3-field-label">{children}</p>;
}

function MemoryToggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "sift-v3-toggle-row flex cursor-pointer items-start gap-3 px-3 py-3",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>
        <span className="block text-[14px] font-medium">{label}</span>
        <span className="sift-v3-settings-desc mt-0.5 block text-[12px] leading-relaxed">
          {description}
        </span>
      </span>
    </label>
  );
}
