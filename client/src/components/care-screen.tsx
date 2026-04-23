import { Phone, MessageSquare, Globe } from "lucide-react";

interface CareScreenProps {
  /**
   * Optional: user taps "this wasn't what I meant" and returns to the
   * composer. We only treat this as a false-positive escape hatch — the
   * phrase list is moderately strict and some people will legitimately
   * want to return to the sift. Not shown when the screen is opened from
   * the footer link (informational mode).
   */
  onDismiss?: () => void;
  /**
   * Optional: close / go back. In the footer-link / dialog mode this
   * dismisses the overlay.
   */
  onClose?: () => void;
  /**
   * When true, the screen is being shown as an on-demand reference (from
   * the footer link), not because an input tripped the screen. Hides the
   * "this wasn't what I meant" escape hatch.
   */
  informational?: boolean;
}

/**
 * CareScreen — shown when an input trips the crisis screen, or on demand
 * via the "In crisis?" footer link. The tone matches the app voice:
 * reflective, calm, no exclamation points, no therapy voice. The user's
 * flagged input is not persisted and not sent to the LLM.
 */
export function CareScreen({ onDismiss, onClose, informational }: CareScreenProps) {
  return (
    <div className="pt-8 md:pt-12 fade-in-slow" data-testid="screen-care">
      <div className="flex items-center gap-3 mb-6">
        <span className="h-px w-6 bg-primary/40" />
        <span className="text-[11px] tracking-[0.2em] uppercase font-medium text-primary/80">
          A pause
        </span>
      </div>

      <h2
        className="font-serif text-2xl md:text-3xl leading-[1.2] tracking-tight text-foreground"
        data-testid="text-care-title"
      >
        {informational
          ? "If you're in crisis."
          : "This sounds heavy. Sift is going to pause here."}
      </h2>

      <p
        className="mt-4 text-base md:text-[17px] text-foreground/85 leading-relaxed max-w-xl"
        data-testid="text-care-body"
      >
        {informational
          ? "If you or someone near you is in danger, please use one of the lines below. They are free, confidential, and available anytime."
          : "What you're holding deserves a real person, not an app. Please reach out to one of the lines below — they are free, confidential, and available anytime."}
      </p>

      <div
        className="mt-8 rounded-2xl border border-border/70 bg-card/40 divide-y divide-border/60"
        data-testid="panel-care-resources"
      >
        <ResourceRow
          icon={<Phone className="w-4 h-4" />}
          label="988 — Suicide & Crisis Lifeline (US)"
          help="Call or text 988"
          primaryHref="tel:988"
          primaryLabel="Call 988"
          secondaryHref="sms:988"
          secondaryLabel="Text 988"
          testId="row-988"
        />
        <ResourceRow
          icon={<MessageSquare className="w-4 h-4" />}
          label="Crisis Text Line"
          help="Text HOME to 741741"
          primaryHref="sms:741741?body=HOME"
          primaryLabel="Text HOME"
          testId="row-741741"
        />
        <ResourceRow
          icon={<Globe className="w-4 h-4" />}
          label="Outside the US"
          help="Find a helpline in your country"
          primaryHref="https://findahelpline.com"
          primaryLabel="findahelpline.com"
          primaryExternal
          testId="row-findahelpline"
        />
      </div>

      <p
        className="mt-6 text-xs text-muted-foreground/80 leading-relaxed max-w-xl"
        data-testid="text-care-disclaimer"
      >
        Sift is not a crisis service. If someone is in immediate danger, call
        your local emergency number.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            data-testid="button-care-close"
            className="text-sm text-foreground/80 hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
          >
            {informational ? "Close" : "Go back"}
          </button>
        )}
        {!informational && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            data-testid="button-care-dismiss"
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border/70 hover:decoration-foreground transition-colors"
          >
            This wasn't what I meant
          </button>
        )}
      </div>
    </div>
  );
}

interface ResourceRowProps {
  icon: React.ReactNode;
  label: string;
  help: string;
  primaryHref: string;
  primaryLabel: string;
  primaryExternal?: boolean;
  secondaryHref?: string;
  secondaryLabel?: string;
  testId: string;
}

function ResourceRow({
  icon,
  label,
  help,
  primaryHref,
  primaryLabel,
  primaryExternal,
  secondaryHref,
  secondaryLabel,
  testId,
}: ResourceRowProps) {
  return (
    <div
      className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-primary/80">{icon}</span>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{help}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:shrink-0">
        <a
          href={primaryHref}
          {...(primaryExternal
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
          data-testid={`${testId}-primary`}
          className="inline-flex items-center px-3 py-1.5 rounded-full border border-primary/40 bg-primary/5 text-sm text-primary hover:bg-primary/10 transition-colors"
        >
          {primaryLabel}
        </a>
        {secondaryHref && secondaryLabel && (
          <a
            href={secondaryHref}
            data-testid={`${testId}-secondary`}
            className="inline-flex items-center px-3 py-1.5 rounded-full border border-border/70 text-sm text-foreground/80 hover:text-foreground hover:border-border transition-colors"
          >
            {secondaryLabel}
          </a>
        )}
      </div>
    </div>
  );
}
