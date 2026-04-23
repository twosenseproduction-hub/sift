import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  /** User's original submission — shown as quiet context, not editable here. */
  originalInput: string;
  /** Called when the user answers. Parent merges the answer with the original
   *  input and re-submits through the normal analysis flow. */
  onAnswer: (answer: string) => void;
  /** Called when the user taps the back action to edit the original input. */
  onCancel: () => void;
  /** True while the parent is re-submitting the merged input to the server. */
  submitting?: boolean;
}

// Quick reply chips. Plain strings — tapping one fills the textarea rather
// than auto-submitting, so the user can still refine before sending.
const CHIPS = [
  "Pressure",
  "Fear",
  "Confusion",
  "Something else",
];

/**
 * ClarifyPrompt
 *
 * A small, calm fallback shown when the user's initial submission is too thin
 * to cleanly sift. Asks exactly one question, offers optional chips, and
 * accepts free text. Not a chat, not a wizard.
 */
export function ClarifyPrompt({
  originalInput,
  onAnswer,
  onCancel,
  submitting = false,
}: Props) {
  const [answer, setAnswer] = useState("");

  const canSubmit = answer.trim().length > 0 && !submitting;

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
      e.preventDefault();
      onAnswer(answer.trim());
    }
  };

  return (
    <section
      aria-labelledby="clarify-title"
      className="rounded-2xl border border-card-border bg-card p-5 md:p-7"
      data-testid="card-clarify"
    >
      <p
        className="text-[11px] tracking-[0.25em] uppercase text-primary/80 font-medium"
        data-testid="text-clarify-eyebrow"
      >
        One more angle
      </p>
      <p
        id="clarify-title"
        className="mt-3 font-serif text-xl md:text-2xl leading-snug tracking-tight"
        data-testid="text-clarify-line"
      >
        There's something here, but not quite enough to separate what matters
        from what's just loud yet.
      </p>
      <p
        className="mt-3 text-sm md:text-[15px] text-muted-foreground leading-relaxed"
        data-testid="text-clarify-question"
      >
        Is this more about pressure, fear, confusion — or something else?
      </p>

      {originalInput ? (
        <p
          className="mt-4 text-xs md:text-sm text-muted-foreground/80 italic border-l-2 border-border/60 pl-3"
          data-testid="text-clarify-context"
        >
          &ldquo;{originalInput.length > 180
            ? originalInput.slice(0, 180).trim() + "…"
            : originalInput}&rdquo;
        </p>
      ) : null}

      <div
        className="mt-5 flex flex-wrap gap-2"
        data-testid="group-clarify-chips"
      >
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setAnswer((a) => (a ? a : chip))}
            disabled={submitting}
            data-testid={`chip-clarify-${chip.toLowerCase().replace(/\s+/g, "-")}`}
            className="text-sm rounded-full border border-border px-3 py-1.5 text-foreground/80 hover:border-foreground/40 hover:text-foreground transition-colors disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-card-border bg-background">
        <Textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={handleKey}
          disabled={submitting}
          placeholder="A sentence is enough."
          data-testid="input-clarify-answer"
          className="min-h-[96px] resize-none border-0 bg-transparent px-4 py-3 text-base leading-relaxed focus-visible:ring-0 placeholder:text-muted-foreground/60"
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          data-testid="link-clarify-back"
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors disabled:opacity-50"
        >
          Edit my thought
        </button>
        <Button
          type="button"
          onClick={() => canSubmit && onAnswer(answer.trim())}
          disabled={!canSubmit}
          data-testid="button-clarify-submit"
          className="gap-2"
        >
          Sift with this
        </Button>
      </div>
    </section>
  );
}
