import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Me, SupportProfile, SupportProfileUpdateRequest } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

type PrimaryIntent = SupportProfileUpdateRequest["primaryIntent"];
type SupportStyle = SupportProfileUpdateRequest["supportStyle"];
type SiftMode = NonNullable<SupportProfileUpdateRequest["mode"]>;
type StartingSpace = NonNullable<SupportProfileUpdateRequest["startingSpace"]>;
type ThemeChoice = NonNullable<SupportProfileUpdateRequest["theme"]>;
type BaseMode = "dark" | "light";

const SCENE_OPTIONS = [
  { value: "bedroom", name: "Bedroom", description: "quiet, private, grounding", src: "/room/bedroom.png" },
  { value: "desk", name: "Desk", description: "focused, practical, action-oriented", src: "/room/computer-desk.png" },
  { value: "rooftop", name: "Rooftop", description: "perspective, distance, reflection", src: "/room/rooftop.png" },
  { value: "library", name: "Library", description: "quiet study, depth, spacious thought", src: "/room/library.png" },
] as const;

export function SupportProfileDialog({
  open,
  onOpenChange,
  profile,
  me,
  canPersist = true,
  baseMode = "dark",
  onBaseModeChange,
  onSaveLocal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: SupportProfile | null;
  me?: Me;
  canPersist?: boolean;
  baseMode?: BaseMode;
  onBaseModeChange?: (mode: BaseMode) => void;
  onSaveLocal?: (profile: SupportProfile | null) => void;
}) {
  const [mode, setMode] = useState<SiftMode>("companion");
  const [startingSpace, setStartingSpace] = useState<StartingSpace>("bedroom");
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
    setMode(profile?.mode ?? "companion");
    setStartingSpace(profile?.startingSpace ?? "bedroom");
    setTheme(profile?.theme ?? "system");
    setPrimaryIntent(profile?.primaryIntent);
    setSupportStyle(profile?.supportStyle);
    setContact(contactLabel);
  }, [contactLabel, open, profile]);

  const nextProfile = (): SupportProfile => ({
    mode,
    startingSpace,
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
      <DialogContent className="max-h-[min(92dvh,820px)] max-w-[680px] overflow-y-auto border-[color:var(--color-walnut)]/18 bg-[#f7f1e5] p-0 text-[#2f2a22] shadow-[0_28px_90px_-42px_rgba(20,16,10,0.78)]">
        <div className="border-b border-[#d7c8b4] bg-[#fbf7ef] px-5 py-5 sm:px-6">
          <DialogHeader className="text-left">
            <DialogTitle className="font-serif text-3xl tracking-[-0.04em] text-[#241f18]">
              Settings
            </DialogTitle>
            <DialogDescription className="text-[14px] leading-relaxed text-[#675d4f]">
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
                    className="border-[#d7c8b4] bg-[#fffaf2] text-[#2f2a22]"
                  />
                  <Button
                    type="button"
                    onClick={saveContact}
                    disabled={!canPersist || updateContact.isPending}
                    variant="outline"
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Experience" description="Choose how Sift opens and where you begin.">
            <PreferenceCardGroup
              label="Sift mode"
              value={mode}
              onChange={(value) => setMode(value ?? "companion")}
              options={[
                { value: "base", label: "Sift Base" },
                { value: "companion", label: "Sift Companion" },
              ]}
            />
            <ScenePreferenceGroup
              label="Starting space"
              value={startingSpace}
              onChange={setStartingSpace}
            />
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
              className="text-sm font-medium text-[#675d4f] underline-offset-4 transition hover:text-[#241f18] hover:underline"
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
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleExportData()}
                disabled={!canPersist || exportData.isPending}
              >
                Export my data
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleDeleteAllHistory()}
                disabled={!canPersist || deleteAllHistory.isPending}
                className="border-red-200 bg-red-50/70 text-red-700 hover:bg-red-100 hover:text-red-800 sm:col-span-2"
              >
                Delete all history
              </Button>
            </div>
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
            {mode === "base" ? (
              <p className="text-xs leading-relaxed text-[#675d4f]">
                Sift Base currently follows this setting most visibly. Companion scenes keep their illustrated environment.
              </p>
            ) : null}
          </SettingsSection>

          <SettingsSection title="Account" description="Session and account actions.">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  logout.mutate();
                  onOpenChange(false);
                }}
                disabled={!canPersist || logout.isPending}
              >
                Log out
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void confirmDelete()}
                disabled={!canPersist || deleteAccount.isPending}
                className="border-red-200 bg-red-50/70 text-red-700 hover:bg-red-100 hover:text-red-800"
              >
                Delete account
              </Button>
            </div>
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

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[#d7c8b4] bg-[#fbf7ef] px-5 py-4 shadow-[0_-18px_38px_-32px_rgba(20,16,10,0.55)]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-sm font-medium text-[#675d4f] transition hover:text-[#241f18]"
          >
            Close
          </button>
          <Button type="button" onClick={saveExperience} disabled={saving}>
            {saving ? "Saving..." : "Save settings"}
          </Button>
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
    <section className="rounded-2xl border border-[#d7c8b4] bg-[#fffaf2] p-4 shadow-[0_18px_54px_-48px_rgba(41,38,31,0.5)]">
      <div className="mb-4">
        <h3 className="font-serif text-[22px] leading-tight tracking-[-0.03em] text-[#241f18]">
          {title}
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-[#675d4f]">
          {description}
        </p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#5f5548]">
      {children}
    </p>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="rounded-xl border border-[#d7c8b4] bg-[#f6efe3] px-3 py-2 text-sm text-[#2f2a22]">
        {value}
      </div>
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
    <label className="flex items-start justify-between gap-4 rounded-xl border border-[#d7c8b4] bg-[#f6efe3] px-3 py-3">
      <span>
        <span className="block text-sm font-semibold text-[#241f18]">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-[#675d4f]">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 accent-[#65765c]"
      />
    </label>
  );
}

function SettingsLink({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="rounded-xl border border-[#d7c8b4] bg-[#f6efe3] px-3 py-2 text-sm font-medium text-[#2f2a22] transition hover:border-[#6c7d63]/45 hover:bg-[#efe5d5]"
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
                "rounded-xl border px-3 py-2 text-left text-sm font-medium transition",
                selected
                  ? "border-[#65765c] bg-[#e7eddf] text-[#202018]"
                  : "border-[#d7c8b4] bg-[#f6efe3] text-[#5f5548] hover:border-[#6c7d63]/45 hover:text-[#241f18]",
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

function ScenePreferenceGroup({
  label,
  value,
  onChange,
}: {
  label: string;
  value: StartingSpace;
  onChange: (value: StartingSpace) => void;
}) {
  return (
    <div className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SCENE_OPTIONS.map((scene) => {
          const selected = value === scene.value;
          return (
            <button
              key={scene.value}
              type="button"
              onClick={() => onChange(scene.value)}
              className={cn(
                "overflow-hidden rounded-xl border text-left transition",
                selected
                  ? "border-[#65765c] bg-[#e7eddf]"
                  : "border-[#d7c8b4] bg-[#f6efe3] hover:border-[#6c7d63]/45",
              )}
              aria-pressed={selected}
            >
              <span className="block aspect-[4/3] overflow-hidden">
                <img src={scene.src} alt="" className="h-full w-full object-cover" draggable={false} />
              </span>
              <span className="block px-3 py-2">
                <span className="block text-sm font-semibold text-[#241f18]">
                  {scene.name}
                </span>
                <span className="mt-0.5 block text-[11px] leading-tight text-[#675d4f]">
                  {scene.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
