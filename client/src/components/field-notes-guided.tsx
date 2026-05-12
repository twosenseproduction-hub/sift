import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type GuidedMethodId = "micro" | "lanes" | "signal";

export type GuidedFinishSectionKey = "micro-move" | "lanes" | "signal-noise";

type Lane = "simple" | "safe" | "bold";

function laneNarrative(lane: Lane, situation: string): string {
  const s = situation.trim() || "this situation";
  switch (lane) {
    case "simple":
      return `You named: "${s}". A simple-lane move spends almost no fuel but still counts. Pick one tiny version: one note with three bullets you already know, a ten-minute timer then stop when it rings, bookmark the thing and step away until tomorrow, or close every tab except one.`;
    case "safe":
      return `You named: "${s}". The safe lane gathers one meaningful piece before you commit—without opening ten tabs. Pick one: one question to someone you trust, fifteen minutes listing worst cases and what you would actually do if each happened, or reading one primary doc—not the whole folder.`;
    case "bold":
      return `You named: "${s}". The bold lane moves before certainty, inside something you can revisit: send the short message, say the sentence out loud to one witness, or block thirty minutes to decide with only the facts you already carry.`;
    default:
      return "";
  }
}

function laneScript(lane: Lane): string {
  switch (lane) {
    case "simple":
      return "I'll keep this alive with one small move today—not solve the whole thing.";
    case "safe":
      return "Before I choose, I'm gathering one clear piece: ___. After that I'll decide or schedule decide.";
    case "bold":
      return "I'm moving forward with ___ as a trial—I'll revisit on ___ if it needs to change.";
    default:
      return "";
  }
}

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div
      className="flex gap-2 justify-center items-center pt-6"
      role="status"
      aria-label={`Step ${step + 1} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2 rounded-full transition-all duration-200 ${
            i === step
              ? "w-6 bg-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.18)]"
              : i < step
                ? "w-2 bg-primary/50"
                : "w-2 bg-muted-foreground/22"
          }`}
        />
      ))}
    </div>
  );
}

interface GuidedWalkthroughProps {
  method: GuidedMethodId;
  onExitToPicker: () => void;
  onComplete: (sectionKey: GuidedFinishSectionKey) => void;
}

