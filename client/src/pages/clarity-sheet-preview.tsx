import { useState } from "react";
import { Link } from "wouter";
import { BedroomSummarySheet } from "@/components/bedroom-session/bedroom-summary-card";
import { SiftAppShell } from "@/components/redesign-v3";
import { CLARITY_SHEET_DEMO_SUMMARY } from "@/lib/clarity-sheet-fixture";

/**
 * Dev-only clarity sheet preview — slide-up sheet with sample summary.
 * Route: #/clarity-sheet-preview
 */
export default function ClaritySheetPreviewPage() {
  const [summary] = useState(CLARITY_SHEET_DEMO_SUMMARY);
  const [minimized, setMinimized] = useState(false);

  return (
    <SiftAppShell activeTab="composer">
      <div className="v3-library-main flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
        <p className="v3-empty-state-title">Clarity sheet preview</p>
        <p className="mt-3 max-w-md text-[color:var(--v3-text-muted)]">
          The sheet should slide up from the bottom. Minimize or dismiss to see tray behavior.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className="v3-sift-btn"
            onClick={() => setMinimized(false)}
          >
            Show sheet
          </button>
          <Link
            href="/sift"
            className="rounded-full border border-[color:var(--v3-border)] px-5 py-2.5 text-sm text-[color:var(--v3-text-muted)] transition hover:text-[color:var(--v3-text)]"
          >
            Back to composer
          </Link>
        </div>
      </div>

      <BedroomSummarySheet
        summary={summary}
        minimized={minimized}
        onMinimizedChange={setMinimized}
        onDismiss={() => setMinimized(true)}
      />
    </SiftAppShell>
  );
}
