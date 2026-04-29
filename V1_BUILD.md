# Sift V1 — Build Artifacts
# Implementation-ready specs for Personal/Operator routing, data model, throughput, and output templates

---

## 1. Routing: Personal vs Operator

### Entry Detection (first message of new thread)

```
RULE: Route to OPERATOR if any signal fires. Otherwise route to PERSONAL.
Signal fires if the user's message contains:

  A. Explicit project reference
     - Any noun phrase the model can extract as a bounded, named deliverable or outcome
     - "launch X", "ship Y", "build Z", "redo the onboarding"
     - Named project: "Sift pricing page", "the onboarding rewrite"

  B. Decision language
     - "should I", "whether to", "deciding between", "pros and cons"
     - "not sure if X or Y", "trying to choose"

  C. Stakeholder/team language
     - Names of people in org/role context: "my cofounder", "the investors", "the design team"
     - Relationship friction: "they keep pushing back", "she's not aligned"

  D. Structural work language
     - "priority", "deadline", "roadmap", "scope", "timeline", "capacity"
     - "blocked on", "waiting for", "depends on"

  E. Explicit mode request
     - "this is an operator thread", "I want to use operator mode"

IF any signal fires → route to OPERATOR
IF no signal fires → route to PERSONAL (default)
```

### Signal Strength Map

| Signal Type | Strength | Example |
|---|---|---|
| Named project noun | HIGH | "launching the new pricing page next month" |
| Decision verb | HIGH | "I need to decide whether to hire before or after the raise" |
| Stakeholder in work context | HIGH | "my cofounder keeps blocking decisions" |
| Structural work noun | MEDIUM | "the timeline is slipping" |
| Vague urgency | LOW | "I have so much to do" (no specific project) |
| Emotional/introspective language | NONE (routes to Personal) | "I've been feeling off about this" |

### Mid-Thread Mode Lock

```
ON every user message:
  IF thread.mode_locked == true → ignore routing signals, keep current mode
  IF thread.mode_locked == false:
    IF routing_signal_fires == true AND thread.mode == "personal":
      → offer switch: "Looks like you're describing this as work. Want to switch to Operator mode for this thread?"
      → if user says yes → set mode = "operator", mode_locked = true
      → if user says no → keep mode = "personal"
    ELSE → keep current mode

RULE: In V1, Personal and Operator are separate threads. Mode lock prevents accidental in-thread switching.
```

### Thread Creation Schema

```typescript
interface ThreadCreateInput {
  mode: "personal" | "operator";           // set at creation
  mode_locked: boolean;                    // default: false
  title: string;                           // model-generated from first user message
  entry_signal?: "explicit_project" | "decision_language" | "stakeholder" | "structural_work" | "explicit_request" | "none";
}
```

---

## 2. Object Schemas

### 2a. Project

```typescript
interface Project {
  id: string;                              // ULID
  title: string;                            // e.g., "Ship new pricing page"
  type: "project";
  
  // State
  status: "active" | "paused" | "closed";
  
  // Bounding
  goal: string;                            // what "done" looks like
  deadline: string | null;                  // ISO date or null
  owner: string;                           // handle of responsible person
  
  // Links
  stakeholders: string[];                   // person_id[] — people materially involved
  active_threads: string[];                  // thread_id[] — threads about this project
  
  // Operator live state
  current_risk: string | null;              // one sentence: what's threatening the goal
  current_move: string | null;             // one sentence: the single most important next action
  blockers: string[];                       // what's in the way right now
  
  // Metadata
  created_at: string;                       // ISO timestamp
  updated_at: string;                       // ISO timestamp
  created_by: string;                       // user handle
}
```

### 2b. Decision

```typescript
interface Decision {
  id: string;                               // ULID
  title: string;                             // e.g., "Should we gate history behind sign-in?"
  type: "decision";
  
  // Bounding
  decision_question: string;                  // the core question being decided
  options: string[];                         // ["Option A", "Option B", "Defer"]
  constraints: string[];                     // ["budget limited to $X", "must ship before Q2"]
  
  // Resolution
  reversible_or_not: boolean;               // true = low stakes to reverse; false = hard to undo
  due_by: string | null;                     // ISO date or null
  recommended_next_move: string | null;     // one sentence: the sequencing move
  
  // State
  status: "open" | "decided" | "parked";
  decided_option: string | null;             // filled in when status = "decided"
  decided_at: string | null;                 // ISO timestamp
  park_reason: string | null;                // why it was parked (if applicable)
  
  // Links
  linked_threads: string[];                  // thread_id[] — threads about this decision
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;
}
```

### 2c. Person