export function FieldNotesGuidedWalkthrough({
  method,
  onExitToPicker,
  onComplete,
}: GuidedWalkthroughProps) {
  const [step, setStep] = useState(0);

  const [microSituation, setMicroSituation] = useState("");
  const [microTiny, setMicroTiny] = useState("");
  const [microWhenWhere, setMicroWhenWhere] = useState("");

  const [laneSituation, setLaneSituation] = useState("");
  const [lanePick, setLanePick] = useState<Lane | null>(null);

  const [sigLoud, setSigLoud] = useState("");
  const [sigMatters, setSigMatters] = useState("");
  const [sigNoise, setSigNoise] = useState("");

  const microTotal = 5;
  const lanesTotal = 5;
  const signalTotal = 5;

  const microCanAdvance = useMemo(() => {
    if (method !== "micro") return true;
    if (step === 1) return microSituation.trim().length >= 3;
    if (step === 2) return microTiny.trim().length >= 5;
    if (step === 3) return microWhenWhere.trim().length >= 3;
    return true;
  }, [method, step, microSituation, microTiny, microWhenWhere]);

  const lanesCanAdvance = useMemo(() => {
    if (method !== "lanes") return true;
    if (step === 1) return laneSituation.trim().length >= 3;
    if (step === 2) return lanePick !== null;
    return true;
  }, [method, step, laneSituation, lanePick]);

  const signalCanAdvance = useMemo(() => {
    if (method !== "signal") return true;
    if (step === 1) return sigLoud.trim().length >= 5;
    if (step === 2) return sigMatters.trim().length >= 5;
    if (step === 3) return sigNoise.trim().length >= 5;
    return true;
  }, [method, step, sigLoud, sigMatters, sigNoise]);

  const canAdvance =
    method === "micro"
      ? microCanAdvance
      : method === "lanes"
        ? lanesCanAdvance
        : signalCanAdvance;

  const goBack = () => {
    if (step <= 0) onExitToPicker();
    else setStep((s) => s - 1);
  };

  const goNext = () => {
    if (!canAdvance) return;
    const max =
      method === "micro"
        ? microTotal - 1
        : method === "lanes"
          ? lanesTotal - 1
          : signalTotal - 1;
    if (step >= max) return;
    setStep((s) => s + 1);
  };

  const finish = (key: GuidedFinishSectionKey) => {
    onComplete(key);
    onExitToPicker();
  };

  const shell = (
    title: string,
    body: ReactNode,
    totalSteps: number,
    finishKey: GuidedFinishSectionKey | null,
  ) => (
    <div
      className="rounded-2xl border border-border/45 bg-card/65 shadow-[var(--shadow-lg)] ring-1 ring-primary/[0.08] backdrop-blur-[2px] p-6 md:p-8 fade-in-slow"
      data-testid={`guided-${method}-step-${step}`}
    >
      <div className="flex items-start gap-3 mb-6">
        <button
          type="button"
          onClick={goBack}
          className="mt-0.5 shrink-0 rounded-full border border-border/55 bg-background/60 p-2 text-muted-foreground hover:border-primary/30 hover:bg-muted/35 hover:text-foreground transition-colors"
          aria-label={step <= 0 ? "Leave walkthrough" : "Previous step"}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] tracking-[0.2em] uppercase font-medium text-primary/80 mb-2">
            Guided walk · private
          </p>
          <h2 className="font-serif text-xl md:text-2xl text-foreground leading-snug">
            {title}
          </h2>
        </div>
      </div>

      <div className="space-y-6">{body}</div>

      {step < totalSteps - 1 ? (
        <div className="flex flex-wrap items-center gap-3 mt-8">
          <Button
            type="button"
            onClick={goNext}
            disabled={!canAdvance}
            data-testid="guided-next"
          >
            Next
          </Button>
          <button
            type="button"
            onClick={onExitToPicker}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border/60"
          >
            Leave walkthrough
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          <Button
            type="button"
            onClick={() => finishKey && finish(finishKey)}
            disabled={!finishKey}
            data-testid="guided-finish"
          >
            Save to pocket & exit
          </Button>
          <div>
            <Link href="/">
              <a className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border/60">
                Bring something to Sift
              </a>
            </Link>
          </div>
        </div>
      )}

      <StepDots step={step} total={totalSteps} />
    </div>
  );

  if (method === "micro") {
    const bodies: ReactNode[] = [
      <div key="i0" className="text-sm text-muted-foreground leading-relaxed space-y-3">
        <p>
          You will name what is heavy, choose one tiny move, and anchor when and
          where. Nothing is graded—only clarified.
        </p>
      </div>,
      <div key="i1" className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Situation in one line
        </label>
        <Input
          value={microSituation}
          onChange={(e) => setMicroSituation(e.target.value)}
          placeholder='e.g. "The launch scope keeps ballooning"'
          data-testid="guided-micro-situation"
        />
      </div>,
      <div key="i2" className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          One tiny step you could actually do
        </label>
        <Textarea
          value={microTiny}
          onChange={(e) => setMicroTiny(e.target.value)}
          placeholder="Not the whole fix—one concrete action."
          rows={3}
          data-testid="guided-micro-tiny"
        />
      </div>,
      <div key="i3" className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          When and where (rough is fine)
        </label>
        <Input
          value={microWhenWhere}
          onChange={(e) => setMicroWhenWhere(e.target.value)}
          placeholder='e.g. "Tonight after dishes, phone notes app"'
          data-testid="guided-micro-when"
        />
      </div>,
      <div key="i4" className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <div className="rounded-xl border border-border/55 bg-muted/20 p-4 space-y-3 font-mono text-xs text-foreground/90">
          <p>
            <span className="text-muted-foreground">Situation · </span>
            {microSituation.trim() || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Tiny step · </span>
            {microTiny.trim() || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">When / where · </span>
            {microWhenWhere.trim() || "—"}
          </p>
        </div>
        <p>The move is provisional until you try it—that is enough design work for now.</p>
      </div>,
    ];
    return shell(
      step === 4 ? "Your card" : "Ten-minute move",
      bodies[step],
      microTotal,
      step === microTotal - 1 ? "micro-move" : null,
    );
  }

  if (method === "lanes") {
    const laneBodies: ReactNode[] = [
      <div key="l0" className="text-sm text-muted-foreground leading-relaxed space-y-3">
        <p>
          This is the default plan path: pick Simple, Safe, or Bold—how you want to
          move today—and get one lane-shaped suggestion you can steal or rewrite.
        </p>
      </div>,
      <div key="l1" className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Decision or situation in one line
        </label>
        <Input
          value={laneSituation}
          onChange={(e) => setLaneSituation(e.target.value)}
          placeholder='e.g. "Whether to take the contract"'
          data-testid="guided-lanes-situation"
        />
      </div>,
      <div key="l2" className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground">
          Which lane fits your energy today?
        </p>
        <div className="grid gap-3">
          {(
            [
              ["simple", "Simple", "Least effort that still counts"],
              ["safe", "Safe", "One meaningful gather before choosing"],
              ["bold", "Bold", "Forward motion you can revisit"],
            ] as const
          ).map(([id, label, sub]) => (
            <button
              key={id}
              type="button"
              onClick={() => setLanePick(id)}
              data-testid={`guided-lane-${id}`}
              className={`rounded-xl border px-4 py-4 text-left transition-all shadow-[var(--shadow-xs)] ${
                lanePick === id
                  ? "border-primary/50 bg-primary/10 ring-1 ring-primary/25 shadow-[var(--shadow-sm)]"
                  : "border-border/60 bg-background/40 hover:border-border hover:bg-muted/25 hover:shadow-[var(--shadow-sm)]"
              }`}
            >
              <p className="font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </button>
          ))}
        </div>
      </div>,
      <div key="l3" className="space-y-4">
        {lanePick ? (
          <>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {laneNarrative(lanePick, laneSituation)}
            </p>
            <div className="rounded-xl border border-border/55 bg-muted/20 p-4">
              <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground mb-2">
                Fill-in line
              </p>
              <p className="text-sm text-foreground leading-relaxed font-serif">
                {laneScript(lanePick)}
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Pick a lane to continue.</p>
        )}
      </div>,
      <div key="l4" className="text-sm text-muted-foreground leading-relaxed space-y-3">
        <p>
          You chose a lane—not a life sentence. Change lanes tomorrow if the
          situation shifts.
        </p>
      </div>,
    ];
    return shell(
      step === lanesTotal - 1 ? "Lane held" : "Default plan path",
      laneBodies[step],
      lanesTotal,
      step === lanesTotal - 1 ? "lanes" : null,
    );
  }

  const signalBodies: ReactNode[] = [
    <div key="s0" className="text-sm text-muted-foreground leading-relaxed space-y-3">
      <p>
        Three passes—what is loud, what deserves attention, what might only be
        distortion right now. Your answers stay here unless you bring them to
        Sift.
      </p>
    </div>,
    <div key="s1" className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">
        What is loudest in your head?
      </label>
      <Textarea
        value={sigLoud}
        onChange={(e) => setSigLoud(e.target.value)}
        placeholder="Honest mess is fine."
        rows={4}
        data-testid="guided-signal-loud"
      />
    </div>,
    <div key="s2" className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">
        What deserves attention now?
      </label>
      <Textarea
        value={sigMatters}
        onChange={(e) => setSigMatters(e.target.value)}
        placeholder="Even one sentence."
        rows={3}
        data-testid="guided-signal-matters"
      />
    </div>,
    <div key="s3" className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">
        What might be noise or distortion right now?
      </label>
      <Textarea
        value={sigNoise}
        onChange={(e) => setSigNoise(e.target.value)}
        placeholder="Stories, fears, other people's urgency…"
        rows={3}
        data-testid="guided-signal-noise"
      />
    </div>,
    <div key="s4" className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border/55 bg-muted/15 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Loud
          </p>
          <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {sigLoud.trim() || "—"}
          </p>
        </div>
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
          <p className="text-[10px] uppercase tracking-wider text-primary/80 mb-2">
            Matters now
          </p>
          <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
            {sigMatters.trim() || "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border/55 bg-muted/15 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            May be noise
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {sigNoise.trim() || "—"}
          </p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        If this sorting helped, paste the gist into Sift as your next entry—or
        leave it here as practice.
      </p>
    </div>,
  ];

  return shell(
    step === signalTotal - 1 ? "Your sort" : "Signal vs noise",
    signalBodies[step],
    signalTotal,
    step === signalTotal - 1 ? "signal-noise" : null,
  );
}
