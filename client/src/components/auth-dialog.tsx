import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useLogin, useSignup, useForgotPassphrase } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: "signin" | "signup";
}

export function AuthDialog({ open, onOpenChange, initialMode = "signup" }: Props) {
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

  const loading = login.isPending || signup.isPending || forgot.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (view === "forgot") {
        const data = await forgot.mutateAsync({ handle: handle.trim() });
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
        await login.mutateAsync({ handle: handle.trim(), passphrase });
      } else {
        await signup.mutateAsync({
          handle: handle.trim(),
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
      toast({ title: mode === "signin" ? "Can't sign in" : "Can't sign up", description: parsed });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,760px)] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {view === "forgot"
              ? "Reset passphrase"
              : mode === "signup"
                ? "Save your clarity"
                : "Welcome back"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {view === "forgot"
              ? "Enter your handle. If you added email at signup, a reset link will be issued."
              : mode === "signup"
                ? "Create your space to come back to this. Handle and passphrase only."
                : "Enter your handle and passphrase."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-2" data-testid="form-auth">
          {view === "forgot" ? (
            <div className="space-y-1.5">
              <Label htmlFor="handle-forgot" className="text-xs uppercase tracking-widest text-muted-foreground">
                Handle
              </Label>
              <Input
                id="handle-forgot"
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
            <Label htmlFor="passphrase" className="text-xs uppercase tracking-widest text-muted-foreground">Passphrase</Label>
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
                Add an email at signup if you may need passphrase recovery later.
              </p>
            )}
          </div>
          </>
          )}

          {view === "auth" && mode === "signup" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="contact" className="text-xs uppercase tracking-widest text-muted-foreground">Email or phone optional</Label>
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
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground pt-1">
                  Add this only if you want reminders or updates later. Never shared.
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
            {view === "auth" ? (
            <div className="flex flex-col items-start gap-1">
              {mode === "signin" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setView("forgot")}
                    className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
                  >
                    Forgot passphrase?
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
                    data-testid="link-toggle-mode"
                  >
                    Create your space
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
                  data-testid="link-toggle-mode"
                >
                  I already have one
                </button>
              )}
            </div>
            ) : (
            <button
              type="button"
              onClick={() => setView("auth")}
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
            >
              Back to sign in
            </button>
            )}
            <Button type="submit" disabled={loading} data-testid="button-auth-submit">
              {loading
                ? "…"
                : view === "forgot"
                  ? "Send reset link"
                  : mode === "signin"
                    ? "Sign in"
                    : "Keep this Sift"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
