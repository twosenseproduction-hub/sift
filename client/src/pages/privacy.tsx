import { useEffect, useState } from "react";
import { Header, Footnote } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  getBYOKAnthropicKey,
  setBYOKAnthropicKey,
} from "@/lib/byok-settings";

export default function PrivacyPage() {
  const { toast } = useToast();
  const [keyInput, setKeyInput] = useState("");

  useEffect(() => {
    setKeyInput(getBYOKAnthropicKey() ?? "");
  }, []);

  const saveByok = () => {
    setBYOKAnthropicKey(keyInput.trim() || null);
    toast({
      title: keyInput.trim() ? "API key saved locally" : "Using hosted key",
      description: keyInput.trim()
        ? "Stored only on this device. Sent with each AI request — not saved on Sift servers."
        : "Requests use the server’s Anthropic key when available.",
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-xl px-6 md:px-8 pt-14 md:pt-20 pb-16">
          <p className="text-[11px] tracking-[0.25em] uppercase text-primary/80 font-medium mb-4">
            Privacy
          </p>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight mb-5">
            Your key on this device
          </h1>
          <p className="text-muted-foreground mb-10 text-[15px] leading-relaxed">
            Optionally use your own Anthropic API key for sifts. It stays in this
            browser and is sent only with requests so the model can run — Sift does
            not store it on our servers.
          </p>

          <div className="rounded-lg border border-border/80 bg-card/40 p-5 space-y-6">
            <div className="space-y-3">
              <Label htmlFor="byok">Your Anthropic API key (optional)</Label>
              <p className="text-sm text-muted-foreground">
                From{" "}
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  console.anthropic.com
                </a>
                . Stored only in localStorage on this device. Sent to our server in
                the request header for each sift so the model can run — the key is
                not written to disk on our side. For direct device-to-provider
                routing, use a native app; the web uses a relay for Claude.
              </p>
              <Input
                id="byok"
                type="password"
                autoComplete="off"
                placeholder="sk-ant-api03-…"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
              />
              <Button type="button" variant="secondary" onClick={saveByok}>
                Save key on this device
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footnote />
    </div>
  );
}
