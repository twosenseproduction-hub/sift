import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send, Copy, Link2, RotateCcw, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  createRecognizer,
  isVoiceSupported,
  type RecognitionHandle,
} from "@/lib/voice";
import type { SiftResult } from "@shared/schema";

// ---------- Composer ----------

interface ComposerProps {
  onResult: (r: SiftResult) => void;
}

export function Composer({ onResult }: ComposerProps) {
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<RecognitionHandle | null>(null);
  const voiceSupported = isVoiceSupported();
  const { toast } = useToast();
  const modeRef = useRef<"text" | "voice">("text");

  useEffect(() => () => recRef.current?.stop(), []);

  const startVoice = () => {
    if (!voiceSupported) {
      toast({
        title: "Voice not supported",
        description:
          "Your browser doesn't support voice input. Try Chrome or Edge on desktop.",
      });
      return;
    }
    modeRef.current = "voice";
    const baseline = input.trim();
    recRef.current = createRecognizer({
      onResult: (t, isFinal) => {
        if (isFinal) {
          setInput((baseline ? baseline + "\n\n" : "") + t);
          setInterim("");
        } else {
          setInterim(t);
        }
      },
      onError: (msg) => {
        toast({ title: "Voice error", description: msg });
        setRecording(false);
      },
      onEnd: () => setRecording(false),
    });
    recRef.current?.start();
    setRecording(true);
  };

  const stopVoice = () => {
    recRef.current?.stop();
    setRecording(false);
  };

  const submit = async () => {
    const text = input.trim();
    if (!text) return;
    if (recording) stopVoice();
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/sift", {
        input: text,
        inputMode: modeRef.current,
      });
      const data = (await res.json()) as SiftResult;
      onResult(data);
      setInput("");
      setInterim("");
      modeRef.current = "text";
    } catch (err: any) {
      toast({
        title: "Couldn't sift that",
        description: err?.message ?? "Try again in a moment.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const displayText = recording && interim ? input + (input ? " " : "") + interim : input;

  return (
    <div className="relative" data-testid="composer">
      <div
        className={[
          "relative rounded-2xl border bg-card transition-all",
          recording
            ? "border-primary/40 shadow-lg shadow-primary/5"
            : "border-card-border shadow-sm",
        ].join(" ")}
      >
        <Textarea
          data-testid="input-thoughts"
          value={displayText}
          onChange={(e) => {
            modeRef.current = recording ? "voice" : "text";
            setInput(e.target.value);
            setInterim("");
          }}
          onKeyDown={handleKey}
          disabled={loading}
          placeholder="Pour it all out. Half-formed is fine. The knot, the noise, the thing you can't name yet…"
          className="min-h-[220px] md:min-h-[260px] resize-none border-0 bg-transparent px-5 py-5 md:px-7 md:py-6 text-base md:text-[17px] leading-relaxed focus-visible:ring-0 placeholder:text-muted-foreground/70"
        />

        <div className="flex items-center justify-between gap-3 px-3 md:px-4 py-3 border-t border-border/60">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={recording ? "default" : "ghost"}
              size="sm"
              onClick={recording ? stopVoice : startVoice}
              disabled={loading || !voiceSupported}
              data-testid="button-voice"
              aria-label={recording ? "Stop recording" : "Start voice input"}
              className={recording ? "gap-2" : "gap-2 text-muted-foreground hover:text-foreground"}
              title={
                voiceSupported
                  ? recording
                    ? "Stop recording"
                    : "Speak your thoughts"
                  : "Voice not supported in this browser"
              }
            >
              {recording ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span className="hidden sm:inline">Stop</span>
                  <WaveBars />
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span className="hidden sm:inline">Speak</span>
                </>
              )}
            </Button>

            <span className="text-xs text-muted-foreground hidden md:inline">
              {recording ? "Listening…" : voiceSupported ? "Type or speak" : "Typing only"}
            </span>
          </div>

          <Button
            type="button"
            onClick={submit}
            disabled={loading || !input.trim()}
            data-testid="button-sift"
            className="gap-2"
          >
            {loading ? (
              <>
                <Sparkles className="w-4 h-4 animate-pulse" />
                Sifting…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Sift it
              </>
            )}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3 text-center">
        <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/60">
          ⌘
        </kbd>{" "}
        +{" "}
        <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/60">
          Enter
        </kbd>{" "}
        to sift
      </p>
    </div>
  );
}

function WaveBars() {
  return (
    <span className="inline-flex items-end gap-0.5 ml-1 h-3">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="wave-bar block w-0.5 bg-current rounded-full h-full origin-bottom"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

// ---------- Result ----------

interface ResultProps {
  result: SiftResult;
  onReset?: () => void;
  readOnly?: boolean;
}

export function Result({ result, onReset, readOnly }: ResultProps) {
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}#/s/${result.id}`
      : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      toast({ title: "Couldn't copy link", description: shareUrl });
    }
  };

  const copyText = async () => {
    const body = [
      `Sift — ${new Date(result.createdAt).toLocaleString()}`,
      "",
      "Themes:",
      ...result.themes.map((t, i) => `${i + 1}. ${t.title} — ${t.summary}`),
      "",
      `What I actually want:`,
      result.coreIntent,
      "",
      `Next step:`,
      result.nextStep,
      "",
      `Reflection:`,
      result.reflection,
      "",
      shareUrl,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(body);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 1800);
    } catch {
      toast({ title: "Couldn't copy", description: "Try again." });
    }
  };

  return (
    <article className="fade-up" data-testid="result">
      <div className="space-y-10 md:space-y-12">
        {/* Core intent — the headline */}
        <section data-testid="section-intent">
          <Label>What you actually want</Label>
          <p
            className="font-serif text-2xl md:text-3xl leading-[1.25] text-foreground mt-3"
            data-testid="text-intent"
          >
            {result.coreIntent}
          </p>
        </section>

        {/* Themes */}
        <section data-testid="section-themes">
          <Label>Themes underneath</Label>
          <ul className="mt-4 divide-y divide-border/70 border-y border-border/70">
            {result.themes.map((t, i) => (
              <li
                key={i}
                className="py-4 md:py-5 flex gap-4 md:gap-6"
                data-testid={`theme-${i}`}
              >
                <span className="font-mono text-xs text-muted-foreground pt-1 w-6">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <h3 className="font-serif text-lg md:text-xl text-foreground">
                    {t.title}
                  </h3>
                  <p className="text-sm md:text-[15px] text-muted-foreground mt-1.5 leading-relaxed">
                    {t.summary}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Next step */}
        <section data-testid="section-next">
          <Label>One next step</Label>
          <div className="mt-3 rounded-2xl border border-primary/25 bg-primary/5 p-5 md:p-6">
            <p
              className="font-serif text-xl md:text-2xl leading-snug text-foreground"
              data-testid="text-next-step"
            >
              {result.nextStep}
            </p>
          </div>
        </section>

        {/* Reflection */}
        <section data-testid="section-reflection">
          <Label>Quiet reflection</Label>
          <p
            className="mt-3 text-base md:text-[17px] text-muted-foreground italic leading-relaxed"
            data-testid="text-reflection"
          >
            "{result.reflection}"
          </p>
        </section>

        {/* Actions */}
        <div className="pt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyLink}
            data-testid="button-copy-link"
            className="gap-2"
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            {copiedLink ? "Link copied" : "Share link"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyText}
            data-testid="button-copy-text"
            className="gap-2"
          >
            {copiedText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedText ? "Copied" : "Copy as text"}
          </Button>
          {!readOnly && onReset && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              data-testid="button-reset"
              className="gap-2 text-muted-foreground"
            >
              <RotateCcw className="w-4 h-4" />
              Sift something else
            </Button>
          )}
        </div>

        {/* Original input (collapsed) */}
        {result.input && (
          <details className="group pt-4 border-t border-border/60" data-testid="details-original">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-2">
              <span className="group-open:rotate-90 transition-transform inline-block">›</span>
              Read the original
            </summary>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-muted-foreground leading-relaxed">
              {result.input}
            </pre>
          </details>
        )}
      </div>
    </article>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px w-6 bg-primary/40" />
      <span className="text-[11px] tracking-[0.2em] uppercase font-medium text-primary/80">
        {children}
      </span>
    </div>
  );
}

// ---------- Skeleton while thinking ----------

export function Thinking() {
  return (
    <div className="fade-up space-y-8" data-testid="thinking">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="pulse-dot h-2 w-2 rounded-full bg-primary" />
        <span className="text-sm">Sifting your thoughts…</span>
      </div>
      <div className="space-y-3">
        <div className="h-7 w-3/4 rounded bg-muted/70 animate-pulse" />
        <div className="h-7 w-2/3 rounded bg-muted/70 animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-1/2 rounded bg-muted/60 animate-pulse" />
        <div className="h-4 w-11/12 rounded bg-muted/60 animate-pulse" />
        <div className="h-4 w-10/12 rounded bg-muted/60 animate-pulse" />
      </div>
    </div>
  );
}
