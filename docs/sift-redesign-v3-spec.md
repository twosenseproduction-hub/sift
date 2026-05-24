# Sift — Full Product Spec & Cursor Prompt

> Use this document as your complete reference for rebuilding or extending Sift. The three source HTML files (sift_redesign_v3.html, sift_nextstep_system.html, sift_energy_canvas.html) are the working prototypes. This prompt captures every design decision, interaction, and system so you can implement them in a production codebase.

---

## Product Philosophy

**Sift is a quiet tool for a noisy mind.**

The core loop is three words: **Noise in. Signal out. One next step.**

Users type or speak whatever is tangled in their head — unpolished, incomplete, emotional. Sift separates what actually matters (signal) from what's just mental noise (comparisons, replays, catastrophizing), then gives exactly one actionable next step. Nothing more.

The product's personality is calm, unhurried, and precise. It does not motivate, celebrate, or push. It reflects. Every word in the UI should feel like it was chosen carefully. Silence and white space are features, not failures.

**What Sift is not:** a task manager, a journal, a therapy app, a chatbot. It is a clarity tool.

---

## Design System

### Typography

```
--serif: 'Cormorant Garamond', Georgia, serif
--sans:  'DM Sans', system-ui, sans-serif
```

Google Fonts import:
```
https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap
```

**Rules:**
- All headings, signal text, pull quotes, step text, and date labels use `--serif`
- All UI chrome (nav, labels, buttons, metadata, tags) uses `--sans`
- Primary heading weight: 300 (light). Never bold for serif headings.
- Italic serif is used for: dates, step text, quotes, placeholders, tone-setting copy
- UPPERCASE labels: `font-size: 9–11px`, `letter-spacing: 0.18–0.24em`, weight 400
- Body text line-height: 1.85–1.9
- Signal/headline text line-height: 1.3–1.5

### Color Tokens

```css
:root {
  /* Base */
  --bg:             #f0ebe0;   /* warm cream page background */
  --leaf-dark:      #263d1a;   /* deepest green — panels, dark surfaces */
  --leaf-mid:       #3a5530;   /* mid forest — button hover, accents */
  --leaf-accent:    #628840;   /* section labels, active indicators */
  --sage:           #7a9460;   /* primary interactive color — buttons */
  --mist:           #b8cca0;   /* lighter sage — secondary surfaces */

  /* Text */
  --text-primary:   #2c3d1e;   /* body text, headings */
  --text-secondary: #5a7040;   /* secondary copy, list items */
  --text-muted:     rgba(78,104,50,0.5);  /* hints, placeholders, meta */

  /* Surfaces & Borders */
  --border:         rgba(90,112,60,0.13);
  --border-hover:   rgba(90,112,60,0.26);
  --surface:        rgba(225,218,204,0.55);
  --surface-hover:  rgba(215,208,192,0.70);
}
```

### Spacing & Geometry

- Border radius: `2–3px` (near-flat, never pill-shaped for cards)
- Tags/chips: `border-radius: 100px` (full pill)
- Grid gutters: `40–52px` horizontal padding on main content areas
- Sidebar width: `210–260px`
- Max content width in composer/detail views: `640–720px`
- Buttons: `padding: 10–13px 22–30px`, `border-radius: 2px`

### Surfaces

All panels, sidebars, and nav use frosted glass over the animated background:
```css
background: rgba(238,232,220,0.60);
backdrop-filter: blur(12px);
border: 1px solid var(--border);
```

Never use opaque white surfaces. The background always shows through.

---

## Background System — The Energy Canvas

This is the most distinctive visual feature of Sift. The background is **alive** — it reads the emotional energy of whatever the user is typing and morphs accordingly. It should feel like the canvas is breathing with the user, not reacting to them.

### Architecture

Four `<div class="blob">` elements sit inside a `.bg-canvas` container. Each blob is a `border-radius: 50%` div with a `radial-gradient` background. All transitions are 4s `cubic-bezier(0.4,0,0.2,1)` on width, height, left, top, opacity, and background.

