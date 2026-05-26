import { Content, Reveal, Section } from "@/pages/landing-shared";

const LIBRARY_ENTRIES = [
  { title: "Fear of failing the launch", tag: "Work", next: "Name the smallest proof-of-life task" },
  { title: "Conversation I keep rehearsing", tag: "Relationships", next: "Send a time proposal, not the script" },
  { title: "Too many options for this month", tag: "Decisions", next: "Pick one path to test for two weeks" },
];

const THEMES = [
  { name: "Avoidance loops", count: 4 },
  { name: "Load-bearing decisions", count: 3 },
  { name: "Identity pressure", count: 2 },
];

export function LandingOutcomesSection() {
  return (
    <Section id="outcomes">
      <Content>
        <Reveal>
          <p className="mb-4 text-center text-[12px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
            Over time
          </p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mx-auto m-0 mb-12 max-w-[16ch] text-center font-serif text-[clamp(2.2rem,4.2vw,3.6rem)] leading-[0.95] tracking-[-0.05em]">
            Clarity compounds.
          </h2>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-3">
          <Reveal delay={120}>
            <div className="flex h-full flex-col rounded-3xl border border-border/60 bg-card/70 p-6 shadow-[var(--shadow-md)] backdrop-blur-md">
              <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Library
              </p>
              <h3 className="m-0 mb-3 font-serif text-2xl tracking-tight">
                Saved entries stay findable
              </h3>
              <p className="mb-5 text-[15px] leading-relaxed text-muted-foreground">
                Return to what you sorted — titles, next steps, and the thread
                underneath, without restating the whole story.
              </p>
              <div className="mt-auto space-y-2 rounded-2xl border border-border/60 bg-muted/30 p-3">
                {LIBRARY_ENTRIES.map((entry) => (
                  <div
                    key={entry.title}
                    className="rounded-xl border border-border/50 bg-background/60 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="m-0 truncate text-[13px] font-medium text-foreground">
                        {entry.title}
                      </p>
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {entry.tag}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      Next: {entry.next}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="flex h-full flex-col rounded-3xl border border-border/60 bg-card/70 p-6 shadow-[var(--shadow-md)] backdrop-blur-md">
              <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Patterns
              </p>
              <h3 className="m-0 mb-3 font-serif text-2xl tracking-tight">
                Recurring themes emerge
              </h3>
              <p className="mb-5 text-[15px] leading-relaxed text-muted-foreground">
                Sift notices what keeps returning — not as a score, but as a
                quieter read on what your mind circles.
              </p>
              <div className="mt-auto space-y-2">
                {THEMES.map((theme) => (
                  <div
                    key={theme.name}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5"
                  >
                    <span className="text-[13px] text-foreground/90">{theme.name}</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {theme.count}×
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={280}>
            <div className="flex h-full flex-col rounded-3xl border border-border/60 bg-card/70 p-6 shadow-[var(--shadow-md)] backdrop-blur-md">
              <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Meta-signal
              </p>
              <h3 className="m-0 mb-3 font-serif text-2xl tracking-tight">
                Deeper truths show up
              </h3>
              <p className="mb-5 text-[15px] leading-relaxed text-muted-foreground">
                Across entries, a distilled line can surface — what Sift sees in
                you when the same shape keeps appearing.
              </p>
              <div className="mt-auto rounded-2xl border border-primary/15 bg-primary/[0.05] px-4 py-4">
                <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-primary/80">
                  What Sift sees in you
                </p>
                <p className="m-0 font-serif text-[17px] leading-snug text-foreground/90">
                  You often treat uncertainty as a character flaw — when it is
                  usually a sequencing problem waiting for one visible start.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </Content>
    </Section>
  );
}
