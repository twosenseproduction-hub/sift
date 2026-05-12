import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Header, Footnote } from "@/components/brand";
import { Link } from "wouter";
import type { LucideIcon } from "lucide-react";
import {
  BookMarked,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Compass,
  Layers2,
} from "lucide-react";
import {
  FieldNotesGuidedWalkthrough,
  type GuidedFinishSectionKey,
  type GuidedMethodId,
} from "@/components/field-notes-guided";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sift.fieldNotes.touches";

const GUIDED_CHOICES: {
  id: GuidedMethodId;
  title: string;
  description: string;
  Icon: LucideIcon;
  tintFrom: string;
}[] = [
  {
    id: "signal",
    title: "Signal vs noise",
    description: "Three prompts—what is loud, what matters, what may be noise.",
    Icon: Layers2,
    tintFrom: "from-primary/[0.14]",
  },
  {
    id: "micro",
    title: "Ten-minute move",
    description: "Name it, pick one tiny step, anchor when and where.",
    Icon: Clock,
    tintFrom: "from-primary/[0.11]",
  },
  {
    id: "lanes",
    title: "Default plan path",
    description:
      "Pick Simple, Safe, or Bold—then get one shaped suggestion you can steal or rewrite.",
    Icon: Compass,
    tintFrom: "from-primary/[0.13]",
  },
];

/** Ordered keys — progress strip follows this sequence. */
const FIELD_NOTE_SECTION_KEYS = [
  "signal-noise",
  "micro-move",
  "lanes",
  "simmer",
  "good-enough",
] as const;

type FieldNoteSectionKey = (typeof FIELD_NOTE_SECTION_KEYS)[number];

function loadTouches(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (typeof p !== "object" || p === null || Array.isArray(p)) return {};
    return p as Record<string, boolean>;
  } catch {
    return {};
  }
}

