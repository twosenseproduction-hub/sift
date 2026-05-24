import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LibrarySiftItem, SupportProfile } from "@shared/schema";
import { SiftAppShell } from "@/components/redesign-v3";
import { PatternsView } from "@/components/redesign-v3/patterns-view";
import { AuthDialog } from "@/components/auth-dialog";
import { SupportProfileDialog } from "@/components/support-profile-dialog";
import { useMe } from "@/lib/auth";
import {
  mergeSupportProfiles,
  readLocalSupportProfile,
  supportProfileBaseVisualMode,
  writeLocalSupportProfile,
} from "@/lib/sift-experience";

type LibraryListResponse = {
  items: LibrarySiftItem[];
  recurringThemes: Array<{ label: string; count: number }>;
};

export default function PatternsPage() {
  const { data: meData } = useMe();
  const me = meData?.me;
  const [localOnboardingProfile, setLocalOnboardingProfile] = useState<SupportProfile | null>(() =>
    readLocalSupportProfile(),
  );
  const effectiveSupportProfile = mergeSupportProfiles(localOnboardingProfile, me?.supportProfile);
  const [baseMode, setBaseMode] = useState<"dark" | "light">(() =>
    supportProfileBaseVisualMode(effectiveSupportProfile),
  );

  useEffect(() => {
    setBaseMode(supportProfileBaseVisualMode(effectiveSupportProfile));
  }, [effectiveSupportProfile?.theme]);

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const openAuth = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };
  const [supportProfileOpen, setSupportProfileOpen] = useState(false);

  const listQuery = useQuery<LibraryListResponse>({
    queryKey: ["/api/library"],
    enabled: !!me,
  });

  return (
    <SiftAppShell
      activeTab="patterns"
      onSettingsClick={() => setSupportProfileOpen(true)}
      settingsTestId="button-patterns-settings"
    >
      {!me ? (
        <div className="v3-library-main">
          <div className="v3-empty-state py-16 text-center">
            <p className="v3-empty-state-title">Patterns need a few saved Sifts.</p>
            <p className="mt-3 max-w-md mx-auto">
              Sign in and save entries to your Library. Sift will surface themes, activity, and
              signals that keep returning.
            </p>
            <button type="button" onClick={() => openAuth("signup")} className="v3-sift-btn mt-6">
              Keep this Sift
            </button>
          </div>
        </div>
      ) : (
        <PatternsView
          items={listQuery.data?.items ?? []}
          recurringThemes={listQuery.data?.recurringThemes ?? []}
          loading={listQuery.isLoading}
        />
      )}

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode={authMode} baseMode={baseMode} />
      <SupportProfileDialog
        open={supportProfileOpen}
        onOpenChange={setSupportProfileOpen}
        profile={effectiveSupportProfile}
        canPersist={Boolean(me)}
        baseMode={baseMode}
        onBaseModeChange={setBaseMode}
        onSaveLocal={(profile) => {
          setLocalOnboardingProfile(profile);
          writeLocalSupportProfile(profile);
          if (profile?.theme === "light") setBaseMode("light");
          if (profile?.theme === "dark") setBaseMode("dark");
        }}
        me={me ?? null}
        onRequestSignIn={() => {
          setSupportProfileOpen(false);
          openAuth("signin");
        }}
      />
    </SiftAppShell>
  );
}
