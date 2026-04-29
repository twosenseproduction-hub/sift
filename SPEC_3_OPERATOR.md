# Section 3: Personal vs Operator Modes — Product Spec

---

## 3.1 Personal vs Operator

### Purpose

Two distinct jobs-to-be-done. Different entry conditions, different questions, different output shapes. Personal helps someone hear themselves; Operator helps someone move something through the world.

**Personal Sift**
- Help a person hear the real emotional, relational, or internal pattern underneath what they are carrying
- Reduce distortion, surface what matters, identify one grounded next step
- Core question: *"What is really going on in me?"*
- Entry: emotional knots, identity tension, relationship confusion, recurring thought loops, moments where the user needs self-clarity more than management

**Operator Sift**
- Help a person working inside active responsibility — projects, decisions, people, pressure, tradeoffs — identify the governing issue
- Separate load-bearing factors from ambient noise, determine the current move
- Core question: *"What is actually shaping this situation, and what is the move?"*
- Entry: project pressure, decision bottlenecks, team/stakeholder friction, conflicting priorities, situations where the user is trying to move something real through the world

### Rules

1. Personal and Operator are mutually exclusive per thread. One thread, one mode.
2. Route to Personal when user is describing inner states, relational patterns, or identity-level confusion.
3. Route to Operator when user frames things as work, projects, org decisions, team dynamics, or strategic moves — even one explicit project reference locks in Operator for that thread.
4. Operator can be activated explicitly by the user within a Personal thread.
5. Personal is the default if no clear signal.

### Data Model Implications

```json
{
  "thread": {
    "mode": "personal | operator",
    "mode_locked": "boolean"
  }
}
```

- `mode` is set at thread creation and persists.
- `mode_locked` prevents accidental switching mid-thread.
- Turn history carries mode context forward in every model call.

### UI Implications

1. **Mode indicator** — subtle label in the thread header showing current mode. Not prominent. One word.
2. **No mode switcher UI element** — users signal mode through what they write, not a toggle. If a user explicitly asks to switch, offer a one-time switch with confirmation: "Switch this thread to Operator mode?"
3. **Personal mode** — softer visual tone in the composer. Calm, minimal. No tags, no labels, no progress indicators.
4. **Operator mode** — slightly more structured card outputs (see 3.4). Thread list shows front-burner state clearly.

### Open Questions

1. Can a thread span both modes in the same session without user explicitly switching? e.g., "I'm frustrated about the project, and honestly I think I'm avoiding it because I'm scared I'm not good enough." — Personal underneath, Operator surface. How should the model handle?
2. Should mode be editable after the fact, or does that break the thread's continuity?
3. Should there be a lightweight "this is Operator mode" indicator visible to the user, or should it be invisible?

### V1 Decision

Personal and Operator are **separate threads**, not modes within a single thread. The user initiates a thread in a mode, and it stays there unless they explicitly open a new thread in the other mode. No in-thread switching in V1.

---

## 3.2 Operator Artifacts

### Purpose

Operator Sift must attach user input to durable objects that persist across sessions. Without objects, Operator becomes disposable analysis — every session requires restating the whole situation. Objects enable continuity, re-entry, and threading that feels like a chief of staff, not a chatbot.

**Four core object types:**

| Object | Definition | Example |
|---|---|---|
| **Project** | Bounded unit of work moving toward an outcome | "Ship new pricing page" |
| **Decision** | A choice that must be made, not just discussed | "Should we gate history behind sign-in?" |
| **Person** | Human actor materially affecting the situation | cofounder, client, contractor, investor |
| **Thread** | The live conversational container; objects are what it refers to | A thread about a project + a decision |

### Rules

1. A thread is the live container; objects are durable entities it refers to.
2. Objects are created, updated, and linked by the Operator model — not manually by the user in V1.
3. A single thread may reference multiple objects (e.g., a Decision about a Person inside a Project).
4. Objects persist when a thread is archived and are re-linked on re-entry.

**Object fields:**

```json
{
  "project": {
    "id": "ulid",
    "title": "string",
    "type": "project",
    "goal": "string",
    "status": "active | paused | closed",
    "deadline": "date | null",
    "owner": "string",
    "stakeholders": ["person_id"],
    "active_threads": ["thread_id"],
    "current_risk": "string | null",
    "current_move": "string | null"
  },
  "decision": {
    "id": "ulid",
    "title": "string",
    "type": "decision",
    "decision_question": "string",
    "options": ["string"],
    "constraints": ["string"],
    "reversible_or_not": "boolean",
    "due_by": "date | null",
    "recommended_next_move": "string | null",
    "status": "open | decided | parked"
  },
  "person": {
    "id": "ulid",
    "name": "string",
    "type": "person",
    "role": "string",
    "relationship_to_user": "string",
    "relevant_threads": ["thread_id"],
    "open_loops": ["string"],
    "sensitivity_level": "high | medium | low",
    "last_material_interaction": "date"
  },
  "thread": {
    "id": "ulid",
    "title": "string",
    "mode": "operator",
    "linked_objects": [
      { "type": "project | decision | person", "id": "ulid" }
    ],
    "state": "open | closing | archived",
    "front_burner_rank": "number | null",
    "last_seen_at": "timestamp",
    "current_move": "string | null",
    "closure_condition": "string | null"
  }
}
```

