import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useUpdateContact } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss: () => void;
}

export function ContactPromptDialog({ open, onOpenChange, onDismiss }: Props) {
  const [contact, setContact] = useState("");
  const [consentUpdates, setConsentUpdates] = useState(false);
  const [consentReflections, setConsentReflections] = useState(false);
  const update = useUpdateContact();
  const { toast } = useToast();

  const loading = update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        contact: contact.trim(),
        consentUpdates,
        consentReflections,
      });
      onDismiss();
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.message?.replace(/^\d+:\s*/, "") ?? "Something went wrong.";
      let parsed = msg;
      try {
        const obj = JSON.parse(msg);
        parsed = obj.error ?? msg;
      } catch {}
      toast({ title: "Can't save", description: parsed });
    }
  };

  const handleSkip = () => {
    onDismiss();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Stay in quiet touch</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Leave a way to reach you, only if you want. You can skip this.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-2" data-testid="form-contact-prompt">
          <div className="space-y-1.5">
            <Label htmlFor="contact-prompt" className="text-xs uppercase tracking-widest text-muted-foreground">Email or phone</Label>
            <Input
              id="contact-prompt"
              data-testid="input-contact-prompt"
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
                data-testid="checkbox-prompt-updates"
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
                data-testid="checkbox-prompt-reflections"
                className="mt-0.5"
              />
              <span className="text-sm leading-snug text-foreground/90">
                Send me gentle reflections now and then.
              </span>
            </label>
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleSkip}
              disabled={loading}
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors disabled:opacity-50"
              data-testid="button-contact-skip"
            >
              Skip for now
            </button>
            <Button type="submit" disabled={loading} data-testid="button-contact-save">
              {loading ? "…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
