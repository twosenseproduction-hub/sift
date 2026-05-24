import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export type SidebarRecentItem = {
  id: string;
  title: string;
};

export function V3AppSidebar({
  recentItems = [],
  activeStep,
  microDoneCount = 0,
  microTotal = 4,
  onRelease,
  userHandle,
  className,
}: {
  recentItems?: SidebarRecentItem[];
  activeStep?: string | null;
  microDoneCount?: number;
  microTotal?: number;
  onRelease?: () => void;
  userHandle?: string | null;
  className?: string;
}) {
  const [location, setLocation] = useLocation();
  const onComposer = location === "/" || location === "/sift" || location === "";
  const onLibrary = location === "/library" || location.startsWith("/library/");
  const onPatterns = location === "/patterns";
  const initial = userHandle?.trim().charAt(0).toUpperCase() || "?";

  return (
    <aside className={cn("v3-app-sidebar", className)} aria-label="Session sidebar">
      <div className="v3-sidebar-section">
        <p className="v3-sidebar-label">Today</p>
        <button
          type="button"
          className={cn("v3-sidebar-item v3-sidebar-item-btn", onComposer && "active")}
          onClick={() => setLocation("/sift")}
        >
          <span className="v3-sidebar-dot" aria-hidden />
          <span>New entry</span>
        </button>
      </div>

      <div className="v3-sidebar-section">
        <p className="v3-sidebar-label">Explore</p>
        <button
          type="button"
          className={cn("v3-sidebar-item v3-sidebar-item-btn", onLibrary && "active")}
          onClick={() => setLocation("/library")}
        >
          <span className="v3-sidebar-item-spacer" aria-hidden />
          <span>Library</span>
        </button>
        <button
          type="button"
          className={cn("v3-sidebar-item v3-sidebar-item-btn", onPatterns && "active")}
          onClick={() => setLocation("/patterns")}
        >
          <span className="v3-sidebar-item-spacer" aria-hidden />
          <span>Patterns</span>
        </button>
      </div>

      {recentItems.length ? (
        <div className="v3-sidebar-section">
          <p className="v3-sidebar-label">Recent</p>
          {recentItems.slice(0, 5).map((item) => (
            <button
              key={item.id}
              type="button"
              className="v3-sidebar-item v3-sidebar-item-btn"
              onClick={() => setLocation(`/library/${item.id}`)}
            >
              <span className="v3-sidebar-item-spacer" aria-hidden />
              <span className="truncate">{item.title}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="v3-sidebar-spacer" />

      {activeStep?.trim() ? (
        <div className="v3-sidebar-active-step">
          <div className="v3-sidebar-step-eyebrow">
            <span className="v3-sidebar-pulse" aria-hidden />
            Carrying now
          </div>
          <p className="v3-sidebar-step-text">{activeStep}</p>
          <div className="v3-progress-pips" aria-hidden>
            {Array.from({ length: microTotal }, (_, i) => (
              <div key={i} className={cn("v3-pip", i < microDoneCount && "done")} />
            ))}
          </div>
          {onRelease ? (
            <button type="button" onClick={onRelease} className="v3-sidebar-release">
              Release →
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="v3-sidebar-footer">
        <div className="v3-sidebar-user">
          <div className="v3-user-avatar">{initial}</div>
          <span>{userHandle ?? "Guest"}</span>
        </div>
      </div>
    </aside>
  );
}