A `.noise-layer` sits above with `mix-blend-mode: multiply`, `opacity: 0.16–0.18`, and a fractalNoise SVG texture at `256px × 256px`. This gives the cream+green aesthetic its grain without darkening.

```css
.blob {
  position: absolute;
  border-radius: 50%;
  transition:
    width 4s cubic-bezier(0.4,0,0.2,1),
    height 4s cubic-bezier(0.4,0,0.2,1),
    left 4s cubic-bezier(0.4,0,0.2,1),
    top 4s cubic-bezier(0.4,0,0.2,1),
    opacity 3.5s ease,
    background 4s ease;
  will-change: transform, opacity;
}
```

Each blob also has a persistent drift keyframe animation (independent per blob, never synced):
- `b0`: 13s primary orb
- `b1`: 9s
- `b2`: 11s
- `b3`: 7s

Scale transforms stay within `0.93–1.10`. Translate drifts within `±5%`.

### The 6 Energy States

States are applied by updating each blob's `width`, `height`, `left`, `top`, `background`, `opacity`, and `animation-duration` via JS.

---

#### BLANK (no text)
Single centered sage orb. The default Sift canvas.
```
bg: #f0ebe0
b0: 75%w × 68%h, left 12.5%, top 20%
    radial: #6b8854 → rgba(107,136,84,0.75) → rgba(107,136,84,0.30) → transparent
    speed: 13s, opacity: 1
b1–b3: hidden (opacity 0, size 0)
```

---

#### TANGLED (complex sentences, "but", "I don't know", uncertainty)
Orb shifts off-center. Two secondary blobs emerge at opposing corners. Medium pace.
```
bg: #eae5d8
b0: 60%w × 55%h, left 18%, top 22%, speed 10s
b1: 38%w × 32%h, left 48%, top 8%, opacity 0.85, speed 9s
b2: 30%w × 26%h, left 4%, top 58%, opacity 0.70, speed 12s
b3: hidden
```

---

#### ANXIOUS (fear, "what if", "can't", urgency, exclamation marks)
Orb contracts and darkens. Three edge blobs pulse at fast independent speeds.
```
bg: #e5dfd4
b0: 48%w × 44%h, left 26%, top 28%, speed 6s  — color: #4a6e38
b1: 36%w × 30%h, left 54%, top 5%, opacity 0.90, speed 5s
b2: 32%w × 28%h, left 8%, top 62%, opacity 0.85, speed 7s
b3: 22%w × 20%h, left 62%, top 65%, opacity 0.75, speed 4.5s
```

---

#### GRIEF (loss, "miss", "gone", "empty", "alone", "never")
Single heavy bloom drops to the lower half. Very slow. Cool deep green. Spare.
```
bg: #e8e3d9
b0: 85%w × 52%h, left 7%, top 46%, speed 22s  — color: #3d5e42
b1: 42%w × 35%h, left 28%, top 14%, opacity 0.50, speed 20s  — faint echo above
b2–b3: hidden
```

---

#### HOPEFUL (want, could, better, "ready", "new", gratitude)
Orb rises and lightens. Warm sage. Expands upward. A secondary soft bloom below.
```
bg: #f5f0e5
b0: 72%w × 70%h, left 14%, top 8%, speed 16s  — color: #88a865
b1: 45%w × 40%h, left 28%, top 55%, opacity 0.60, speed 18s  — soft secondary
b2–b3: hidden
```

---

#### OVERWHELMED (everything, all of, too much, comma-dense sentences)
Four competing blobs at high opacity. Darkened bg. Fastest cycle times.
```
bg: #ddd8ce
b0: 52%w × 48%h, left 24%, top 22%, speed 5.5s  — color: #526840
b1: 44%w × 40%h, left 48%, top 2%,  opacity 0.90, speed 4.5s
b2: 40%w × 36%h, left 0%,  top 52%, opacity 0.88, speed 6.5s
b3: 48%w × 44%h, left 36%, top 60%, opacity 0.92, speed 3.8s
```