function saveTouches(next: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

function ReferencePattern({
  sectionKey,
  title,
  touched,
  onToggleTouch,
  children,
}: {
  sectionKey: FieldNoteSectionKey;
  title: string;
  touched: boolean;
  onToggleTouch: (key: FieldNoteSectionKey) => void;
  children: ReactNode;
}) {
  return (
    <AccordionItem
      value={sectionKey}
      id={sectionKey}
      className="border-border/35 px-2 md:px-3 transition-colors duration-200 last:border-b-0 data-[state=open]:border-primary/15 data-[state=open]:bg-muted/[0.35]"
    >
      <AccordionTrigger className="rounded-lg py-4 hover:no-underline [&[data-state=open]]:text-foreground gap-3 hover:bg-muted/25 focus-visible:rounded-lg data-[state=open]:hover:bg-transparent">
        <span className="flex flex-1 min-w-0 items-start gap-3 text-left">
          {touched ? (
            <span
              className="mt-1 shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-primary"
              aria-hidden
            >
              <Check className="h-3 w-3" strokeWidth={2.5} />
            </span>
          ) : (
            <span
              className="mt-1 shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/55 bg-muted/15 text-muted-foreground/45 text-[10px] font-mono"
              aria-hidden
            >
              ○
            </span>
          )}
          <span className="font-serif text-base md:text-[17px] text-foreground leading-snug">
            {title}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-5 pt-0">
        <div className="space-y-4 text-sm md:text-[15px] text-muted-foreground leading-relaxed pl-9 md:pl-10">
          {children}
        </div>
        <div className="mt-5 pl-9 md:pl-10">
          <button
            type="button"
            onClick={() => onToggleTouch(sectionKey)}
            data-testid={`field-note-touch-${sectionKey}`}
            className={`text-xs tracking-wide transition-colors underline underline-offset-4 ${
              touched
                ? "text-primary/90 decoration-primary/40 hover:text-foreground hover:decoration-foreground"
                : "text-muted-foreground/85 decoration-border/70 hover:text-foreground hover:decoration-foreground"
            }`}
          >
            {touched
              ? "Marked · tap to undo"
              : "Tried this on something small — mark it"}
          </button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default function FieldNotesPage() {
  const [touches, setTouches] = useState<Record<string, boolean>>({});
  const [guidedMethod, setGuidedMethod] = useState<GuidedMethodId | null>(null);
  const [shelfOpen, setShelfOpen] = useState(false);

  useEffect(() => {
    setTouches(loadTouches());
  }, []);

  const markGuidedComplete = useCallback((key: GuidedFinishSectionKey) => {
    setTouches((prev) => {
      const next = { ...prev, [key]: true };
      saveTouches(next);
      return next;
    });
  }, []);

  const toggleTouch = useCallback((key: FieldNoteSectionKey) => {
    setTouches((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveTouches(next);
      return next;
    });
  }, []);

  const touchedCount = useMemo(
    () =>
      FIELD_NOTE_SECTION_KEYS.filter((k) => touches[k]).length,
    [touches],
  );
  const total = FIELD_NOTE_SECTION_KEYS.length;
  const allTouched = touchedCount === total;

  const clearAll = () => {
    const empty: Record<string, boolean> = {};
    setTouches(empty);
    saveTouches(empty);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="relative flex-1">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_130%_70%_at_50%_-35%,hsl(var(--primary)/0.09),transparent_58%)] dark:bg-[radial-gradient(ellipse_130%_70%_at_50%_-35%,hsl(var(--primary)/0.11),transparent_58%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl px-6 md:px-8 pb-16 pt-10 md:pt-14">
          <p className="text-[11px] tracking-[0.22em] uppercase font-medium text-primary/80 mb-3">
            Field notes
          </p>
          <div className="flex gap-5 md:gap-8 mb-10">
            <div
              className="hidden sm:block w-1 shrink-0 rounded-full bg-gradient-to-b from-primary/55 via-primary/25 to-transparent mt-1.5 self-stretch min-h-[4rem]"
              aria-hidden
            />
            <div className="min-w-0 flex-1 space-y-3">
              <h1 className="font-serif text-3xl md:text-[2rem] leading-[1.15] text-foreground">
                Ways through fatigue &{" "}
                <span className="text-primary">noise</span>
              </h1>
              {!guidedMethod ? (
                <p className="text-sm md:text-[15px] text-muted-foreground leading-relaxed max-w-xl">
                  Start with one short walk. Everything else stays folded away until
                  you open it—nothing to scroll past first.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                  Guided walk—exit with the back arrow when you want the shelf again.
                </p>
              )}
            </div>
          </div>

          {guidedMethod ? (
            <div className="mb-10">
              <FieldNotesGuidedWalkthrough
                key={guidedMethod}
                method={guidedMethod}
                onExitToPicker={() => setGuidedMethod(null)}
                onComplete={markGuidedComplete}
              />
            </div>
          ) : (
            <>
              <div className="mb-8" data-testid="field-notes-guided-picker">
                <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
                  <p className="text-[11px] tracking-[0.18em] uppercase font-medium text-muted-foreground/90">
                    Pick one walk
                  </p>
                  <span className="hidden md:inline text-[11px] text-muted-foreground/55 tracking-wide">
                    Private · stays on this device
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {GUIDED_CHOICES.map((c, idx) => {
                    const Icon = c.Icon;
                    const stepLabel = String(idx + 1).padStart(2, "0");
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setGuidedMethod(c.id)}
                        data-testid={`guided-picker-${c.id}`}
                        className={cn(
                          "group relative overflow-hidden rounded-2xl border border-border/55 bg-card/55 px-4 pb-5 pt-4 text-left shadow-[var(--shadow-sm)]",
                          "transition-all duration-200 hover:border-primary/40 hover:shadow-[var(--shadow-md)] hover:-translate-y-px",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        )}
                      >
                        <div
                          className={cn(
                            "pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                            c.tintFrom,
                          )}
                          aria-hidden
                        />
                        <div className="relative flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/65 tabular-nums">
                              {stepLabel}
                            </span>
                            <Icon
                              className="h-5 w-5 shrink-0 text-primary/40 transition-colors duration-200 group-hover:text-primary/70"
                              strokeWidth={1.75}
                              aria-hidden
                            />
                          </div>
                          <span className="font-serif text-lg text-foreground leading-snug pr-1">
                            {c.title}
                          </span>
                          <span className="block text-xs text-muted-foreground leading-relaxed">
                            {c.description}
                          </span>
                          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                            Begin
                            <span
                              aria-hidden
                              className="transition-transform duration-200 group-hover:translate-x-0.5"
                            >
                              →
                            </span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-10 flex flex-col gap-3 rounded-2xl border border-border/50 bg-card/50 px-4 py-4 shadow-[var(--shadow-xs)] sm:flex-row sm:items-start sm:gap-4 sm:px-5 sm:py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.07] text-primary">
                  <BookOpen className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                </div>
                <p className="text-left text-xs text-muted-foreground leading-relaxed sm:pt-0.5">
                  Prefer reading or marking patterns without the walk?{" "}
                  <button
                    type="button"
                    onClick={() => setShelfOpen(true)}
                    className="font-medium text-foreground/95 underline underline-offset-[5px] decoration-primary/35 hover:decoration-primary"
                  >
                    Open the reference shelf
                  </button>
                  .
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border/45 bg-card/40 shadow-[var(--shadow-md)] ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
                <div
                  className="h-0.5 bg-gradient-to-r from-primary/45 via-primary/15 to-transparent"
                  aria-hidden
                />
                <button
                  type="button"
                  onClick={() => setShelfOpen((o) => !o)}
                  aria-expanded={shelfOpen}
                  data-testid="field-notes-shelf-toggle"
                  className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/25 md:px-5 md:py-5"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/45 bg-primary/[0.06] text-primary">
                    <BookMarked className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] tracking-[0.2em] uppercase font-medium text-muted-foreground/90">
                      Optional · same device only
                    </p>
                    <p className="font-serif text-lg text-foreground mt-1">
                      Reference shelf
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Pocket strip and short reads—open one pattern at a time.
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
                      shelfOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>

                {shelfOpen ? (
                  <div className="border-t border-border/50 px-4 pb-6 pt-5 md:px-6 space-y-8 fade-in-slow">
                    <div
                      className="rounded-xl border border-border/40 bg-gradient-to-b from-card/55 to-card/25 px-4 py-4 shadow-[var(--shadow-xs)] md:px-5"
                      data-testid="field-notes-progress"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-muted-foreground/90">
                          Patterns in your pocket
                        </p>
                        <span className="font-mono text-xs text-muted-foreground/80 tabular-nums">
                          {touchedCount}/{total}
                        </span>
                      </div>
                      <div
                        className="flex gap-1.5 mb-3"
                        role="list"
                        aria-label="Notes touched"
                      >
                        {FIELD_NOTE_SECTION_KEYS.map((key) => (
                          <button
                            key={key}
                            type="button"
                            role="listitem"
                            aria-label={
                              touches[key]
                                ? `${key}: marked`
                                : `${key}: not marked yet`
                            }
                            aria-pressed={!!touches[key]}
                            onClick={() => toggleTouch(key)}
                            data-testid={`field-note-dot-${key}`}
                            className={`relative h-2.5 flex-1 min-w-[1.75rem] max-w-[4rem] rounded-full transition-all duration-300 ${
                              touches[key]
                                ? "bg-primary/85 shadow-[0_0_0_1px_color-mix(in_srgb,hsl(var(--primary))_35%,transparent)]"
                                : "bg-muted/50 ring-1 ring-inset ring-border/55 hover:bg-muted/70"
                            }`}
                          >
                            <span className="sr-only">
                              Toggle mark for section {key}
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground/75 leading-relaxed">
                        Tap when you have tried a pattern for real. Honesty beats
                        clearing the board.
                      </p>
                    </div>

                    {allTouched ? (
                      <div
                        className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/[0.09] via-primary/[0.04] to-transparent px-4 py-4 shadow-[var(--shadow-xs)] md:px-5 fade-in-slow"
                        data-testid="field-notes-complete"
                      >
                        <p className="font-serif text-base text-foreground leading-snug mb-2">
                          Full hand.
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                          Five patterns noted—carried, not unlocked. Skip any that
                          do not fit your life.
                        </p>
                        <button
                          type="button"
                          onClick={clearAll}
                          data-testid="field-notes-clear"
                          className="text-[11px] text-muted-foreground/80 hover:text-foreground underline underline-offset-4 decoration-border/60 hover:decoration-foreground transition-colors"
                        >
                          Clear markers & walk again
                        </button>
                      </div>
                    ) : null}

                    <div>
                      <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-muted-foreground/85 mb-3 px-1">
                        Pattern notes
                      </p>
                      <Accordion
                        type="single"
                        collapsible
                        className="overflow-hidden rounded-xl border border-border/45 bg-card/25 shadow-[var(--shadow-xs)]"
                      >
                        <ReferencePattern
                          sectionKey="signal-noise"
                          title="Signal vs noise (how Sift uses it)"
                          touched={!!touches["signal-noise"]}
                          onToggleTouch={toggleTouch}
                        >
                          <p>
                            <strong className="text-foreground font-medium">
                              What matters now
                            </strong>{" "}
                            is what deserves attention in this moment—not forever,
                            not morally, just now.
                          </p>
                          <p>
                            <strong className="text-foreground font-medium">
                              What may be noise right now
                            </strong>{" "}
                            is what might be loud or sticky without governing the
                            next move. Naming noise is not dismissal; it is sorting.
                          </p>
                          <p>
                            If both lists feel wrong, say so in a follow-up—that
                            correction is part of the loop.
                          </p>
                        </ReferencePattern>

                        <ReferencePattern
                          sectionKey="micro-move"
                          title="A ten-minute move"
                          touched={!!touches["micro-move"]}
                          onToggleTouch={toggleTouch}
                        >
                          <p>
                            When deciding feels huge, shrink the unit: one action
                            that fits in about ten minutes and has a clear stopping
                            point.
                          </p>
                          <ul className="list-disc pl-5 space-y-2 marker:text-muted-foreground/60">
                            <li>Name the situation in one line.</li>
                            <li>
                              Pick something tiny you would actually do—not the whole
                              fix.
                            </li>
                            <li>
                              Say when and where (even roughly): &quot;after lunch at
                              the desk.&quot;
                            </li>
                          </ul>
                        </ReferencePattern>

                        <ReferencePattern
                          sectionKey="lanes"
                          title="Default plan path · Simple, Safe, Bold"
                          touched={!!touches["lanes"]}
                          onToggleTouch={toggleTouch}
                        >
                          <p>
                            <strong className="text-foreground font-medium">
                              Default plan path
                            </strong>{" "}
                            means you choose the{" "}
                            <em>style</em> of move—not every branch of the decision.
                            Simple, Safe, and Bold are three pre-made lanes; each one
                            implies a different kind of next step (least fuel, gather
                            clarity first, or move inside something reversible).
                          </p>
                          <p>
                            When you cannot pick a concrete step, lane-picking is
                            lighter than inventing the whole plan: you name how you
                            want to move today—not what forever.
                          </p>
                          <ul className="space-y-4 list-none pl-0">
                            <li>
                              <span className="text-foreground font-medium">
                                Simple —{" "}
                              </span>
                              least effort that still counts: bookmark, timer, one
                              note, close the tab cluster.
                            </li>
                            <li>
                              <span className="text-foreground font-medium">
                                Safe —{" "}
                              </span>
                              one meaningful piece of perspective or info before
                              choosing: ask one trusted person, list worst cases and
                              how you would handle them.
                            </li>
                            <li>
                              <span className="text-foreground font-medium">
                                Bold —{" "}
                              </span>
                              forward motion with a reversible boundary: a trial
                              window, a small public line, a dated commitment you can
                              revisit.
                            </li>
                          </ul>
                          <p>
                            Try telling Sift something like &quot;I want a simple /
                            safe / bold move&quot;—or walk it interactively above.
                          </p>
                        </ReferencePattern>

                        <ReferencePattern
                          sectionKey="simmer"
                          title="Let it simmer on purpose"
                          touched={!!touches["simmer"]}
                          onToggleTouch={toggleTouch}
                        >
                          <p>
                            Some decisions are not for today. Structured pause beats
                            vague procrastination: pick a revisit time, allow only
                            one or two allowed actions until then (one conversation,
                            one document read), then calendar the decision moment.
                          </p>
                        </ReferencePattern>

                        <ReferencePattern
                          sectionKey="good-enough"
                          title="Good enough for now"
                          touched={!!touches["good-enough"]}
                          onToggleTouch={toggleTouch}
                        >
                          <p>
                            Satisficing on purpose: define what &quot;good enough for
                            the next seven days&quot; looks like, provisionally
                            choose, schedule a check-in to reassess. The goal is to
                            exit the comparison loop, not to forbid changing your
                            mind.
                          </p>
                        </ReferencePattern>
                      </Accordion>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}

          <div className="mt-14 pt-8 border-t border-border/50">
            <Link href="/">
              <a className="group inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <span className="inline-block transition-transform duration-200 group-hover:-translate-x-0.5">
                  ←
                </span>
                Back to Sift
              </a>
            </Link>
          </div>
        </div>
      </main>
      <Footnote />
    </div>
  );
}
