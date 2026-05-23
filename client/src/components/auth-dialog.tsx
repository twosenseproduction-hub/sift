import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useLogin, useSignup, useForgotPassphrase } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { SiftBaseVisualMode } from "@/components/onboarding/sift-onboarding-flow";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: "signin" | "signup";
  /** Match the active Sift Base theme on Home / Library. */
  baseMode?: SiftBaseVisualMode;
}

const fieldClass =
  "flex h-10 w-full rounded-xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-alt)]/40 px-3 py-2 text-[14px] text-[color:var(--color-text)] shadow-[0_8px_24px_-20px_rgba(0,0,0,0.35)] ring-offset-[color:var(--color-surface)] transition-[border-color,box-shadow] placeholder:text-[color:var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]/35 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const labelClass =
  "font-serif text-[11px] uppercase tracking-[0.28em] text-[color:var(--color-text-muted)]";

const linkClass =
  "text-left font-serif text-[13px] text-[color:var(--color-text-muted)] underline-offset-4 transition hover:text-[color:var(--color-text)] hover:underline";

export function AuthDialog({
  open,
  onOpenChange,
  initialMode = "signup",
  baseMode = "dark",
}: Props) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [view, setView] = useState<"auth" | "forgot">("auth");
  const [handle, setHandle] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [contact, setContact] = useState("");
  const [consentUpdates, setConsentUpdates] = useState(false);
  const [consentReflections, setConsentReflections] = useState(false);
  const login = useLogin();
  const signup = useSignup();
  const forgot = useForgotPassphrase();
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setView("auth");
  }, [open, initialMode]);

  const loading = login.isPending || signup.isPending || forgot.isPending;

  const normalizedHandle = handle.trim().toLowerCase();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (view === "forgot") {
        const data = await forgot.mutateAsync({ handle: normalizedHandle });
        toast({
          title: "Check your email",
          description: data.message,
        });
        if (data.devResetUrl) {
          console.info("[auth] dev reset link", data.devResetUrl);
          toast({
            title: "Dev reset link",
            description: "Logged to console. Open that URL to set a new passphrase.",
          });
        }
        setView("auth");
        setMode("signin");
        return;
      }
      if (mode === "signin") {
        await login.mutateAsync({ handle: normalizedHandle, passphrase });
      } else {
        await signup.mutateAsync({
          handle: normalizedHandle,
          passphrase,
          contact: contact.trim(),
          consentUpdates,
          consentReflections,
        });
      }
      onOpenChange(false);
      setPassphrase("");
      setHandle("");
      setContact("");
      setConsentUpdates(false);
      setConsentReflections(false);
    } catch (err: any) {
      const msg = err?.message?.replace(/^\d+:\s*/, "") ?? "Something went wrong.";
      let parsed = msg;
      try {
        const obj = JSON.parse(msg);
        parsed = obj.error ?? msg;
      } catch {}
      toast({
        title: mode === "signin" ? "Can't sign in" : "Can't sign up",
        description:
          parsed === "That handle is taken."
            ? "That handle already exists. Switch to sign in, or choose a different handle."
            : parsed,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "bedroom-session sift-base-session max-h-[min(90dvh,760px)] max-w-md overflow-y-auto border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-6 text-[color:var(--color-text)] shadow-[var(--bedroom-paper-shadow)] sm:rounded-3xl sm:p-8",
          baseMode === "light" && "sift-base-light-session",
          "[&>button]:text-[color:var(--color-text-muted)] [&>button]:hover:bg-[color:var(--color-text)]/[0.06] [&>button]:hover:text-[color:var(--color-text)]",
        )}
      >
        <DialogHeader className="space-y-2">
          <DialogTitle className="font-serif text-[1.75rem] leading-[1.12] tracking-[-0.035em] text-[color:var(--color-text)]">
            {view === "forgot"
              ? "Reset passphrase"
              : mode === "signup"
                ? "Save your clarity"
                : "Welcome back"}
          </DialogTitle>
          <DialogDescription className="font-serif text-[15px] italic leading-relaxed text-[color:var(--color-text-muted)]">
            {view === "forgot"
              ? "Enter your handle. If you added email at signup, a reset link will be issued."
              : mode === "signup"
                ? "Create your space to come back to this. Handle and passphrase only."
                : "Enter your handle and passphrase."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-1" data-testid="form-auth">
          {view === "forgot" ? (
            <div className="space-y-1.5">
              <label htmlFor="handle-forgot" className={labelClass}>
                Handle
              </label>
              <input
                id="handle-forgot"
                className={fieldClass}
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                required
                minLength={2}
                disabled={loading}
              />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label htmlFor="handle" className={labelClass}>
                  Handle
                </label>
                <input
                  id="handle"
                  data-testid="input-handle"
                  className={fieldClass}
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={mode === "signup" ? "Choose a handle" : "Your handle"}
                  required
                  minLength={2}
                  maxLength={24}
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="passphrase" className={labelClass}>
                  Passphrase
                </label>
                <input
                  id="passphrase"
                  data-testid="input-passphrase"
                  type="password"
                  className={fieldClass}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  disabled={loading}
                />
                {mode === "signup" && (
                  <p className="pt-1 font-serif text-[12px] italic leading-relaxed text-[color:var(--color-text-muted)]">
                    Add an email at signup if you may need passphrase recovery later.
                  </p>
                )}
              </div>
            </>
          )}

          {view === "auth" && mode === "signup" && (
            <>
              <div className="space-y-1.5">
                <label htmlFor="contact" className={labelClass}>
                  Email or phone optional
                </label>
                <input
                  id="contact"
                  data-testid="input-contact"
                  className={fieldClass}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="you@example.com or +15551234567"
                  disabled={loading}
                />
                <p className="pt-1 font-serif text-[12px] italic leading-relaxed text-[color:var(--color-text-muted)]">
                  Add this only if you want reminders or updates later. Never shared.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={consentUpdates}
                    onCheckedChange={(v) => setConsentUpdates(v === true)}
                    disabled={loading}
                    data-testid="checkbox-consent-updates"
                    className="mt-0.5 border-[color:var(--color-primary)]/45 data-[state=checked]:border-[color:var(--color-primary)] data-[state=checked]:bg-[color:var(--color-primary)] data-[state=checked]:text-[color:var(--color-surface)]"
                  />
                  <span className="text-[13px] leading-snug text-[color:var(--color-text)]/90">
                    Send me occasional product updates.
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={consentReflections}
                    onCheckedChange={(v) => setConsentReflections(v === true)}
                    disabled={loading}
                    data-testid="checkbox-consent-reflections"
                    className="mt-0.5 border-[color:var(--color-primary)]/45 data-[state=checked]:border-[color:var(--color-primary)] data-[state=checked]:bg-[color:var(--color-primary)] data-[state=checked]:text-[color:var(--color-surface)]"
                  />
                  <span className="text-[13px] leading-snug text-[color:var(--color-text)]/90">
                    Send me gentle reflections now and then.
                  </span>
                </label>
              </div>
            </>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            {view === "auth" ? (
              <div className="flex flex-col items-start gap-1">
                {mode === "signin" ? (
                  <>
                    <button type="button" onClick={() => setView("forgot")} className={linkClass}>
                      Forgot passphrase?
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      className={linkClass}
                      data-testid="link-toggle-mode"
                    >
                      Create your space
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className={linkClass}
                    data-testid="link-toggle-mode"
                  >
                    I already have one
                  </button>
                )}
              </div>
            ) : (
              <button type="button" onClick={() => setView("auth")} className={linkClass}>
                Back to sign in
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              data-testid="button-auth-submit"
              className={cn(
                "shrink-0 rounded-full border border-[color:var(--color-primary)]/20 bg-[color:var(--color-primary)] px-5 py-2.5 font-serif text-[14px] tracking-[0.01em] text-[color:var(--color-surface)] shadow-[0_14px_36px_-18px_rgba(0,0,0,0.45)] transition hover:brightness-[1.03] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]/35 focus:ring-offset-2 focus:ring-offset-[color:var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {loading
                ? "…"
                : view === "forgot"
                  ? "Send reset link"
                  : mode === "signin"
                    ? "Sign in"
                    : "Keep this Sift"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