---

### Energy Detection (Client-side)

Score five categories by keyword frequency. Pick the dominant one if score ≥ 0.8:

```js
const KEYWORDS = {
  anxious:     ['afraid','scared','fear','anxious','nervous','worry','worried',
                'panic','what if','can\'t','deadline','fail','mistake','regret'],
  grief:       ['miss','missing','lost','gone','empty','alone','lonely','sad',
                'grief','died','death','wish','hurt','broken','numb','hollow'],
  hopeful:     ['better','maybe','could','want','hope','excited','grateful',
                'opportunity','possible','trying','new','fresh','ready'],
  overwhelmed: ['everything','all of','too much','so many','piling','list',
                'tasks','and also','plus','on top','juggling','drowning',
                'falling behind','exhausted'],
  tangled:     ['but','however','although','not sure','don\'t know','confused',
                'uncertain','torn','complicated','i think','i feel','i keep',
                'back and forth','in circles']
};
```

Additional signals:
- `!` marks → add 0.8 to anxious score each
- ALL CAPS words (3+ chars) → add 1.2 to anxious each
- Comma density → add 0.4 to overwhelmed per comma
- Sentence count → add 0.3 to tangled per sentence

Debounce: 400ms after last keystroke. If score < 0.8 and text > 20 chars: default to `tangled`. If text is empty: `blank`.

**Transition timing:** Always 4s. Never instant. The canvas should feel like it notices, not like it reacts.

### Energy Indicator (Nav)

A small dot + word in the nav corner shows the detected state:
```
● tangled
```
Dot and text color match the state's `dotColor`. Fade in on first detection, fade out when blank. `font-size: 11px`, `letter-spacing: 0.18em`, uppercase. The only UI acknowledgment of the reading.

---

## Pages & Views

### Navigation

Fixed top nav, `backdrop-filter: blur(14px)`, `background: rgba(240,235,226,0.82)`.

```
[sift logo]    [Overview | Composer | Library | Patterns]    [energy indicator / version]
```

Logo: Cormorant Garamond, 22px, weight 300, `letter-spacing: 0.08em`
Tabs: pill container, `border-radius: 100px`, active tab `background: rgba(90,112,60,0.14)`
Tab text: 12px, uppercase, `letter-spacing: 0.06em`

---

### Landing / Overview

Bottom-left anchored hero. Large serif headline, subdued subtext, two CTAs.

```
[eyebrow — 11px uppercase]
[headline — clamp(52px, 7.5vw, 94px), Cormorant, weight 300]
  "Noise in.
   Signal out.
   One next step."
   — "Signal out." uses italic + --sage color

[subtext — 15px, weight 300, max-width 390px]
[CTAs — "Begin sifting" (primary btn) + "How it works →" (ghost btn with animated arrow)]
```

**Features strip** — 3-column grid below the fold:
Each cell has: numbered label (`01`, `02`, `03`), serif title ~27px, description 13px.

1. **Capture the tangle** — accept anything unpolished
2. **Receive the signal** — distilled meaning, not summary
3. **One next step** — precise, actionable, nothing extra

**Landing quote** — full width, 100px vertical padding:
```
"Not everything that weighs on you belongs to you.
 Sift helps you find out which is which."
```
`font-family: serif, font-size: clamp(28px, 4vw, 50px), opacity 0.42`

---

### Composer (Home)

**Layout:** 210px sidebar + 1fr main content

**Sidebar:**
- "Today" section → New entry (active dot indicator)
- "Recent" section → list of past entry titles
- Spacer
- Active step widget (appears after user commits to a step — see Next Step System)
- User avatar + name at bottom