### Data Model Implications

1. `linked_objects` is an array of typed references — not embedded objects. This keeps threads lightweight.
2. Objects own their state; threads reference them.
3. `front_burner_rank` is set by the throughput engine (3.3), not by the user.
4. Object updates are append-only in V1. No edit history.

### UI Implications

1. **Thread list** — shows thread title and linked object type(s). Clicking opens the thread with its full object context.
2. **Object detail view** — one screen showing the object's state, linked threads, current move, and open loops.
3. **No manual object creation in V1** — the model creates objects from context. Users can edit object fields after creation.
4. **Person linking** — if a user mentions "my cofounder" in multiple threads, the model links to the same Person object.

### Open Questions

1. Should users be able to manually create a Decision or Project before a thread exists, or only through thread context?
2. What happens to objects when a thread is deleted vs archived?
3. How should object deduplication work — e.g., "my cofounder" vs "my co-founder" vs "my business partner" — fuzzy match or explicit merge?
4. Should Objects have an owner (the creating user) and be private, or can they be shared across accounts in a team context?

### V1 Decision

Objects are **created by the model from context** only. No manual creation UI in V1. Users can edit object fields after creation. All objects are private to the creating user. No fuzzy deduplication — the model links to the same object when the user refers to the same entity by name.

---

## 3.3 Operator Throughput Rules

### Purpose

Operator Sift assumes attention is scarce. Too many open threads create false urgency and make it hard to distinguish what's actually moveable from what's emotionally loud. Operator's job is to prevent the user from treating every open loop as equally actionable — and to force narrowing when the front-burner is crowded.

### Rules

**Front-burner cap:**
- Maximum **3 front-burner threads** visible at once.
- If a 4th thread becomes active, a **forced demotion move** fires before any other output.

**Thread qualifies as front-burner when:**
- Materially affects near-term outcomes
- Unlocks or blocks other work
- Has a real timing constraint
- Delay increases cost, confusion, or drift
- User can take a meaningful next move now

**Thread does NOT belong on front-burner when:**
- Cannot move yet (waiting on someone else)
- Speculative and not yet consequential
- Emotionally activating but not decision-relevant
- A "someday" item masquerading as urgency

**Thread buckets (mutually exclusive):**

| State | Meaning | Visible in main list? |
|---|---|---|
| Front burner | Active, moveable now | Yes — top 3 |
| Warm | Important, not today's move | Yes — collapsed or expandable |
| Waiting | Dependent on external response or time | Yes — with wait label |
| Parked | Acknowledged, intentionally inactive | Yes — separate section |
| Archived | Closed unless reactivated | No — separate archive view |

**Sequencing priority order (highest first):**
1. Load-bearing blockers
2. Time-sensitive decisions with real consequence
3. Items that unlock multiple downstream paths
4. Items with irreversible or expensive consequences
5. Everything else

**Demotion move — forced when cap exceeded:**
When user has more than 3 front-burner threads, return:
- The likely true front-burner set (≤3)
- What gets demoted and why
- One immediate sequencing move

Sample demotion language: *"These all matter, but right now you do not have a clarity problem. You have a throughput problem. Which of these changes the others if moved this week?"*

### Data Model Implications

```json
{
  "thread": {
    "front_burner_rank": "number | null",
    "bucket": "front_burner | warm | waiting | parked | archived"
  }
}
```

- `front_burner_rank` is 1, 2, or 3. Rank 1 = top priority.
- Rank is recalculated on every new user input in Operator mode.
- Bucket transitions: any bucket can go to `archived`. Any bucket can go to `front_burner` (if cap allows). Only `front_burner` or `warm` can go to `waiting`.

### UI Implications

1. **Thread list** — primary view shows top 3 front-burner threads, ordered by rank. Warm, waiting, parked shown in collapsible secondary sections.
2. **Demotion notice** — when a thread is demoted, show a brief inline note in the thread list: "Moved to warm — throughput limit reached." One-time display, not persistent.
3. **No manual reordering in V1** — rank is set by the throughput engine, not by drag-and-drop. Users can move a thread to Parked or Archive manually.
4. **Overflow state** — if a 4th thread becomes front-burner-eligible, show the demotion move as a full thread card before the user proceeds.

### Open Questions

