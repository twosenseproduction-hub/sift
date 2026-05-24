import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { Settings } from "lucide-react";
import { LogoMark } from "@/components/brand";
import { cn } from "@/lib/utils";
import { EnergyCanvas, EnergyIndicator } from "./energy-canvas";

export type SiftAppTab = "composer" | "library" | "patterns";

function confirmLeavingUnsavedGuestSift() {
  try {
    if (typeof sessionStorage === "undefined") return true;
    if (!sessionStorage.getItem("sift.unsavedGuestSift")) return true;
  } catch {
    return true;
  }
  return window.confirm(
    "This Sift is only temporary right now. Leave without saving it?",
  );
}

export function SiftTopNav({
  activeTab,
  composerText = "",
  onSettingsClick,
  settingsTestId = "button-settings",
  className,
}: {
  activeTab: SiftAppTab;
  composerText?: string;
  onSettingsClick?: () => void;
  settingsTestId?: string;
  className?: string;
}) {
  const [, setLocation] = useLocation();

  const goComposer = () => {
    if (activeTab === "composer") return;
    if (!confirmLeavingUnsavedGuestSift()) return;
    window.dispatchEvent(new CustomEvent("sift:home-reset"));
    setLocation("/sift");
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("sift:focus-composer", { detail: { select: true } }),
      );
    }, 80);
  };

  const goLibrary = () => {
    if (activeTab === "library") return;
    if (!confirmLeavingUnsavedGuestSift()) return;
    setLocation("/library");
  };

  const goPatterns = () => {
    if (activeTab === "patterns") return;
    if (!confirmLeavingUnsavedGuestSift()) return;
    setLocation("/patterns");
  };

  return (
    <nav className={cn("v3-top-nav", className)} aria-label="App">
      <div className="v3-nav-brand" aria-label="Sift">
        <LogoMark size={20} />
        <span className="v3-nav-logo">sift</span>
      </div>

      <div className="v3-nav-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "composer"}
          className={cn("v3-tab-btn", activeTab === "composer" && "active")}
          onClick={goComposer}
        >
          Composer
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "library"}
          className={cn("v3-tab-btn", activeTab === "library" && "active")}
          onClick={goLibrary}
        >
          Library
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "patterns"}
          className={cn("v3-tab-btn", activeTab === "patterns" && "active")}
          onClick={goPatterns}
        >
          Patterns
        </button>
      </div>

      <div className="v3-nav-right">
        {activeTab === "composer" ? <EnergyIndicator text={composerText} /> : null}
        <button
          type="button"
          onClick={() => onSettingsClick?.()}
          className="v3-nav-settings"
          aria-label="Settings"
          data-testid={settingsTestId}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

export function SiftAppShell({
  activeTab,
  composerText = "",
  onSettingsClick,
  settingsTestId,
  children,
  className,
}: {
  activeTab: SiftAppTab;
  composerText?: string;
  onSettingsClick?: () => void;
  settingsTestId?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("sift-redesign-v3-session sift-v3-app relative min-h-[100dvh]", className)}>
      <EnergyCanvas text={activeTab === "composer" ? composerText : ""} />
      <SiftTopNav
        activeTab={activeTab}
        composerText={composerText}
        onSettingsClick={onSettingsClick}
        settingsTestId={settingsTestId}
      />
      <div className="v3-app-body">{children}</div>
    </div>
  );
}