**Main composer area:**
```
[date — Cormorant italic, 13px, muted]
[prompt — "What's occupying your mind?" — 34px Cormorant, weight 300]
[composer box]
  [textarea — 15px, line-height 1.85, min-height 175px]
  [toolbar]
    [hint tags — "paste something old" | "use voice"]
    [Sift → button]
```

**Voice recording state:** When "use voice" is tapped:
- Hint tag hides
- Pulsing red dot appears + 5 animated audio bars
- "tap to stop" label
- On stop (or 4s): textarea fills with transcription

**Output section** (appears after Sift button):
Divided into three blocks with `10px uppercase letter-spaced labels`:

1. **Signal** — the distilled truth. Cormorant, 23px, weight 300, dark primary. This is the emotional core of what they said.
2. **Noise** — a list of what to set aside. Each item prefixed with `—`, 13px sans, secondary color.
3. **One next step** — elevated card (see Next Step System below)

---

### Library

**Layout:** 230px filter sidebar + main entry list

**Filter sidebar:**
- Title: "Library" (Cormorant, 24px)
- Filter groups: Time (All time / This week / This month), Theme (Work, Relationships, Direction, Grief, Identity, Decisions), Clarity (Resolved, Open, Returning)
- Chips: `border-radius: 100px`, pill-shaped, active state with subtle green bg

**Entry list:**
Each row is a 3-column grid: `72px date | 1fr content | auto tag`
```
[May 22    [Signal headline — Cormorant 17px]            [Work]
 2026]     [Preview text — 12px, 2 lines clamped]
```
Hover: row slides right 12px, subtle bg tint. Click → opens entry detail.

**Entry detail view** (replaces list, no modal):
```
[← All entries]
[date · tag]
[The tangle label]
[original input text — italic, left-border accent]
[divider]
[Signal / Noise / Next Step — full output format]
```
Back button slides the list back in. Fade-up animation on detail enter.

---

### Patterns

**Layout:** 260px stats sidebar + main content

**Sidebar stats:**
- Total entries, streak (weeks), recurring themes count, signals resolved
- Each stat: large Cormorant number (38–44px), small uppercase label

**Main sections:**

1. **Meta-signal** — what Sift has noticed across all entries. A distilled block with eyebrow "Meta-signal" and large italic serif quote about the user's pattern.

2. **Activity heatmap** — 15-week grid of sessions. `12×12px` cells, `border-radius: 2px`, 4 intensity levels using green opacity ramp (`0.08` to full `--sage`). 7 rows (days), labeled Mon/Wed/Fri. Month labels above.

3. **Recurring themes** — horizontal bar chart using text + thin line:
   ```
   Identity     ────────────────────  9 entries
   Decisions    ─────────────────     7 entries
   Work         ──────────────        6 entries
   ```
   Theme name in Cormorant 22px. Bar is a 1px line with `--leaf-accent` fill. Hover: name slides right 6px.

4. **Signals that keep returning** — cards showing signals that have appeared across multiple entries:
   ```
   [signal text — Cormorant 19px]
   appeared 4×  ·  Mar 3 · Apr 8 · May 12 · May 22
   ```

---

## Next Step System

This is Sift's most intentional UI. The philosophy: **committing to one step should feel like a small ritual, not a checkbox.**

The system has four moments:

---

### Moment 1: The Elevated Card

After the output appears, the next step gets its own framed zone:

```
┌─────────────────────────────────────────────┐
│  ONE NEXT STEP          ·  from this entry  │
├─────────────────────────────────────────────│
│                                             │
│  "Write down what you'd tell a close        │
│   friend if they were in your exact         │
│   position."                                │
│                                             │
├─────────────────────────────────────────────┤   ← animated line draws across on load
│  One small act. You don't         [Commit   │
│  need more than this right now.]   to this] │
└─────────────────────────────────────────────┘
```

The horizontal line between step text and commit row **animates in** — it draws left to right over 1.2s on load, using a gradient (`transparent → --leaf-accent → transparent`). This creates a brief moment of weight before the button is reached.

