# Sift — Brand guide

A single reference for how Sift should look, sound, and behave in product and marketing. It aligns with the live app (`client/`) and the product spec in `AGENTS.md`.

---

## 1. Essence

**Sift helps people separate signal from noise in what they are holding—emotionally or operationally—and offers one next step.**

- **Not** a venting app, life coach, or generic chatbot.
- **Is** a quiet, structured read that reduces fog and points to a single actionable move.
- The word **shape** is on-brand (patterns, load-bearing tension, what is governing). Avoid therapy-jargon (“parts,” “shadow work”) and hustle-jargon (“unlock,” “optimize,” “crush it”).

---

## 2. Positioning line

Use variations of:

- *Tell what matters from what is only loud.*
- *Clarity without performance.* (The point is a cleaner situation, not a clever performance.)

---

## 3. Two modes of use

| | **Personal** | **Operator** |
|---|----------------|----------------|
| **Job** | Hear the emotional or inner pattern; reduce distortion; one grounded next step. | Name what shapes the situation at work; separate load-bearing factors from noise; name the current move. |
| **Core question** | What is really going on in me? | What is actually shaping this, and what is the move? |
| **Voice default** | **“You”** is natural and warm. | **“You”** is earned—lead with the situation, pattern, or tradeoff; use “you” when it clarifies without sounding accusatory. |
| **When to use** | Emotional knots, identity tension, relationship confusion, loops. | Projects, decisions, stakeholders, sequencing, pressure. |

**Rule:** Personal is for inner clarity; Operator is for moving something through the world. Do not blend the two in a single message.

---

## 4. Voice and copy

### Tone

- Short sentences: roughly **8–25 words**, **1–2 clauses** where possible.
- Plain, physical language (weight, drag, floor, doorway, load-bearing).
- **Direct**, not tentative—use “perhaps” sparingly.
- **Quiet confidence:** spare, human, non-bloated. Avoid sounding like a worksheet or a podcast title.

### Product outputs (canonical labels)

When describing what Sift returns, prefer this vocabulary:

- What I’m hearing  
- What matters now  
- What may be noise now  
- One next step  

**One next step** must be doable in **5–30 minutes**, with a clear completion moment. It is always a **proposal** in a negotiation loop—never framed as a command or a final answer.

### Words and phrases to favor

- Signal / noise / matter / loud  
- Shape, pattern, tension, move, sequence, tradeoff  
- Grounded, narrow, clear, load-bearing  

### Words and phrases to avoid

- Clinical or therapeutic framing (“diagnose,” “your inner child”)  
- Productivity clichés (“unlock potential,” “optimize your mindset”)  
- Empty reassurance (“you got this,” “everything happens for a reason”)  
- Performative insight (“here’s the deeper truth you didn’t know”)  

### Crisis and dependence (product boundary)

- **Crisis:** If content suggests harm to self or others, normal Sift flow stops; surface human-help resources (e.g. 988, Crisis Text Line). No “next step” in that path.
- **Dependence:** Sift clarifies; it does not replace judgment or real conversations. Copy may gently redirect repetition without new information.

---

## 5. Visual identity

### Typography

| Role | Font | Notes |
|------|------|--------|
| **UI / body** | **DM Sans** (`--font-sans`) | Clean, readable; labels, buttons, helper text. |
| **Headlines / reflective lines** | **Instrument Serif** (`--font-serif`) | Editorial weight; use for hero titles, sift titles, emotional emphasis—not for dense tables or tiny UI. |
| **Handles / technical** | **System monospace** (`--font-mono`) | Sparingly (e.g. `@handle`). |

### Color system (semantic)

Tokens live in `client/src/index.css`. Meaning for brand work:

- **Background & surfaces:** Warm paper (light) / slate ink (dark)—calm, not sterile white or pure black.
- **Primary:** Deep teal (**HSL ~186°**)—“introspective, steady.” Same hue family in dark mode, slightly brighter for contrast.
- **Foreground:** Warm near-black (light) / soft cream (dark).
- **Muted:** Secondary text and chrome—never compete with the main message.
- **Destructive:** Reserved for real errors or danger—not for “soft” discouragement.

Light mode is described in code as **warm paper & deep ink**; dark as **slate ink** with the **same teal** staying calm.

### Shape and depth

- **Radius:** ~`0.8125rem` (`--radius`)—rounded but not bubbly.
- **Shadows:** Soft, layered; avoid harsh drop shadows or neon glow (except subtle primary glow on key CTAs where already used).
- **Marketing:** Aurora-style gradients and blurred blobs are **atmosphere**, not decoration overload—one continuous mood across scroll (`landing.tsx`).

### Logo

- **Wordmark:** PNG lockups (`sift-logo-colored.png` / `sift-logo-light.png`) via `Logo` in `client/src/components/brand.tsx`—includes wordmark; do not stack extra “Sift” text beside it.
- **Icon-only:** `LogoMark` SVG for contexts where the wordmark is redundant (inherits `currentColor`).

### Iconography (in-app)

- Prefer **custom stroke SVGs** (hand-inked feel) over emoji or generic stock metaphors for nav and exercises—reuse the same imperfect stroke weight as the rest of the app chrome.
- Keep icons **stroke-first**, slightly imperfect weight—readable at ~16–20px.

### Imagery

- No stock “happy person at laptop” hero clichés on principle.
- Atmosphere comes from **type, color, gradient mesh, and whitespace**—not busy illustration packs.

---

## 6. UX principles

1. **Restraint:** One primary idea per screen region; avoid dashboard density in reflective flows.
2. **Legibility of emotion:** Strong feelings are OK; **copy stays grounded** (name what was said, not a clinical label).
3. **Negotiation, not decree:** Steps are proposals; the user can correct or shrink them.
4. **Privacy posture:** Minimal data, plain language, delete means delete—see product policy in `AGENTS.md` Section 5.3 if you need legal-adjacent messaging.

---

## 7. Marketing vs app

| Surface | Role |
|---------|------|
| **Marketing** (`#/landing`, `#/pricing`) | Explain promise, show motion and examples, route to the app. Still uses the same type and palette. |
| **App** (`#/`, `#/companion`, `#/s/…`) | Deliver the loop—no hypey hero copy inside the composer zone. |

Host-aware CTAs: on `siftnow.io`, primary app links target **`app.siftnow.io`**; elsewhere stay on the current host for previews (`landing.tsx`).

---

## 8. Checklist before shipping copy or UI

- [ ] Mode clear (Personal vs Operator) where it matters  
- [ ] Sentences short; no therapy or hustle clichés  
- [ ] One next step is small, complete-able, and framed as a proposal  
- [ ] Serif for headline poetry; sans for mechanics  
- [ ] Primary teal used with restraint; surfaces stay warm (light) or soft (dark)  
- [ ] Crisis path respected if harm language appears  

---

## 9. File references

| Topic | Location |
|-------|-----------|
| Voice, modes, safety, objects | `AGENTS.md` |
| CSS tokens (colors, fonts, radius) | `client/src/index.css` |
| Landing / marketing layout | `client/src/pages/landing.tsx` |
| Logo components | `client/src/components/brand.tsx` |
| Hand-drawn / stroke UI icons | Co-locate with the feature that owns them (room shell, onboarding)—no shared icon pack requirement. |

---

*Last aligned with the repo layout and tokens as of the guide’s authoring. Update this doc when palette or voice rules change deliberately.*
