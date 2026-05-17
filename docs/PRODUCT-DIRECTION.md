# Sift — Product direction (design-board reset)

**Status:** This document **replaces prior “baseline” wording** and is the north star for what we build next. It is derived from the **approved app concept board** (see asset below).  
**Companion to engineering:** [`AGENTS.md`](../AGENTS.md) still governs voice, safety, schemas, Personal vs Operator, and crisis routing until we explicitly revise it to match shipped UI.

**Visual reference (version in repo):** [`docs/assets/app-direction-board.png`](assets/app-direction-board.png)

---

## 1. North star

**Sift is an AI companion for meaningful conversation, self-discovery, and emotional clarity**—delivered as a **private, low-pressure space** where someone can be real, sort what matters from what is loud, and feel a little lighter.

This is **not therapy** (no clinical role, no diagnosis). It **is** steady presence, good questions, and discernment—aligned with the existing engine: hearing, matter vs noise, patterns over time, and one bounded next step unless we intentionally evolve that contract.

**Design pillars (from board, kept verbatim in spirit):**

| Pillar | Meaning for product |
|--------|----------------------|
| **No judgment. Just presence.** | Tone and UI stay warm and non-performative; no scoring the user. |
| **No pressure. Just progress.** | Small moves, optional depth, anti-dependence (see AGENTS). |
| **No rush. Just you.** | Room-first pacing; voice and text are modalities, not a race. |

**Supporting promises:** Private by design · Journaling + insights · Always evolving (ship in slices, disclose what changes).

**Taglines to steer copy (pick contextually, do not stack):**

- A space to be real.  
- Sort through what matters. Feel a little lighter.  
- Let’s figure it out together.

---

## 2. Look and feel

- **Genre:** Lofi companion — cozy, legible, **pixel-art environments** and avatar(s), not generic “AI gradient.”  
- **Palette:** Warm and grounded — creams, deep greens, browns; enough contrast for accessibility.  
- **Motion:** Subtle (lamp glow, night sky, breathing room); **avatar poses** reflect listening / thinking / speaking (ties to voice and composer state).

---

## 3. Information architecture (target)

**Primary shell:** one **full-screen scene** (the user’s chosen environment) + **avatar** + **conversation** + **composer**. Less “suite of tools,” more **returning to a room**.

**Bottom navigation (target, from board):**

| Tab | Intent |
|-----|--------|
| **Home** | Default room + ongoing thread / check-in. |
| **Journal** | Continuity: entries, threads, reflection over time (maps onto today’s “threads/history” mental model—exact route names TBD). |
| **Discover** | Gentle entry points: prompts, ways in, exercises—**not** an infinite feed. |
| **Profile** | Name, avatar, environment, voice settings, privacy, crisis resources. |

**Top bar:** Sift mark + **menu** (settings, help, sign-in as needed).

Legacy hash routes (`#/threads`, `#/garden`, `#/ways-in`, `#/history`, `#/scene/rooftop`, etc.) **redirect to `#/`** until the new shell ships; deep links to `#/s/:id` (saved sifts and chat) stay.

---

## 4. Onboarding (first-run, from board)

Four sequential steps—**ship as one linear flow** before we add skips for returning users.

1. **Welcome** — Logo; line that Sift is here to **listen, reflect, and help sort what matters**; primary CTA **Let’s begin**.  
2. **Create your space** — **Name** + choice among **six pixel avatar presets** (“pick your vibe”).  
3. **Where would you like to unwind?** — Pick **environment** (see §6). Thumbnail + title per option.  
4. **Anything you’d like me to know?** — Optional free text; CTA **Start our journey** → lands in **Home** with that context in-thread (not a dead form).

**Disclosure:** Short, plain line that Sift is **not a substitute for therapy or crisis care**, with link to resources (aligned with AGENTS crisis posture).

---

## 5. Main chat (Home room)

- **Background:** Full-bleed **pixel scene** (default: **Lofi bedroom** at night—bed, desk, lamp, window, city + stars).  
- **Avatar:** Seated (or standing) on rug/floor; **anchored** visually, not floating UI chrome.  
- **Conversation:** Sift opens with a **settling-in** prompt (e.g. how they’re feeling as they arrive); user messages read as **chat** or transcript blocks—design for **translucent panels** over the scene so the room stays visible.  
- **Input:** Bottom field **Share anything…** + send; supports **voice** affordance where product already has voice.  
- **Keyboard / shortcuts:** Preserve power-user habits where they do not fight the metaphor (e.g. submit shortcut documented in UI).

**Personal vs Operator:** The board emphasizes the **personal companion** path. **Operator mode** (execution, decisions, throughput) remains in the product contract per AGENTS; first implementation can bias **Studio** environment and/or profile toggle so the same shell does not pretend to be two different apps.

---

## 6. Environments (catalog)

Same product, different **backdrop + light ritual**—not five separate apps.

| Environment | Job-to-be-done (from board) |
|-------------|----------------------------|
| **Lofi bedroom** | Default home — cozy, familiar, land and unwind. |
| **Rooftop sanctuary** | Breathe, gain perspective, let go. |
| **Creative studio** | Ideas, expression, creative flow; good for “messy maker” energy. |
| **Library** | Reflect, read, reconnect with wisdom; pairs with **Journal** / patterns. |
| **Doorway** | Transitions, new beginnings, change (internal name *threshold* is the same concept). |

**Asset strategy:** Catalogued art per environment (JSON + variants), similar in spirit to `client/public/scenes/rooftop/`—swap PNG/SVG as final pixel art lands.

---

## 7. Voice conversation mode

- **Layout:** Darker treatment; **avatar center**; **pulsing / circular “listening”** affordance while open mic.  
- **Transcript:** User + Sift lines visible (readable, scrollable).  
- **Control:** Clear **Tap to pause** / end state; same safety and retention rules as typed input.

---

## 8. What does not change (engine spine)

Until we explicitly change AGENTS and schemas:

| Commitment | Notes |
|------------|--------|
| **Crisis & dependence** | High-recall crisis routing; dependence guardrails; no “therapist” positioning. |
| **Discernment shape** | Hear → matter / noise (or equivalent labels) → one next step; longitudinal patterns when data exists. |
| **Privacy posture** | Minimal retention, plain language, delete means delete. |
| **Auth model** | Handle + passphrase unless product decides otherwise. |

---

## 9. Build order (clean slate in *experience*, incremental in *code*)

1. **Onboarding v1** — four screens + persist name / avatar / environment + optional first note.  
2. **Home room v1** — one default **Lofi bedroom** scene + avatar state machine + chat/composer over scene.  
3. **Nav shell** — bottom four tabs wired to real routes (even if Journal/Discover are thin at first).  
4. **Environment switcher** — reuse pattern from rooftop catalog; add bedroom + placeholders for other rooms.  
5. **Voice mode UI** — listening ring + transcript + pause (wire to existing voice pipeline).  
6. **Retire competing “homes”** — single entry; classic composer becomes fallback or dev-only if still needed.

---

## 10. Open decisions (to resolve in design or PM)

- Exact mapping **Journal** ↔ current `threads` / `history` / shared sift views.  
- **Discover** scope vs today’s Ways in + Garden (merge vs sequence).  
- Whether **Operator** enters via environment, mode toggle, or both.

---

*Version: design-board reset. Update when the shipped app matches this shell.*
