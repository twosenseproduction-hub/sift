import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiftBaseBackground } from "@/components/bedroom-session/sift-base-background";
import { useResetPassphrase } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

function readTokenFromHash(): string {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash.replace(/^#/, "");
  const q = hash.includes("?") ? hash.slice(hash.indexOf("?")) : "";
  return new URLSearchParams(q).get("token")?.trim() ?? "";
}

export default function ResetPassphrasePage() {
  const token = useMemo(() => readTokenFromHash(), []);
  const [, setLocation] = useLocation();
  const [passphrase, setPassphrase] = useState("");
  const reset = useResetPassphrase();
  const { toast } = useToast();

  if (!token) {
    return (
      <main className="bedroom-session sift-base-session relative flex min-h-[100dvh] items-center justify-center px-5">
        <SiftBaseBackground mode="dark" />
        <div className="relative z-10 max-w-md rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]/95 p-6 text-center">
          <p className="font-serif text-xl text-[color:var(--color-text)]">Link not valid</p>
          <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
            Request a new reset link from the sign-in screen.
          </p>
          <Link href="/">
            <a className="mt-4 inline-block text-sm font-medium text-[color:var(--color-primary-deep)] underline-offset-4 hover:underline">
              Back to Sift
            </a>
          </Link>
        </div>
      </main>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await reset.mutateAsync({ token, passphrase });
      toast({ title: "Passphrase updated", description: "You can sign in with the new one." });
      setLocation("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.replace(/^\d+:\s*/, "") : "Try again.";
      toast({ title: "Could not reset", description: msg });
    }
  };

  return (
    <main className="bedroom-session sift-base-session relative flex min-h-[100dvh] items-center justify-center px-5">
      <SiftBaseBackground mode="dark" />
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-md space-y-4 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]/95 p-6"
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">
            Recovery
          </p>
          <h1 className="mt-1 font-serif text-2xl text-[color:var(--color-text)]">
            Choose a new passphrase
          </h1>
          <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
            At least 6 characters. Write it down somewhere safe.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-passphrase">New passphrase</Label>
          <Input
            id="new-passphrase"
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            minLength={6}
            required
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={reset.isPending}>
          {reset.isPending ? "Saving…" : "Save passphrase"}
        </Button>
      </form>
    </main>
  );
}
