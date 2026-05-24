import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { Settings } from "lucide-react";
import { LogoMark } from "@/components/brand";
import { cn } from "@/lib/utils";
import { EnergyCanvas, EnergyIndicator } from "./energy-canvas";
import {
  confirmLeavingUnsavedGuestSift,
  requestNewSiftEntry,
} from "@/lib/start-new-sift-entry";

export type SiftAppTab = "composer" | "library" | "patterns";

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
    if (activeTab === "composer") {
      requestNewSiftEntry();
      return;
    }
    if (!confirmLeavingUnsavedGuestSift()) return;
    requestNewSiftEntry();
    setLocation("/sift");
  };

  const startNewEntry = () => {
    if (activeTab === "composer") {
      requestNewSiftEntry();
      return;
    }
    if (!confirmLeavingUnsavedGuestSift()) return;
    requestNewSiftEntry();
    setLocation("/sift");
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
      <button
        type="button"
        className="v3-nav-brand"
        aria-label="New entry"
        onClick={startNewEntry}
      >
        <LogoMark size={20} />
        <span className="v3-nav-logo">sift</span>
      </button>

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
          className="v3-nav-new-entry"
          onClick={startNewEntry}
        >
          New entry
        </button>
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
