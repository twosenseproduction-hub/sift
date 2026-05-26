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
          <p className="landing-eyebrow mb-4 text-center">Over time</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="landing-headline mx-auto m-0 mb-12 max-w-[16ch] text-center text-[clamp(2.2rem,4.2vw,3.6rem)]">
            Clarity compounds.
          </h2>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-3">
          <Reveal delay={120}>
            <div className="landing-panel flex h-full flex-col p-6">
              <p className="landing-eyebrow mb-1">Library</p>
              <h3 className="landing-headline m-0 mb-3 text-2xl tracking-tight">
                Saved entries stay findable
              </h3>
              <p className="landing-lead mb-5 text-[15px]">
                Return to what you sorted — titles, next steps, and the thread
                underneath, without restating the whole story.
              </p>
              <div className="landing-outcomes-mini mt-auto space-y-2 p-3">
                {LIBRARY_ENTRIES.map((entry) => (
                  <div key={entry.title} className="landing-outcomes-row px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="m-0 truncate text-[13px] font-medium text-[var(--v3-text-primary)]">
                        {entry.title}
                      </p>
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-[var(--v3-text-muted)]">
                        {entry.tag}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-[var(--v3-text-muted)]">
                      Next: {entry.next}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="landing-panel flex h-full flex-col p-6">
              <p className="landing-eyebrow mb-1">Patterns</p>
              <h3 className="landing-headline m-0 mb-3 text-2xl tracking-tight">
                Recurring themes emerge
              </h3>
              <p className="landing-lead mb-5 text-[15px]">
                Sift notices what keeps returning — not as a score, but as a
                quieter read on what your mind circles.
              </p>
              <div className="mt-auto space-y-2">
                {THEMES.map((theme) => (
                  <div
                    key={theme.name}
                    className="landing-outcomes-row flex items-center justify-between px-3 py-2.5"
                  >
                    <span className="text-[13px] text-[var(--v3-text-primary)]">{theme.name}</span>
                    <span className="text-[11px] tabular-nums text-[var(--v3-text-muted)]">
                      {theme.count}×
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={280}>
            <div className="landing-panel flex h-full flex-col p-6">
              <p className="landing-eyebrow mb-1">Meta-signal</p>
              <h3 className="landing-headline m-0 mb-3 text-2xl tracking-tight">
                Deeper truths show up
              </h3>
              <p className="landing-lead mb-5 text-[15px]">
                Across entries, a distilled line can surface — what Sift sees in
                you when the same shape keeps appearing.
              </p>
              <div className="landing-outcomes-insight mt-auto px-4 py-4">
                <p className="landing-eyebrow landing-outcomes-insight-label mb-2">
                  What Sift sees in you
                </p>
                <p className="landing-headline m-0 text-[17px] leading-snug">
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
