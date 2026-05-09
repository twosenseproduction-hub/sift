import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResetPassword } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

// The reset page is mounted at /#/reset?token=...
// Wouter's useLocation gives us the full hash path, from which we parse the token.
export default function ResetPasswordPage() {
  const location = useLocation()[0];
  const resetPassword = useResetPassword();
  const { toast } = useToast();

  const [token, setToken] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [done, setDone] = useState(false);

  // Extract token from URL on mount.
  useEffect(() => {
    const params = new URLSearchParams(location.split("?")[1] || "");
    setToken(params.get("token") || "");
  }, [location]);

  const loading = resetPassword.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassphrase !== confirmPassphrase) {
      toast({ title: "Passphrases don't match", description: "Try again." });
      return;
    }
    if (newPassphrase.length < 6) {
      toast({ title: "Passphrase too short", description: "At least 6 characters." });
      return;
    }
    try {
      await resetPassword.mutateAsync({ token, newPassphrase });
      setDone(true);
    } catch (err: any) {
      const msg = err?.message?.replace(/^\d+:\s*/, "") ?? "Something went wrong.";
      let parsed = msg;
      try {
        const obj = JSON.parse(msg);
        parsed = obj.error ?? msg;
      } catch {}
      toast({ title: "Can't reset passphrase", description: parsed });
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <p className="font-serif text-2xl">Passphrase updated.</p>
          <p className="text-muted-foreground text-sm">
            You are now signed in. <a href="/#/" className="underline hover:text-foreground">Go to your thread.</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="font-serif text-2xl mb-2">Set a new passphrase</p>
          <p className="text-muted-foreground text-sm">Enter it twice to confirm.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="newPassphrase" className="text-xs uppercase tracking-widest text-muted-foreground">
              New passphrase
            </Label>
            <Input
              id="newPassphrase"
              type="password"
              value={newPassphrase}
              onChange={(e) => setNewPassphrase(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassphrase" className="text-xs uppercase tracking-widest text-muted-foreground">
              Confirm passphrase
            </Label>
            <Input
              id="confirmPassphrase"
              type="password"
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              autoComplete="new-password"
              placeholder="Same passphrase again"
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !token}>
            {loading ? "…" : "Reset passphrase"}
          </Button>
        </form>

        {!token && (
          <p className="text-center text-sm text-muted-foreground">
            No reset token in the URL.{" "}
            <a href="/#/" className="underline hover:text-foreground">Go home.</a>
          </p>
        )}
      </div>
    </div>
  );
}