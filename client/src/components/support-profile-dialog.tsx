import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Me, SupportProfile, SupportProfileUpdateRequest } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  useDeleteAccount,
  useDeleteAllHistory,
  useExportData,
  useLogout,
  useUpdateMemoryPreferences,
  useUpdateContact,
  useUpdateSupportProfile,
} from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DailyPromptEmailSettings } from "@/components/daily-prompt-email-settings";

type PrimaryIntent = SupportProfileUpdateRequest["primaryIntent"];
type SupportStyle = SupportProfileUpdateRequest["supportStyle"];
type ThemeChoice = NonNullable<SupportProfileUpdateRequest["theme"]>;
type BaseMode = "dark" | "light";

export function SupportProfileDialog({
  open,
  onOpenChange,
  profile,
  me,
  canPersist = true,
  baseMode = "dark",
  onBaseModeChange,
  onSaveLocal,
  onRequestSignIn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: SupportProfile | null;
  me?: Me;
  canPersist?: boolean;
  baseMode?: BaseMode;
  onBaseModeChange?: (mode: BaseMode) => void;
  onSaveLocal?: (profile: SupportProfile | null) => void;
  /** When not signed in, Account opens auth (reuse `AuthDialog` from parent). */
  onRequestSignIn?: () => void;
}) {
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [primaryIntent, setPrimaryIntent] = useState<PrimaryIntent>();
  const [supportStyle, setSupportStyle] = useState<SupportStyle>();
  const [contact, setContact] = useState("");

  const updateProfile = useUpdateSupportProfile();
  const updateMemory = useUpdateMemoryPreferences();
  const updateContact = useUpdateContact();
  const logout = useLogout();
  const deleteAccount = useDeleteAccount();
  const exportData = useExportData();
  const deleteAllHistory = useDeleteAllHistory();
  const { toast } = useToast();

  const saving = updateProfile.isPending || updateContact.isPending;
  const contactLabel = useMemo(() => me?.email ?? me?.phone ?? "", [me]);

  useEffect(() => {
    if (!open) return;
    setTheme(profile?.theme ?? "system");
    setPrimaryIntent(profile?.primaryIntent);
    setSupportStyle(profile?.supportStyle);
    setContact(contactLabel);
  }, [contactLabel, open, profile]);

  const nextProfile = (): SupportProfile => ({
    mode: "base",
    startingSpace: profile?.startingSpace,
    theme,
    primaryIntent: primaryIntent ?? undefined,
    supportStyle: supportStyle ?? undefined,
    completedAt: profile?.completedAt ?? new Date().toISOString(),
  });

  const saveExperience = async () => {
    const next = nextProfile();
    try {
      onSaveLocal?.(next);
      if (canPersist) await updateProfile.mutateAsync(next);
      if (theme === "light") onBaseModeChange?.("light");
      if (theme === "dark") onBaseModeChange?.("dark");
      toast({ title: "Settings saved" });
    } catch (err: any) {
      toast({
        title: "Could not save settings",
        description: err?.message?.replace(/^\d+:\s*/, "") ?? "Something went wrong.",
      });
    }
  };

  const saveContact = async () => {
    if (!canPersist || !contact.trim()) return;
    try {
      await updateContact.mutateAsync({ contact: contact.trim() });
      toast({ title: "Profile updated" });
    } catch (err: any) {
      toast({
        title: "Could not update profile",
        description: err?.message?.replace(/^\d+:\s*/, "") ?? "Something went wrong.",
      });
    }
  };

  const resetSupport = () => {
    setPrimaryIntent(undefined);
    setSupportStyle(undefined);
  };

  const memory = me?.memoryPreferences ?? {
    rememberThemes: true,
    rememberTonePreferences: true,
    allowRelatedSuggestions: true,
    storeRawTranscript: true,
    clarityOnly: false,
  };

  const setMemoryPreference = async (patch: Partial<typeof memory>) => {
    try {
      await updateMemory.mutateAsync(patch);
      toast({ title: "Memory settings saved" });
    } catch (err: any) {
      toast({
        title: "Could not save memory settings",
        description: err?.message?.replace(/^\d+:\s*/, "") ?? "Something went wrong.",
      });
    }
  };

  const handleExportData = async () => {
    try {
      const data = await exportData.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `sift-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export prepared" });
    } catch (err: any) {
      toast({
        title: "Could not export data",
        description: err?.message?.replace(/^\d+:\s*/, "") ?? "Something went wrong.",
      });
    }
  };

  const handleDeleteAllHistory = async () => {
    if (!window.confirm("Delete all saved Sifts and transcripts? Your account stays active.")) return;
    await deleteAllHistory.mutateAsync();
    toast({ title: "History deleted" });
  };

  const confirmDelete = async () => {
    if (!window.confirm("Delete this account and its saved Sifts? This cannot be undone.")) return;
    await deleteAccount.mutateAsync();
    onSaveLocal?.(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sift-redesign-v3-theme sift-v3-settings-dialog max-h-[min(92dvh,820px)] max-w-[680px] overflow-y-auto p-0 sm:rounded-[3px]">
        <div className="sift-v3-settings-header px-5 py-5 sm:px-6">
          <DialogHeader className="text-left">
            <DialogTitle className="sift-v3-settings-title text-3xl tracking-[-0.04em]">
              Settings
            </DialogTitle>
            <DialogDescription className="sift-v3-settings-desc text-[14px] leading-relaxed">
              Account, experience, and support preferences for Sift.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <SettingsSection title="Profile" description="Personal details for your Sift account.">
            <div className="grid gap-3 sm:grid-cols-2">
              <ReadOnlyField label="Name" value={me?.handle ? `@${me.handle}` : "Not signed in"} />
              <div className="space-y-1.5">
                <FieldLabel>Email or phone</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    placeholder="you@example.com"
                    disabled={!canPersist}
                    className="sift-v3-field-box h-10"
                  />
                  <button
                    type="button"
                    onClick={saveContact}
                    disabled={!canPersist || updateContact.isPending}
                    className="sift-v3-btn-outline shrink-0"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Experience" description="Sift Base — minimal, direct, and conversation-first.">
            <p className="sift-v3-settings-desc text-[13px] leading-relaxed">
              You&apos;re using Sift Base, the streamlined Sift experience. Tune the support preferences below to shape how Sift opens and paces with you.
            </p>
          </SettingsSection>

          <SettingsSection title="Support Preferences" description="How Sift should pace and shape early help.">
            <PreferenceCardGroup
              label="What would help most right now?"
              value={primaryIntent}
              onChange={setPrimaryIntent}
              options={[
                { value: "sort_thoughts", label: "Sort my thoughts" },
                { value: "calm_noise", label: "Calm the noise" },
                { value: "understand_feelings", label: "Understand what I’m feeling" },
                { value: "find_next_step", label: "Find a next step" },
              ]}
            />
            <PreferenceCardGroup
              label="How should I support you?"
              value={supportStyle}
              onChange={setSupportStyle}
              options={[
                { value: "gentle", label: "Gently" },
                { value: "clear", label: "Clearly" },
                { value: "direct", label: "Directly" },
                { value: "step_by_step", label: "Step by step" },
              ]}
            />
            <button
              type="button"
              onClick={resetSupport}
              className="sift-v3-btn-ghost text-sm underline-offset-4 hover:underline"
            >
              Reset support preferences
            </button>
          </SettingsSection>

          <SettingsSection
            title="What Sift Remembers"
            description="Memory is optional and visible. Sift uses it to notice recurring themes, not to diagnose you."
          >
            <MemoryToggle
              label="Remember themes over time"
              description="Lets Sift notice when a topic has come up before."
              checked={memory.rememberThemes}
              onChange={(checked) => void setMemoryPreference({ rememberThemes: checked })}
              disabled={!canPersist || updateMemory.isPending}
            />
            <MemoryToggle
              label="Remember tone and preferences"
              description="Keeps support style, environment, and pacing preferences available."
              checked={memory.rememberTonePreferences}
              onChange={(checked) => void setMemoryPreference({ rememberTonePreferences: checked })}
              disabled={!canPersist || updateMemory.isPending}
            />
            <MemoryToggle
              label="Allow related-past-Sifts suggestions"
              description="Shows calm links to past Sifts when themes overlap."
              checked={memory.allowRelatedSuggestions}
              onChange={(checked) => void setMemoryPreference({ allowRelatedSuggestions: checked })}
              disabled={!canPersist || updateMemory.isPending}
            />
            <MemoryToggle
              label="Store raw transcript"
              description="Keeps the conversation text behind the Clarity Sheet."
              checked={memory.storeRawTranscript}
              onChange={(checked) => void setMemoryPreference({ storeRawTranscript: checked, clarityOnly: checked ? memory.clarityOnly : true })}
              disabled={!canPersist || updateMemory.isPending}
            />
            <MemoryToggle
              label="Keep only Clarity Sheet, not full transcript"
              description="Prioritizes structured clarity over raw conversation history."
              checked={memory.clarityOnly}
              onChange={(checked) => void setMemoryPreference({ clarityOnly: checked, storeRawTranscript: checked ? false : memory.storeRawTranscript })}
              disabled={!canPersist || updateMemory.isPending}
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => void handleExportData()}
                disabled={!canPersist || exportData.isPending}
                className="sift-v3-btn-outline"
              >
                Export my data
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteAllHistory()}
                disabled={!canPersist || deleteAllHistory.isPending}
                className="sift-v3-btn-outline border-red-200/80 bg-red-50/70 text-red-800 hover:bg-red-100 sm:col-span-2"
              >
                Delete all history
              </button>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Daily check-in"
            description="Optional email prompt to return when a thread is still alive."
          >
            <DailyPromptEmailSettings me={me} canPersist={canPersist} />
          </SettingsSection>

          <SettingsSection title="Appearance" description="Visual theme. System can expand as the app grows.">
            <PreferenceCardGroup
              label="Theme"
              value={theme}
              onChange={(value) => {
                const next = value ?? "system";
                setTheme(next);
                if (next === "light") onBaseModeChange?.("light");
                if (next === "dark") onBaseModeChange?.("dark");
              }}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              columns="three"
            />
            <p className="sift-v3-settings-desc text-xs leading-relaxed">
              Sift Base follows this setting visibly across the app.
            </p>
          </SettingsSection>

          <SettingsSection
            title="Account"
            description={
              me
                ? "Session and account actions."
                : "Sign in to keep your Library and sync preferences to your handle."
            }
          >
            {me ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    logout.mutate();
                    onOpenChange(false);
                  }}
                  disabled={!canPersist || logout.isPending}
                  className="sift-v3-btn-outline"
                >
                  Log out
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDelete()}
                  disabled={!canPersist || deleteAccount.isPending}
                  className="sift-v3-btn-outline border-red-200/80 bg-red-50/70 text-red-800 hover:bg-red-100"
                >
                  Delete account
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="sift-v3-btn-outline w-full sm:w-auto"
                disabled={!onRequestSignIn}
                onClick={() => {
                  onOpenChange(false);
                  onRequestSignIn?.();
                }}
              >
                Sign in or create account
              </button>
            )}
          </SettingsSection>

          <SettingsSection title="Help & Legal" description="Reference, support, and product information.">
            <div className="grid gap-2 sm:grid-cols-2">
              <SettingsLink label="Open Library" href="#/library" />
              <SettingsLink label="Privacy policy" href="#/privacy" />
              <SettingsLink label="Terms" href="#/privacy" />
              <SettingsLink label="Contact support / feedback" href="mailto:hello@siftnow.io" />
              <ReadOnlyField label="About Sift" value="Sift v1 live preview" />
            </div>
          </SettingsSection>
        </div>

        <div className="sift-v3-settings-footer sticky bottom-0 flex items-center justify-between gap-3 px-5 py-4">
          <button type="button" onClick={() => onOpenChange(false)} className="sift-v3-btn-ghost text-sm">
            Close
          </button>
          <button type="button" onClick={saveExperience} disabled={saving} className="v3-sift-btn">
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="sift-v3-settings-section p-4">
      <div className="mb-4">
        <h3 className="text-[22px] leading-tight tracking-[-0.03em]">{title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="sift-v3-field-label">{children}</p>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="sift-v3-field-box px-3 py-2 text-sm">{value}</div>
    </div>
  );
}

function MemoryToggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="sift-v3-toggle-row flex items-start justify-between gap-4 px-3 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="sift-v3-settings-desc mt-1 block text-xs leading-relaxed">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5"
      />
    </label>
  );
}

function SettingsLink({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="sift-v3-settings-link block px-3 py-2 text-sm font-medium"
    >
      {label}
    </a>
  );
}

function PreferenceCardGroup<TValue extends string>({
  label,
  value,
  options,
  onChange,
  columns = "two",
}: {
  label: string;
  value?: TValue | null;
  options: Array<{ value: TValue; label: string }>;
  onChange: (value: TValue | undefined) => void;
  columns?: "two" | "three";
}) {
  return (
    <div className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <div className={cn("grid gap-2", columns === "three" ? "grid-cols-3" : "grid-cols-2")}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(selected ? undefined : option.value)}
              className={cn(
                "sift-v3-pref-chip px-3 py-2 text-left text-sm font-medium",
                selected && "selected",
              )}
              aria-pressed={selected}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