1. Does the user need to explicitly approve a demotion, or does it happen silently with an undo option?
2. Should the model explain *why* something was demoted in the demotion move, or just state the fact?
3. If a user manually parks a thread, should it stay parked indefinitely or have a "reconsider after X days" nudge?
4. Does "warm" auto-demote to "parked" after N days of inactivity, or stay warm indefinitely?

### V1 Decision

Demotion is **silent with one undo option** — the demoted thread returns to front-burner for 24 hours if the user clicks "keep it up." After 24 hours, the demotion stands. No auto-demotion from warm to parked in V1.

---

## 3.4 Operator Outcome Presentation

### Purpose

Operator outcomes preserve the Sift discipline of narrowing and sorting rather than dumping a large consultant-style report. Output is concise, actionable, and shaped for re-entry — like a sharp internal operator's notes, not a document you'd send to a board.

The default format is the smallest artifact that creates movement. Escalate from Sift card to memo/brief only when situation complexity genuinely warrants it.

### Rules

**Five artifact types (smallest to most structured):**

**1. Operator Sift card** *(default)*
- What I'm hearing
- What matters now
- What may be noise now
- Current move
- Use when: quick sort needed, situation still forming, no formal artifact needed yet

**2. Decision memo** *(escalate when needed)*
- Decision at hand
- Why it is hard
- Options in play
- Constraints and tradeoffs
- What matters most
- Recommended move
- What to revisit later
- Use when: multiple options exist, user is circling, cost of indecision is rising

**3. Project brief** *(escalate when needed)*
- Objective
- Current reality
- Main risks
- What is not the problem
- Next 1–3 moves
- Open dependencies
- Use when: project scope is fuzzy, user is mixing strategy/execution/emotion, team coordination likely

**4. Stakeholder brief** *(escalate when needed)*
- Who is involved
- What dynamic is shaping progress
- What appears to matter to each side
- What should be addressed directly
- Suggested next conversation or boundary
- Use when: friction with client, collaborator, partner, team member is central

**5. Weekly operator reset** *(recurring synthesis)*
- Front-burner threads
- What moved
- What is blocked
- What should cool down
- This week's current move
- Use when: multiple accumulated threads, reprioritization matters more than new insight

**Presentation rules:**
1. Default to the smallest artifact that creates movement.
2. Never escalate without signal — if a Sift card is sufficient, use a Sift card.
3. Artifacts read like a disciplined internal note — not therapy, not a status report, not a strategy deck.
4. Labels should be functional, not marketing: *Current move / Decision memo / Working brief / Stakeholder read / Weekly reset.*

**Tone benchmarks:**
- Sounds like: sharp founder's chief of staff, internal strategy note, disciplined triage
- Does NOT sound like: therapy notes, productivity app summary, feed-ready content, consultant report

### Data Model Implications

```json
{
  "sift_response": {
    "artifact_type": "sift_card | decision_memo | project_brief | stakeholder_brief | weekly_reset",
    "outcome": {
      "current_move": "string | null",
      "what_matters": ["string"],
      "what_is_noise": ["string"],
      "blocking_factors": ["string"],
      "recommended_next_move": "string | null"
    }
  }
}
```

- `artifact_type` drives how the UI renders the response.
- Decision memo adds: `decision_question`, `options`, `constraints`, `what_to_revisit_later`
- Project brief adds: `objective`, `current_reality`, `risks`, `what_is_not_the_problem`, `open_dependencies`
- Stakeholder brief adds: `person_name`, `dynamic`, `each_side`, `suggested_move`
- Weekly reset adds: `front_burner_summary`, `what_moved`, `what_blocked`, `what_should_cool`

### UI Implications

1. **Card rendering** — each artifact type has a distinct but minimal card layout. Same visual family as Personal mode — sparse, calm, bordered.
2. **No "View full report"** — the artifact IS the output. Never show a truncated version with a click-to-expand.
3. **Decision memo / project brief** — rendered as structured cards with labeled rows, not free-form paragraphs.
4. **Weekly reset** — a separate end-of-week view, not threaded into the main composer. Triggered by user action or weekly nudge.
5. **No export to PDF** — V1. The artifact lives in Sift.

### Open Questions

1. Should weekly reset be a separate view or a synthesized card at the top of the thread list?
2. Can users "pin" an artifact to the top of a thread for re-entry context?
3. Should archived decision memos be linkable from the Decision object, or only accessible through the thread?
4. How should the model handle a situation that starts as a Sift card and then clearly needs a decision memo mid-thread — interrupt with "This looks like a decision. Want me to shape it as a memo?"

### V1 Decision

Artifact type is **model-determined**, not user-selected. The model picks the smallest sufficient format based on input complexity. Weekly reset is **user-triggered** from the thread list, not auto-generated. No in-thread artifact escalation in V1 — if a situation clearly needs a memo, the model shapes it as a very structured Sift card and the user can request the memo format explicitly.