**On "Commit to this":**
- Button text changes to "Committed ✓", becomes ghost style
- Sidebar active-step widget fades in (see below)
- After 300ms: card expands downward to reveal Micro Steps

---

### Moment 2: Micro Steps (post-commit expansion)

The card grows to reveal a breakdown of the main step. 4 micro steps, each staggered in at 90ms intervals:

```
HOW TO DO IT

○ 1   Find a quiet moment — five minutes is enough
      You don't need to be ready. You just need to begin.

○ 2   Picture them clearly — their face, their situation
      Make it someone specific. Vague kindness is harder to give.

○ 3   Write without editing — let it be honest
      The first sentence is usually the truest one.

○ 4   Read it back as if they wrote it to you
      Notice what you're willing to say to a friend that you won't say to yourself.

0 of 4                                              [Ready to release →]
```

**Micro step marker:** `22×22px` circle, `border: 1px solid rgba(90,112,60,0.2)`, number in serif inside.

**On tap/click:**
- Number disappears
- Circle fills: `border-color: --leaf-accent`, `background: rgba(100,155,80,0.12)`
- `::after` pseudo-element renders a checkmark (8×5px, 1.2px border, rotated −46°)
- Step text fades to `rgba(155,191,133,0.30)`, hint text to `0.15`
- Progress counter updates: "1 of 4", "2 of 4"...
- At "All done": counter turns `--leaf-accent`, "Ready to release →" slides in from the right

**Sidebar progress pips:** 4 × `2px` height bars below the step preview in the sidebar. Each fills with `--leaf-accent` as corresponding micro step is checked.

---

### Moment 3: The Commitment Overlay

Accessed by clicking "Commit" from the overlay scene, or triggered automatically (design decision).

Full-screen panel (`background: rgba(240,235,226,0.97)`):

```
                ONE THING. RIGHT NOW.

    ┌───────────────────────────────────────────────┐
    │                                               │
    │  "Write down what you'd tell a close          │
    │   friend if they were in your exact           │
    │   position."                                  │
    │                                               │
    │              [I carry this]                   │
    │                  not yet                      │
    │                                               │
    └───────────────────────────────────────────────┘
```

The quote is centered, `clamp(28px, 3.8vw, 52px)`, Cormorant italic.
The frame uses corner brackets (14×14px, `--sage` 1px border, only corners visible) rather than a full box border.
"I carry this" — sage green button, cream text.
"not yet" — ghost text link below, returns to composer.

**After "I carry this":**
- Button → "Carried ✓" ghost state
- A check circle + "Carried." / "It lives in your sidebar until you release it." fades in below

---

### Moment 4: The Release Ritual

Three sequential states within the same panel:

**State 0 — Active step**
```
● Carrying since May 22

"Write down what you'd tell a close friend
 if they were in your exact position."

From: The job offer · Work

[Mark as done]  [Release without completing]
```

**State 1 — Reflection**
```
What shifted?

"Write down what you'd tell a close friend..."

[textarea — "A word is enough. Or say nothing — tap Release."]

[Release]  [Nothing yet]
```
Single textarea, no pressure. "Nothing yet" skips the reflection.

**State 2 — Released**
```
[check circle — 48px, 1px --leaf-accent border]

Released.

Your reflection has been saved to the thread.

[optional: reflection quote displayed back]

[See your thread →]
```

---

### The Steps Thread (History)

Accessible from Patterns or the sidebar. A vertical timeline:

```
  ●  May 22, 2026 · carrying                    [Active]
     "Write down what you'd tell a close friend..."


  ◉  May 12 → May 14, 2026                      [Released]
     "List three things you're carrying that aren't yours to carry."

     WHAT SHIFTED
     Two of the three things weren't even mine.


  ◎  Apr 8, 2026                                 [Deferred]
     "Write down the decision you'd make if no one was watching."
```