```typescript
interface Person {
  id: string;                                // ULID
  name: string;                              // e.g., "Jordan Kim"
  type: "person";
  
  // Context
  role: string;                             // e.g., "Co-founder", "Lead Designer", " spouse"
  relationship_to_user: string;               // free text: one sentence
  
  // Operator state
  open_loops: string[];                      // one-line descriptions of unresolved threads involving this person
  sensitivity_level: "high" | "medium" | "low";  // how much care is needed in framing
  
  // Material interactions
  last_material_interaction: string | null;  // ISO date of last meaningful exchange
  interaction_summary: string | null;         // one-sentence read on current dynamic
  
  // Stakeholder mapping
  primary_project: string | null;            // project_id — their main involvement
  involved_threads: string[];               // thread_id[]
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;
}
```

### 2d. Thread

```typescript
interface Thread {
  id: string;                                // ULID
  title: string;                              // model-generated, ≤12 words
  
  // Mode
  mode: "personal" | "operator";
  mode_locked: boolean;                      // true = no mid-thread mode offers
  
  // Routing
  entry_signal: "explicit_project" | "decision_language" | "stakeholder" | "structural_work" | "explicit_request" | "none";
  
  // Objects this thread refers to
  linked_objects: LinkedObjectReference[];
  
  // State
  state: "open" | "closing" | "archived";
  
  // Throughput (Operator only)
  bucket: "front_burner" | "warm" | "waiting" | "parked" | "archived";
  front_burner_rank: number | null;         // 1, 2, or 3 — null if not front_burner
  
  // Live content
  current_move: string | null;               // most recent grounding output (one sentence)
  closure_condition: string | null;           // what "done for now" looks like
  
  // Timestamps
  last_seen_at: string;                      // ISO timestamp — updates on every user message
  created_at: string;
  archived_at: string | null;
  
  // Metadata
  created_by: string;
  sift_count: number;                        // total Sift turns in this thread
}
```

### Linked Object Reference

```typescript
interface LinkedObjectReference {
  type: "project" | "decision" | "person";
  id: string;
  role_in_thread: "primary" | "secondary" | "referenced";  // how central this object is to the thread
}
```

### Object Relationship Diagram

```
Thread (container)
  ├── linked_objects[] ──► Project
  ├── linked_objects[] ──► Decision
  └── linked_objects[] ──► Person

Project
  ├── stakeholders[] ──► Person.id
  └── active_threads[] ──► Thread.id

Decision
  └── linked_threads[] ──► Thread.id

Person
  ├── involved_threads[] ──► Thread.id
  └── primary_project ──► Project.id
```

---

## 3. Thread Priority (Throughput) Logic

### Bucket Assignment Rules

```
ON every Sift response in Operator mode, recalculate bucket:

STEP 1 — Evaluate front-burner eligibility
  A thread qualifies for front_burner if ALL of:
    - Materially affects near-term outcomes (≤2 weeks)
    - User can take a meaningful next move NOW
    - Delay increases cost, confusion, or drift
    - NOT waiting on someone else externally
    - NOT speculative / not yet consequential

STEP 2 — Apply cap
  IF eligible_front_burner_count > 3:
    → Force demotion of lowest-priority eligible to "warm"
    → Return demotion move BEFORE normal Sift output

STEP 3 — Assign bucket
  IF qualifies AND front_burner_count < 3:
    → front_burner (assign rank 1–3 by priority order)
  
  IF qualifies BUT cap exceeded:
    → warm
  
  IF waiting_on_external == true:
    → waiting
  
  IF user explicitly parks:
    → parked
  
  IF closed by user action:
    → archived

STEP 4 — Sequencing within front_burner
  Order rank by priority_score DESC:
    priority_score = {
      has_time_constraint × 3
      + blocks_downstream × 2
      + irreversible_cost × 2
      + unlocks_multiple × 1
      + user_can_move_now × 1
    }
  
  Rank 1 = highest score. Assign ranks 1, 2, 3.
```

### Bucket Definitions and Transitions

| Bucket | Definition | Visible | Transitions |
|---|---|---|---|
| `front_burner` | Active, moveable now. Top 3 only. | Thread list — top | → warm (demoted) → waiting → parked → archived |
| `warm` | Important, not today's move | Thread list — collapsed section | → front_burner (promoted) → waiting → parked → archived |
| `waiting` | Externally dependent, cannot move yet | Thread list — with wait label | → front_burner (external resolves) → parked → archived |
| `parked` | User acknowledged, intentionally inactive | Thread list — separate section | → front_burner (user unparked) → archived |
| `archived` | Closed, not deleted | Archive view only | → front_burner (reactivated) |

### Demotion Move

Fires when a 4th thread becomes front_burner-eligible OR when a new Sift input causes re-evaluation that exceeds the cap.

