import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type {
  ThreadTurn,
  Bookmark,
  DeepenResponse,
  CloseResponse,
  SiftTurnMessage,
  BookmarkPayload,
} from "@shared/schema";

// DeepeningThread
//
// A calm, conversational follow-on to the initial sift. Each user turn gets a
// short reply (mirror / question / shifted matters+noise / mini synthesis) —
// not a full result card. Every few turns the server emits a checkpoint, which
// renders inline distinctly. When the server signals the thread is converging,
// we surface a subtle "close this loop / keep processing" row.
//
// The parent owns the sift id and the initial turns/bookmark. We mutate a
// local copy of `turns` as new server responses come in.
//
// Labels on checkpoints must match the product spec labels verbatim.
interface DeepeningThreadProps {
  siftId: string;
  initialTurns: ThreadTurn[];
  initialBookmark?: Bookmark;
  onCare: () => void;
  onClosed?: (reflection: string) => void;
  // Called whenever we receive a new bookmark from the server so the parent
  // can persist it to the cache (e.g. update the Shared page bookmark card).
  onBookmarkUpdate?: (bookmark: Bookmark) => void;
}

export function DeepeningThread({
  siftId,
  initialTurns,
  initialBookmark,
  onCare,
  onClosed,
  onBookmarkUpdate,
}: DeepeningThreadProps) {
  const [turns, setTurns] = useState<ThreadTurn[]>(initialTurns);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [converged, setConverged] = useState(false);
  const [closedReflection, setClosedReflection] = useState<string | null>(null);
  const { toast } = useToast();
  const endRef = useRef<HTMLDivElement | null>(null);

  // Keep a ref of the latest bookmark so we don't trigger "converged" twice.
  const lastBookmarkRef = useRef<Bookmark | undefined>(initialBookmark);

  // Scroll the new turns into view when they arrive.
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [turns.length, closedReflection]);

  // If a closure turn already exists in initialTurns (returning to a closed
  // thread that somehow still entered deepening), surface its reflection.
  useEffect(() => {
    const closure = [...initialTurns]
      .reverse()
      .find((t) => t.role === "sift" && t.kind === "closure");
    if (closure && closure.role === "sift" && closure.kind === "closure") {
      setClosedReflection(closure.reflection);
    }
  }, [initialTurns]);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setPending(true);
    try {
      const res = await apiRequest("POST", `/api/sift/${siftId}/deepen`, {
        text: trimmed,
      });
      const data = (await res.json()) as DeepenResponse;
      if (data.type === "care") {
        onCare();
        return;
      }
      setTurns((prev) => [...prev, ...data.turns]);
      setText("");
      if (data.bookmark) {
        lastBookmarkRef.current = data.bookmark;
        onBookmarkUpdate?.(data.bookmark);
      }
      if (data.converged) {
        setConverged(true);
      }
    } catch (err: any) {
      toast({
        title: "Couldn't continue the thread",
        description: err?.message ?? "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  }

  async function closeLoop() {
    if (closing) return;
    setClosing(true);
    try {
      const res = await apiRequest("POST", `/api/sift/${siftId}/close`);
      const data = (await res.json()) as CloseResponse;
      if (data.type === "care") {
        onCare();
        return;
      }
      setTurns((prev) => [...prev, data.turn]);
      setClosedReflection(data.reflection);
      onClosed?.(data.reflection);
    } catch (err: any) {
      toast({
        title: "Couldn't close this",
        description: err?.message ?? "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setClosing(false);
    }
  }

  const closed = closedReflection !== null;

  return (
    <div className="space-y-6" data-testid="deepening-thread">
      {/* Thread list */}
      <div className="space-y-5">
        {turns.map((t) => (
          <TurnRow key={`${t.kind}-${t.id}`} turn={t} />
        ))}
        <div ref={endRef} />
      </div>

      {/* Convergence offering — quiet, inline. Appears once; stays until the
          user chooses one path. Copy matches product labels. */}
      {converged && !closed && (
        <div
          className="rounded-xl border border-border/60 bg-muted/30 px-4 py-4"
          data-testid="panel-convergence"
        >
          <p
            className="text-sm text-muted-foreground mb-3"
            data-testid="text-convergence-cue"
          >
            This seems to be landing in a similar place. You can stay with it or
            let it rest.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={closeLoop}
              disabled={closing}
              data-testid="button-close-loop-convergence"
            >
              {closing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Closing…
                </>
              ) : (
                "Close this loop"
              )}
            </Button>
            <button
              type="button"
              onClick={() => setConverged(false)}
              data-testid="button-keep-processing-inline"
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
            >
              Keep processing this
            </button>
          </div>
        </div>
      )}

      {/* Closure reflection — final, quiet. No composer beneath. */}
      {closed && closedReflection && (
        <div
          className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-5"
          data-testid="panel-closure"
        >
          <p
            className="text-[11px] tracking-[0.25em] uppercase text-primary/80 mb-2 font-medium"
            data-testid="text-closure-eyebrow"
          >
            This loop, closed
          </p>
          <p
            className="text-base leading-relaxed text-foreground/90"
            data-testid="text-closure-reflection"
          >
            {closedReflection}
          </p>
        </div>
      )}

      {/* Composer — hidden once the loop is closed. */}
      {!closed && (
        <div className="pt-2" data-testid="composer-deepen">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Cmd/Ctrl+Enter submits, matching the main composer.
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Staying with this, what I want to say next is…"
            rows={3}
            disabled={pending}
            data-testid="input-deepen"
            className="resize-none text-[15px] leading-relaxed"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p
              className="text-xs text-muted-foreground/70"
              data-testid="text-deepen-helper"
            >
              Short is fine. One thought at a time.
            </p>
            <div className="flex items-center gap-3">
              {!converged && (
                <button
                  type="button"
                  onClick={closeLoop}
                  disabled={closing || pending}
                  data-testid="link-close-loop"
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors disabled:opacity-50"
                >
                  {closing ? "Closing…" : "Close this loop"}
                </button>
              )}
              <Button
                type="button"
                onClick={submit}
                disabled={pending || !text.trim()}
                data-testid="button-deepen-submit"
                className="gap-2"
              >
                {pending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sifting…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Continue
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Turn row ---
// User turns: plain right-leaning bubble. Calm, not chat-appy.
// Sift message turns: mirror + question + optional matters/noise/mini.
// Checkpoint turns: inline labeled mini-synthesis card.
// Closure turns: quiet final reflection.
function TurnRow({ turn }: { turn: ThreadTurn }) {
  if (turn.role === "user" && turn.kind === "message") {
    return (
      <div className="flex justify-end" data-testid={`turn-user-${turn.id}`}>
        <div
          className="max-w-[85%] rounded-2xl rounded-tr-sm bg-muted/60 px-4 py-3 text-[15px] leading-relaxed text-foreground/90"
          data-testid={`text-user-turn-${turn.id}`}
        >
          {turn.text}
        </div>
      </div>
    );
  }
  if (turn.role === "sift" && turn.kind === "message") {
    return <SiftMessageTurn turn={turn} />;
  }
  if (turn.role === "sift" && turn.kind === "checkpoint") {
    return <CheckpointTurn payload={turn.checkpoint} id={turn.id} />;
  }
  if (turn.role === "sift" && turn.kind === "closure") {
    // Closure is surfaced in its own panel above; avoid double-render here.
    return null;
  }
  return null;
}

function SiftMessageTurn({
  turn,
}: {
  turn: Extract<ThreadTurn, { role: "sift"; kind: "message" }>;
}) {
  const m: SiftTurnMessage = turn.message;
  return (
    <div
      className="space-y-2.5"
      data-testid={`turn-sift-${turn.id}`}
    >
      {m.mirror && (
        <p
          className="text-[15px] leading-relaxed text-foreground/90"
          data-testid={`text-mirror-${turn.id}`}
        >
          {m.mirror}
        </p>
      )}
      {m.mini && (
        <p
          className="text-[15px] leading-relaxed text-foreground/90"
          data-testid={`text-mini-${turn.id}`}
        >
          {m.mini}
        </p>
      )}
      {(m.matters?.length ?? 0) > 0 && (
        <div data-testid={`turn-matters-${turn.id}`}>
          <p className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground/80 mb-1 font-medium">
            Matters
          </p>
          <ul className="space-y-1">
            {m.matters!.map((x, i) => (
              <li
                key={`mat-${i}`}
                className="text-[14px] leading-relaxed text-foreground/90 flex gap-2"
              >
                <span className="text-primary/60 mt-[0.4em]">·</span>
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(m.noise?.length ?? 0) > 0 && (
        <div data-testid={`turn-noise-${turn.id}`}>
          <p className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground/80 mb-1 font-medium">
            Noise
          </p>
          <ul className="space-y-1">
            {m.noise!.map((x, i) => (
              <li
                key={`noi-${i}`}
                className="text-[14px] leading-relaxed text-muted-foreground flex gap-2"
              >
                <span className="text-muted-foreground/50 mt-[0.4em]">·</span>
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {m.question && (
        <p
          className="text-[15px] leading-relaxed text-foreground italic font-serif pt-1"
          style={{ fontStyle: "italic" }}
          data-testid={`text-question-${turn.id}`}
        >
          {m.question}
        </p>
      )}
    </div>
  );
}

function CheckpointTurn({
  payload,
  id,
}: {
  payload: BookmarkPayload;
  id: number;
}) {
  return (
    <div
      className="rounded-2xl border border-border/60 bg-card/40 px-5 py-5 md:px-6 md:py-6"
      data-testid={`turn-checkpoint-${id}`}
    >
      <p
        className="text-[11px] tracking-[0.25em] uppercase text-primary/80 mb-4 font-medium"
        data-testid={`label-checkpoint-${id}`}
      >
        A quiet checkpoint
      </p>
      <div className="space-y-4">
        <CpSection label="What this may be pointing to">
          <p className="text-[15px] leading-relaxed text-foreground/90">
            {payload.pointing}
          </p>
        </CpSection>
        <CpSection label="What has unfolded so far">
          <p className="text-[15px] leading-relaxed text-foreground/90">
            {payload.unfolded}
          </p>
        </CpSection>
        <CpSection label="What seems to matter most right now">
          <ul className="space-y-1.5">
            {payload.matters.map((m, i) => (
              <li
                key={`m-${i}`}
                className="text-[15px] leading-relaxed text-foreground/90 flex gap-2"
              >
                <span className="text-primary/60 mt-[0.4em]">·</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </CpSection>
        <CpSection label="What may be noise right now">
          <ul className="space-y-1.5">
            {payload.noise.map((n, i) => (
              <li
                key={`n-${i}`}
                className="text-[15px] leading-relaxed text-muted-foreground flex gap-2"
              >
                <span className="text-muted-foreground/50 mt-[0.4em]">·</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </CpSection>
        <CpSection label="Where you last landed">
          <p className="text-[15px] leading-relaxed text-foreground/90">
            {payload.lastLanded}
          </p>
        </CpSection>
        <CpSection label="A next step, if there is one">
          <p className="text-[15px] leading-relaxed text-foreground/90">
            {payload.nextStep}
          </p>
        </CpSection>
      </div>
    </div>
  );
}

function CpSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground/80 mb-1.5 font-medium">
        {label}
      </p>
      {children}
    </div>
  );
}