Left column: a vertical `1px --border` line with dots at each entry.
- Active: filled dot (`--sage`), pulse animation
- Released: outlined dot with `--leaf-accent` border, soft green fill
- Deferred: faint outlined dot

Each entry shows: step text (Cormorant 18px italic), origin entry name, and — if released with reflection — the "What shifted" note in a left-bordered block.

---

## Interaction Principles

1. **Nothing instant.** Every state change has a transition. Minimum 150ms, typical 300–400ms, background changes 3–4s.

2. **One thing at a time.** Pages don't stack. Panels don't stack. The library detail replaces the list; it doesn't open on top of it.

3. **Language is the product.** The copy isn't filler. Signal text, step text, and reflection prompts are as carefully written as the UI. Don't use placeholder copy that sounds like a design mockup.

4. **Ritual, not gamification.** No confetti, no streaks celebrated loudly, no progress bars that feel like a game. The checkmark on a micro step is enough. The period at the end of "Released." is enough.

5. **The background is ambient.** Users should not consciously notice the energy canvas responding. The transition is 4 seconds. It's designed to feel like the room changed, not the app.

6. **Sidebars are quiet.** Everything in the sidebar is secondary to the main content area. Font sizes stay at 12–13px. Colors stay muted. The active step is the loudest element in the sidebar and it's still very quiet.

---

## Component Reference

### Buttons

```css
/* Primary */
.btn-primary {
  background: var(--leaf-mid);
  color: #f0ebe0;
  font-size: 13px; font-weight: 400; letter-spacing: 0.07em;
  padding: 13px 30px; border-radius: 2px; border: none;
}
.btn-primary:hover { background: var(--leaf-dark); }

/* Sift action button */
.sift-btn {
  background: var(--sage);
  color: #f0ebe0;
  font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;
  padding: 10px 22px; border-radius: 2px;
}

/* Ghost */
.btn-ghost {
  background: transparent; border: none;
  color: var(--text-secondary); font-size: 13px; font-weight: 300;
  display: flex; align-items: center; gap: 7px;
}
/* Arrow inside ghost button: translateX(4px) on hover */

/* Commit (in next step card) */
.commit-btn {
  background: var(--sage); color: #f0ebe0;
  font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
  padding: 11px 26px; border-radius: 2px;
}
.commit-btn.committed {
  background: transparent; color: var(--leaf-accent);
  border: 1px solid rgba(90,112,60,0.25); cursor: default;
}
```

### Filter Chips / Tags

```css
.chip {
  display: inline-flex; align-items: center;
  padding: 5px 12px; border: 1px solid var(--border);
  border-radius: 100px; font-size: 12px; font-weight: 300;
  color: var(--text-secondary); cursor: pointer;
  transition: all 0.15s;
}
.chip.active, .chip:hover {
  background: rgba(90,112,60,0.12);
  border-color: var(--border-hover);
  color: var(--text-primary);
}
```

### Signal / Output Blocks

```css
.signal-heading {
  font-size: 10px; letter-spacing: 0.20em; text-transform: uppercase;
  color: var(--leaf-accent); margin-bottom: 10px;
}
.signal-text {
  font-family: var(--serif); font-size: 23px; font-weight: 300;
  line-height: 1.5; color: var(--text-primary);
}
.noise-list li {
  font-size: 13px; font-weight: 300; color: var(--text-secondary);
  line-height: 1.7; display: flex; gap: 12px;
}
.noise-list li::before { content: '—'; color: var(--text-muted); flex-shrink: 0; }
```

### Next Step Card

```css
.next-step-system {
  border: 1px solid rgba(90,112,60,0.20);
  border-radius: 3px; overflow: hidden;
}
.nss-header {
  padding: 14px 24px;
  background: rgba(215,210,196,0.50);
  border-bottom: 1px solid rgba(90,112,60,0.12);
  display: flex; justify-content: space-between;
}
.nss-step-text {
  font-family: var(--serif); font-size: 26px; font-weight: 300; font-style: italic;
  line-height: 1.5; color: var(--text-primary); padding: 28px 28px 28px;
}
```

