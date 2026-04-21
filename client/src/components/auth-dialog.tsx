import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin, useSignup } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: "signin" | "signup";
}

export function AuthDialog({ open, onOpenChange, initialMode = "signup" }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [handle, setHandle] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const login = useLogin();
  const signup = useSignup();
  const { toast } = useToast();

  const loading = login.isPending || signup.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { handle: handle.trim(), passphrase };
    const mut = mode === "signin" ? login : signup;
    try {
      await mut.mutateAsync(payload);
      onOpenChange(false);
      setPassphrase("");
      setHandle("");
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {mode === "signup" ? "Keep your thread" : "Welcome back"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {mode === "signup"
              ? "Pick a handle and a passphrase. No email, no verification. Just a quiet place for your sifts."
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
                Write it down somewhere. If you lose it, your thread is gone — there is no recovery.
              </p>
            )}
          </div>

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
