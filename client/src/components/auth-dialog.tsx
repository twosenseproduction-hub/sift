import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useLogin, useSignup, useRequestPasswordReset } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: "signin" | "signup";
}

type AuthMode = "signin" | "signup" | "forgot";

export function AuthDialog({ open, onOpenChange, initialMode = "signup" }: Props) {
  const [mode, setMode] = useState<AuthMode>(initialMode === "signin" ? "signin" : "signup");
  const [handle, setHandle] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [contact, setContact] = useState("");
  const [consentUpdates, setConsentUpdates] = useState(false);
  const [consentReflections, setConsentReflections] = useState(false);
  // Forgot-mode state
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const login = useLogin();
  const signup = useSignup();
  const requestReset = useRequestPasswordReset();
  const { toast } = useToast();

  const loading = login.isPending || signup.isPending || requestReset.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "signin") {
        await login.mutateAsync({ handle: handle.trim(), passphrase });
      } else if (mode === "signup") {
        await signup.mutateAsync({
          handle: handle.trim(),
          passphrase,
          contact: contact.trim(),
          consentUpdates,
          consentReflections,
        });
      }
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      const msg = err?.message?.replace(/^\d+:\s*/, "") ?? "Something went wrong.";
      let parsed = msg;
      try {
        const obj = JSON.parse(msg);
        parsed = obj.error ?? msg;
      } catch {}
      toast({ title: mode === "signin" ? "Can't sign in" : "Can't sign up", description: parsed });
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await requestReset.mutateAsync({ email: resetEmail.trim() });
      setResetSent(true);
    } catch (err: any) {
      const msg = err?.message?.replace(/^\d+:\s*/, "") ?? "Something went wrong.";
      toast({ title: "Can't send reset link", description: msg });
    }
  };

  const resetForm = () => {
    setPassphrase("");
    setHandle("");
    setContact("");
    setConsentUpdates(false);
    setConsentReflections(false);
    setResetEmail("");
    setResetSent(false);
  };

  const switchMode = (m: AuthMode) => {
    setMode(m);
    resetForm();
  };

  // Forgot passphrase view
  if (mode === "forgot") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Forgot passphrase</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {resetSent
                ? "If we found an account for that email, we sent a reset link."
                : "Enter your email and we'll send a reset link."}
            </DialogDescription>
          </DialogHeader>

          {resetSent ? (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Check your inbox. The link arrives within a few minutes.
                If you don't see it, check your spam folder.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => switchMode("signin")}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={submitReset} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="resetEmail" className="text-xs uppercase tracking-widest text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="resetEmail"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "…" : "Send reset link"}
              </Button>
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="w-full text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
              >
                Back to sign in
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {mode === "signup" ? "Keep your thread" : "Welcome back"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {mode === "signup"
              ? "Pick a handle and a passphrase. A quiet place for your sifts."
              : "Enter your handle and passphrase."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-2" data-testid="form-auth">
          <div className="space-y-1.5">
            <Label htmlFor="handle" className="text-xs uppercase tracking-widest text-muted-foreground">Handle</Label>
            <Input
              id="handle"
              data-testid="input-handle"
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
              pattern="[a-zA-Z0-9_.\-]+"
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="passphrase" className="text-xs uppercase tracking-widest text-muted-foreground">Passphrase</Label>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
                >
                  Forgot passphrase?
                </button>
              )}
            </div>
            <Input
              id="passphrase"
              data-testid="input-passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="At least 6 characters"
              required
              minLength={6}
              disabled={loading}
            />
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground pt-1">
                Write it down somewhere. If you lose it, your thread is gone — there is no recovery.
              </p>
            )}
          </div>

          {mode === "signup" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="contact" className="text-xs uppercase tracking-widest text-muted-foreground">Email or phone</Label>
                <Input
                  id="contact"
                  data-testid="input-contact"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="you@example.com or +15551234567"
                  required
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground pt-1">
                  Used only if you opt in below. Never shared.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={consentUpdates}
                    onCheckedChange={(v) => setConsentUpdates(v === true)}
                    disabled={loading}
                    data-testid="checkbox-consent-updates"
                    className="mt-0.5"
                  />
                  <span className="text-sm leading-snug text-foreground/90">
                    Send me occasional product updates.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={consentReflections}
                    onCheckedChange={(v) => setConsentReflections(v === true)}
                    disabled={loading}
                    data-testid="checkbox-consent-reflections"
                    className="mt-0.5"
                  />
                  <span className="text-sm leading-snug text-foreground/90">
                    Send me gentle reflections now and then.
                  </span>
                </label>
              </div>
            </>
          )}

          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
              data-testid="link-toggle-mode"
            >
              {mode === "signin" ? "Create a thread" : "I already have one"}
            </button>
            <Button type="submit" disabled={loading} data-testid="button-auth-submit">
              {loading ? "…" : mode === "signin" ? "Sign in" : "Create thread"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}