---

## Sift Output Format

Every entry processed by Sift returns three things — never more, never less:

**Signal** — one to two sentences. The emotional truth behind what was typed. Not a summary. Not a restatement. The thing underneath the tangle that the user probably already knows but hasn't said clearly. Written as "You [verb]..." or a declarative statement about their situation.

Examples:
- "You're not afraid of the decision — you're afraid of what it would say about you if you got it wrong."
- "The distance you feel from him isn't resentment — it's grief for what you hoped it would be."
- "Busyness has become a way to avoid the question, not answer it."

**Noise** — 3–4 bullet items. Specific things mentioned in the tangle that are mental chatter rather than the core issue. Not generic ("overthinking") — specific to what was actually written ("Replaying the conversation from two weeks ago").

**One next step** — exactly one. Concrete, small, doable today. Written in plain language. Often a writing or thinking exercise, not an action item. Should feel like something a wise friend would say.

Examples:
- "Write down what you'd tell a close friend if they were in your exact position."
- "Finish this sentence honestly: 'If I stayed, the real reason would be…'"
- "Block two hours this week with no task attached. See what surfaces."

---

## AI Integration Notes

When integrating the Anthropic API for real Sift processing:

**System prompt:**
```
You are Sift — a quiet, precise tool that helps people find signal in mental noise. 

When given someone's unfiltered thoughts, respond with exactly three sections:

SIGNAL: One to two sentences identifying the emotional truth underneath what they wrote. Not a summary. The thing they're actually dealing with, stated plainly. Write in second person ("You...").

NOISE: Three to four specific items from their text that are mental chatter — replays, comparisons, catastrophizing, things that aren't the core issue. Be specific to what they actually wrote, not generic.

ONE NEXT STEP: Exactly one small, concrete thing they can do today. Often a writing or reflection exercise. Should feel like something a wise, clear-eyed friend would suggest.

Tone: calm, direct, warm without being soft. Never motivational. Never therapy-speak. Never more than what was asked for.
```

**For micro step generation**, pass the main step text and ask for 3–4 sub-actions with a single hint line each. Keep them ordered, small, and human.

**For energy detection**, you can replace the client-side keyword scoring with a lightweight API call that returns one of: `blank`, `tangled`, `anxious`, `grief`, `hopeful`, `overwhelmed`. This gives dramatically better accuracy, especially for mixed emotional states.

---

## File Reference

| File | Contents |
|------|----------|
| `sift_redesign_v3.html` | Full app: Landing, Composer, Library, Patterns pages. Includes the background system, all nav/sidebar/layout patterns. |
| `sift_nextstep_system.html` | Isolated next step system demo with 4 scenes: The Card (with micro steps), Commitment Overlay, Release Ritual, Steps Thread. |
| `sift_energy_canvas.html` | Energy canvas proof of concept. Composer + energy detection + all 6 states with preset samples. |

All three files share the same design system. The nextstep and energy files were built after the main redesign and represent the most refined versions of their respective systems.

---

## Mobile Design

Sift is fundamentally a mobile-first product. The act of offloading mental noise happens on a phone, in a quiet moment. The desktop layout is a convenience; the phone is the primary context.

### Core Flow on Mobile (3 screens)

**Screen 1 — Composer**
- Fixed top bar: `sift` logo left, energy indicator right (dot + state word)
- Large serif prompt: "What's occupying your mind?" ~22px, anchors the screen
- Full-width textarea, dominant element, takes most of the viewport
- Bottom toolbar: italic hint tag left, `SIFT →` button right
- Energy canvas background visible behind everything (pure CSS, zero perf cost)
- No sidebar. No nav tabs visible.