```
DEMOTION MOVE (fires before normal output):

Format:
  "These all matter, but they do not all belong on the front burner right now.
   [Thread X] is being moved to warm — it can wait.
   [Thread Y] is being moved to warm — it cannot move until [condition].
   
   Which thread changes the others most if you move it this week?"

Output as a structured note card, NOT a full Sift card.
No mirror. No signal/noise. Just the sequencing observation.
```

### Front-Burner Criteria Checklist

```
For each open Operator thread, score 1 if TRUE:

  [ ] Materially affects outcomes in ≤2 weeks
  [ ] User can take a meaningful next move NOW
  [ ] Delay increases cost, confusion, or drift
  [ ] NOT waiting on external person/event
  [ ] NOT speculative

Score 0–5. Threads with score ≥3 are front_burner-eligible.
If >3 eligible, demote lowest-priority by sequencing order.
```

---

## 4. Output Templates

### 4a. Operator Sift Card (default)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT I'M HEARING
[One sentence. Sift-level mirror. No advice.]

WHAT MATTERS NOW
• [Bullet 1 — the central factor]
• [Bullet 2 — the load-bearing constraint or dynamic]
• [Bullet 3 — if applicable, or omit]

WHAT MAY BE NOISE RIGHT NOW
• [Bullet 1 — what sounds urgent but isn't central]
• [Bullet 2 — what feels heavy but isn't actually blocking]

CURRENT MOVE
[One sentence. The single most important action the user can take right now,
or the sequencing move that would unblock everything else.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**When to use:** Quick sort needed. Situation still forming. No formal artifact needed.

---

### 4b. Decision Memo

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DECISION MEMO
[Decision question — the choice in one line]

WHY IT'S HARD
[2–3 sentences. What's making this hard to resolve.]

OPTIONS IN PLAY
  A. [Option A — one sentence]
  B. [Option B — one sentence]
  C. [Option C — one sentence, or omit]

CONSTRAINTS AND TRADEOFFS
  • [Constraint 1]
  • [Constraint 2]

WHAT MATTERS MOST
[One sentence. The deciding factor if all else is equal.]

RECOMMENDED MOVE
[One sentence. The immediate next action toward deciding — not the decision itself.]

WHAT TO REVIST LATER
• [What information would change your mind]
• [What condition, if met, reopens this]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**When to use:** User is circling between options. Cost of indecision is rising. Multiple viable paths.

---

### 4c. Project Brief

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECT BRIEF
[Project title]

OBJECTIVE
[One sentence. What "done" looks like.]

CURRENT REALITY
[2–3 sentences. Where things actually are right now, including what's going sideways.]

MAIN RISKS
  • [Risk 1]
  • [Risk 2]

WHAT IS NOT THE PROBLEM
[1–2 sentences. What the user keeps circling that isn't actually blocking progress.]

NEXT MOVES
  1. [Immediate — today or tomorrow]
  2. [This week]
  3. [If time allows]

OPEN DEPENDENCIES
  • [Dependency 1 — external blocker or waiting item]
  • [Dependency 2]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**When to use:** Project scope is fuzzy. User is mixing strategy, execution, and emotion. Team coordination is involved.

---

### 4d. Stakeholder Brief

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STAKEHOLDER BRIEF
[Person name] — [Role]

RELATIONSHIP TO USER
[One sentence.]

WHAT'S ACTUALLY SHAPING THE DYNAMIC
[2–3 sentences. The real tension or alignment underneath the surface behavior.]

WHAT APPEARS TO MATTER TO EACH SIDE
  User: [one sentence]
  Them: [one sentence]

WHAT SHOULD BE ADDRESSED DIRECTLY
[One sentence. The thing that, if said plainly, would most change the dynamic.]

SUGGESTED NEXT MOVE
[One sentence. A concrete action — a conversation, a boundary, a request, or a decision.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**When to use:** Friction with a specific person is central to the thread. Team or org dynamics are blocking progress.

---

### 4e. Weekly Operator Reset

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEEKLY RESET
Week of [date]

FRONT BURNER
  1. [Thread title] — current move: [one sentence]
  2. [Thread title] — current move: [one sentence]
  3. [Thread title] — current move: [one sentence]

WHAT MOVED THIS WEEK
  ✓ [Thread title]: [what happened — one sentence each]
  ✓ [Thread title]: [what happened]

WHAT'S BLOCKED
  🔒 [Thread title]: blocked by [external dependency]
  🔒 [Thread title]: waiting on [person or condition]

WHAT SHOULD COOL DOWN
  → [Thread title]: [reason to deprioritize — one sentence]

THIS WEEK'S CURRENT MOVE
[One sentence. The single most important action across all threads.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**When to use:** User-triggered synthesis at end of week. Multiple accumulated threads need reprioritization. NOT auto-generated.

---

## 5. Object Creation Rules

### When the model creates an object

```
ON every Operator Sift response, the model MAY create or update objects:

  CREATE Project IF:
    - User describes a bounded, named deliverable or outcome
    - "launch X", "ship Y", "build toward Z"
    - No existing Project with similar title exists in linked_objects of this thread

  CREATE Decision IF:
    - User frames the thread around a choice
    - "should I", "whether to", "trying to decide"
    - No existing Decision with similar question exists in linked_objects of this thread

  CREATE Person IF:
    - User names a specific human as materially involved in the situation
    - "my cofounder", "the client", "Jordan"
    - No existing Person with same name exists in linked_objects of this thread

  UPDATE Thread.linked_objects IF:
    - New object referenced that isn't yet linked
    - Existing object's current_move or status has materially changed

RULE: Objects are created from context, not from user command. Users can edit object fields after creation.
RULE: No object deletion in V1 — only archival.
```

### Object Deduplication (V1)

```
V1 rule: No fuzzy match deduplication.
If the model creates "Jordan Kim" in one thread and later says "my cofounder Jordan",
the model links to the same Person object by explicit name match.
If user has manually created a Person object, model links by name match.
```

---

## 6. Thread Lifecycle State Machine

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
    CREATE ──► OPEN ◄──────────────────────────────┐        │
                    │                               │        │
                    │  ┌──────┐   ┌──────┐   ┌──────┐  │        │
        user parks │  │ warm  │   │waiting│   │ front │  │        │
        ┌──────────┼─►│       │   │      │   │burner │  │        │
        │           │  └──────┘   └──────┘   │ (1-3) │  │        │
        │           │                           │      │  │        │
        │           └───────────────────────────┼──────┼──┘        │
        │                                       │      │             │
        │  ┌───────────────────────────────────┘      │             │
        │  │          front_burner cap exceeded        │             │
        │  └──────────────────────────────────────────┘             │
        │                                                            │
        │  user closes   user archives   user unpparks   external    │
        ▼  or no move    manually       explicitly      resolves     │
    ARCHIVED ◄──────────────────────────────────────────────────────► OPEN
    (read-only)                                                     (reactivated)
```

### State Transitions

```
OPEN → WARM:      user parks, OR front_burner cap exceeded
OPEN → WAITING:   model detects external dependency
OPEN → FRONT_BURNER: qualifies + cap not full
WARM → FRONT_BURNER: qualifies + cap opens
WARM → WAITING:    external dependency appears
WARM → PARKED:    user parks explicitly
WARM → ARCHIVED:   user closes
WAITING → FRONT_BURNER: external dependency resolves
WAITING → PARKED: user parks
WAITING → ARCHIVED: user closes
PARKED → FRONT_BURNER: user unpins explicitly
PARKED → ARCHIVED: user closes
ARCHIVED → OPEN:   user reactivates (from any bucket, same transition)
```

---

## 7. Closure and Re-Entry Rules

### Thread Closure Condition

```
Every Operator thread should have a closure_condition set when the thread is created.

RULE: The model sets closure_condition = "done for now" by default unless
it can name a specific observable condition that marks real closure.

Examples of specific closure conditions:
  - "Decision is made and communicated to the team"
  - "Jordan has confirmed the timeline in writing"
  - "Launch is shipped and initial feedback is collected"
  - "Conversation with cofounder has happened and agreement is documented"

"Done for now" is acceptable when:
  - No specific next checkpoint is knowable
  - The thread has surfaced its key pattern and the user has the next move
  - The thread is emotionally resolved but not action-resolved
```

### Re-Entry Rules

```
ON user returns to an archived thread:
  IF closure_condition == "done for now":
    → offer: "This thread was parked as done. Want to reactivate it or close it for good?"
  
  IF closure_condition != "done for now":
    → check if closure_condition is met:
      IF met → suggest closure: "Looks like [condition] happened. Close this thread?"
      IF NOT met → reactivate as same bucket and state: "Picking this back up."
  
  IF user explicitly says "resume [thread]":
    → reactivate to same bucket
    → prepend: "Back to [thread title]. You left off at: [last current_move]"
```

### Reactivation Rules

```
A closed issue becomes a new thread when:
  - The same underlying situation resurfaces
  - User explicitly says "resume [archived thread]"
  - A new Sift is initiated with an input that clearly refers to the old thread

RULE: Revive only when the issue is truly the same, not just the same topic.
A decision being reopened after a new constraint appears = same thread.
A decision about a similar-but-different topic = new thread.
```