**Screen 2 — Output**
- Same top bar, label swaps to "WHAT SIFT FOUND"
- Single scroll: Signal block → Noise block → Next Step card
- Signal text at ~16px Cormorant serif — readable but not cramped
- Next step card lands at the bottom of the first viewport — the thing you leave with
- "Commit →" button inside the card

**Screen 3 — Commit ritual**
- Full-screen centered layout, feels like a lock screen moment
- Corner-bracket frame around the step text
- "ONE THING. RIGHT NOW." eyebrow in tiny uppercase
- Large italic serif quote centered
- "I CARRY THIS" button, wide, centered
- "not yet" ghost link below
- After committing: "Carrying now" widget fades in at the bottom — step text + 4 empty progress pips

### Navigation on Mobile

The desktop uses a top tab bar (Overview · Composer · Library · Patterns). On mobile:

**Option A — Bottom tab bar (recommended)**
```
[Compose]  [Library]  [Patterns]  [Steps]
```
4 tabs, icon + label, standard iOS/Android pattern. Composer is the default/home tab.

**Option B — Sheet navigation**
A minimal top bar with just `sift` logo and a `≡` menu icon. Tap opens a bottom sheet with nav options. Keeps the composer screen completely clean.

The energy indicator (dot + word) always lives in the top-right of the nav bar regardless of navigation pattern.

### Layout Adaptations by Screen

**Composer** — translates directly. Single-column, full-width textarea, no changes needed.

**Output** — translates directly. Signal → Noise → Next Step stacks naturally in a single scroll.

**Next Step Card** — ideal on mobile. Micro steps are full-width tap targets. Progress pips are a natural horizontal strip. The commit/release flow is a series of full-screen moments.

**Library** — needs rethinking. The desktop 3-column grid (date · content · tag) compresses to 2 columns on mobile:
```
May 22        [Work]
You're not afraid of the decision…
Preview text truncated to 2 lines…
```
Filters move from a sidebar to a horizontally scrollable chip row above the list.

**Patterns** — the heatmap and theme bars need care. Heatmap: reduce to 8 weeks (fits ~390px at 12px cells + gaps). Theme bars: full-width, works fine. Returning signals cards: full-width, no changes.

**Commitment Overlay** — translates perfectly. Full-screen centered text with corner brackets feels very intentional on a phone.

### Touch Targets

- Minimum tap target: `44×44px`
- Micro step rows: `min-height: 52px`, full-width tap area
- Sift button: full-width on mobile (`width: 100%`) or at minimum `48px` height
- Filter chips: `padding: 8px 16px` on mobile (slightly larger than desktop's `5px 12px`)
- Entry rows in Library: `min-height: 72px`

### Typography at Mobile Scale

| Element | Desktop | Mobile |
|---|---|---|
| Hero prompt | clamp(28px, 3.5vw, 42px) | 22px fixed |
| Signal text | 23px | 16px |
| Step text (card) | 26px | 18px |
| Commit overlay quote | clamp(28px, 3.8vw, 52px) | 22px |
| Body / noise items | 13–15px | 14px |
| Labels (uppercase) | 9–11px | 10px |

### Breakpoint

Single breakpoint at `768px`. Below: mobile layout. Above: desktop layout with sidebar.

```css
@media (max-width: 768px) {
  .home-layout              { grid-template-columns: 1fr; }
  .sidebar                  { display: none; }
  .composer-area            { padding: 24px 20px; }
  .landing-hero             { padding: 0 24px 60px; }
  .features-strip           { grid-template-columns: 1fr; }
  .library-layout           { grid-template-columns: 1fr; }
  .library-filters          { position: static; height: auto; }
  .filter-group             { display: flex; overflow-x: auto; gap: 8px; flex-wrap: nowrap; }
  .patterns-layout          { grid-template-columns: 1fr; }
  .sift-btn, .commit-btn    { width: 100%; text-align: center; }
  .nss-commit-row           { flex-direction: column; gap: 14px; }
  nav                       { padding: 14px 20px; }
}
```