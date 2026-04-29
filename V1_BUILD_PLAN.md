# V1 Build Order — Personal/Operator + Thread State

## Summary

Files changed: 4 core files
- `shared/schema.ts` — schema additions
- `server/storage.ts` — storage layer + new tables
- `server/routes.ts` — routing + new endpoints
- `client/` — UI updates (Home, thread list, thread view)

No new files. No new packages. SQLite only.

---

## Phase 1 — Schema (`shared/schema.ts`)

### Added to `sifts` table (all nullable, added via ALTER):

```
mode              TEXT    -- 'personal' | 'operator'
mode_locked       INTEGER -- 0 | 1
entry_signal      TEXT    -- 'explicit_project' | 'decision_language' | 'stakeholder' | 'structural_work' | 'explicit_request' | 'none'
thread_state      TEXT    -- 'open' | 'closed' | 'archived'  (open=default for new sifts)
front_burner_rank INTEGER -- 1 | 2 | 3 | null
current_move      TEXT    -- one sentence, the pinned next action
closure_condition TEXT    -- one sentence describing what "done for now" looks like
```

### New tables:

```sql
CREATE TABLE projects (
  id           TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL,
  title         TEXT NOT NULL,
  goal          TEXT,
  status        TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'paused' | 'closed'
  deadline      INTEGER,                           -- epoch ms, nullable
  owner         TEXT,                              -- handle string
  current_risk  TEXT,
  current_move  TEXT,
  blockers      TEXT,                              -- JSON string[]
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE decisions (
  id                   TEXT PRIMARY KEY,
  user_id              INTEGER NOT NULL,
  title                TEXT NOT NULL,
  decision_question    TEXT,
  options              TEXT,                        -- JSON string[]
  constraints          TEXT,                        -- JSON string[]
  reversible_or_not    INTEGER NOT NULL DEFAULT 1,  -- 0 | 1
  due_by               INTEGER,                      -- epoch ms, nullable
  recommended_next_move TEXT,
  status               TEXT NOT NULL DEFAULT 'open', -- 'open' | 'decided' | 'parked'
  decided_option       TEXT,
  decided_at           INTEGER,                      -- epoch ms
  park_reason          TEXT,
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);

CREATE TABLE persons (
  id                        TEXT PRIMARY KEY,
  user_id                   INTEGER NOT NULL,
  name                      TEXT NOT NULL,
  role                      TEXT,
  relationship_to_user       TEXT,
  sensitivity_level         TEXT DEFAULT 'medium',  -- 'high' | 'medium' | 'low'
  open_loops                TEXT,                     -- JSON string[]
  last_material_interaction  INTEGER,                -- epoch ms
  interaction_summary       TEXT,
  primary_project           TEXT,                    -- project_id or null
  created_at                INTEGER NOT NULL,
  updated_at                INTEGER NOT NULL
);

CREATE TABLE thread_links (
  thread_id TEXT NOT NULL,
  object_type TEXT NOT NULL,  -- 'project' | 'decision' | 'person'
  object_id   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'secondary',  -- 'primary' | 'secondary' | 'referenced'
  PRIMARY KEY (thread_id, object_type, object_id)
);
```

### Schema types added:

- `SiftMode = 'personal' | 'operator'`
- `EntrySignal = 'explicit_project' | 'decision_language' | 'stakeholder' | 'structural_work' | 'explicit_request' | 'none'`
- `ThreadState = 'open' | 'closed' | 'archived'`
- `ThreadBucket = 'front_burner' | 'warm' | 'waiting' | 'parked' | 'archived'`
- `Project`, `Decision`, `Person`, `ThreadLink` — all row types
- `OperatorObject = { type: 'project' | 'decision' | 'person', id: string, role: string }`

---

## Phase 2 — Storage (`server/storage.ts`)

### New methods on `IStorage` and `DatabaseStorage`:

```typescript
// Thread query
listThreadsByUser(userId: number, state?: ThreadState, bucket?: ThreadBucket): Promise<ThreadListItem[]>
getThread(id: string): Promise<Sift | undefined>
updateThreadState(id: string, userId: number, patch: { thread_state?: ThreadState, bucket?: ThreadBucket, front_burner_rank?: number | null, current_move?: string, closure_condition?: string }): Promise<SiftListItem | undefined>
reopenThread(id: string, userId: number): Promise<Sift | undefined>

// Projects
createProject(p: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project>
getProject(id: string): Promise<Project | undefined>
listProjectsByUser(userId: number): Promise<Project[]>
updateProject(id: string, userId: number, patch: Partial<Project>): Promise<Project | undefined>

// Decisions
createDecision(d: Omit<Decision, 'id' | 'created_at' | 'updated_at'>): Promise<Decision>
getDecision(id: string): Promise<Decision | undefined>
listDecisionsByUser(userId: number): Promise<Decision[]>
updateDecision(id: string, userId: number, patch: Partial<Decision>): Promise<Decision | undefined>

// Persons
createPerson(p: Omit<Person, 'id' | 'created_at' | 'updated_at'>): Promise<Person>
getPerson(id: string): Promise<Person | undefined>
listPersonsByUser(userId: number): Promise<Person[]>
updatePerson(id: string, userId: number, patch: Partial<Person>): Promise<Person | undefined>

// Thread links
linkObject(threadId: string, object: OperatorObject): Promise<void>
unlinkObject(threadId: string, objectType: string, objectId: string): Promise<void>
getThreadLinks(threadId: string): Promise<ThreadLink[]>
getObjectThreads(objectType: string, objectId: string): Promise<string[]>

// Front-burner cap
countFrontBurner(userId: number): Promise<number>
getFrontBurnerRank(userId: number): Promise<string[]>  // sift IDs ordered by rank
```

### Migration (in `DatabaseStorage` constructor):

Runs on every server start. All additive — no destructive changes.

```typescript
const SIFT_COLS = sqlite.prepare(`PRAGMA table_info(sifts);`).all() as Array<{name: string}>;
addColumnIfMissing('sifts', 'mode',              'TEXT');
addColumnIfMissing('sifts', 'mode_locked',        'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('sifts', 'entry_signal',       'TEXT');
addColumnIfMissing('sifts', 'thread_state',       'TEXT NOT NULL DEFAULT \'open\'');
addColumnIfMissing('sifts', 'front_burner_rank', 'INTEGER');
addColumnIfMissing('sifts', 'current_move',      'TEXT');
addColumnIfMissing('sifts', 'closure_condition','TEXT');

run(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, title TEXT NOT NULL,
    goal TEXT, status TEXT NOT NULL DEFAULT 'active', deadline INTEGER,
    owner TEXT, current_risk TEXT, current_move TEXT, blockers TEXT,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, title TEXT NOT NULL,
    decision_question TEXT, options TEXT, constraints TEXT,
    reversible_or_not INTEGER NOT NULL DEFAULT 1, due_by INTEGER,
    recommended_next_move TEXT, status TEXT NOT NULL DEFAULT 'open',
    decided_option TEXT, decided_at INTEGER, park_reason TEXT,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS persons (
    id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT NOT NULL,
    role TEXT, relationship_to_user TEXT, sensitivity_level TEXT DEFAULT 'medium',
    open_loops TEXT, last_material_interaction INTEGER, interaction_summary TEXT,
    primary_project TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS thread_links (
    thread_id TEXT NOT NULL, object_type TEXT NOT NULL,
    object_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'secondary',
    PRIMARY KEY (thread_id, object_type, object_id)
  );
  CREATE INDEX IF NOT EXISTS idx_projects_user   ON projects(user_id);
  CREATE INDEX IF NOT EXISTS idx_decisions_user ON decisions(user_id);
  CREATE INDEX IF NOT EXISTS idx_persons_user   ON persons(user_id);
  CREATE INDEX IF NOT EXISTS idx_thread_links_thread ON thread_links(thread_id);
`);
```

---

## Phase 3 — Routing Logic (`server/routes.ts`)

### Mode detection function (in `routes.ts`, before server setup):

```typescript
type EntrySignal = 'explicit_project' | 'decision_language' | 'stakeholder' | 'structural_work' | 'explicit_request' | 'none';

function detectMode(input: string): { mode: 'personal' | 'operator'; signal: EntrySignal } {
  const lower = input.toLowerCase();
  const signals: Array<{ key: EntrySignal; test: RegExp }> = [
    { key: 'explicit_project',    test: /\b(ship|launch|build|redo|hiring|product|roadmap|mvp|deploy|release)\b/i },
    { key: 'decision_language',   test: /\b(should i|whether to|pros and cons|deciding between|not sure if|choosing|option a|option b)\b/i },
    { key: 'stakeholder',         test: /\b(cofounder|founder|investor|team|client|partner|board|co-worker|manager|designer|engineer)\b/i },
    { key: 'structural_work',      test: /\b(priority|deadline|scope|timeline|capacity|blocked|waiting on|depends on|quarter|budget|headcount)\b/i },
    { key: 'explicit_request',    test: /\b(operator mode|work mode|project mode)\b/i },
  ];

  for (const s of signals) {
    if (s.test.test(lower)) return { mode: 'operator', signal: s.key };
  }
  return { mode: 'personal', signal: 'none' };
}
```

### Apply at `/api/sift` creation (POST):

```typescript
// After auth, before db.insert:
const { mode, signal } = detectMode(parsed.data.input);
const sift = await storage.createSift({
  ...row,
  mode,           // new field
  mode_locked: false,
  entry_signal: signal,
  thread_state: 'open',
  front_burner_rank: null,
  current_move: null,
  closure_condition: null,
});
```

### Bucket assignment at sift creation:

```typescript
// After createSift:
const fbCount = await storage.countFrontBurner(userId);
if (fbCount < 3) {
  const rank = fbCount + 1;
  await storage.updateThreadState(sift.id, userId, { front_burner_rank: rank });
}
```

---

## Phase 4 — API Routes (`server/routes.ts`)

### New routes (all `requireAuth`):

```
GET  /api/threads               ?state=open|closed|archived&q=      list user's threads
GET  /api/threads/:id            full thread with linked objects
PATCH /api/threads/:id           update state/bucket/current_move/closure_condition
POST /api/threads/:id/reopen     set state=open, re-rank front_burner

GET  /api/objects               ?type=project|decision|person        list all operator objects
GET  /api/objects/:type/:id     single object
POST /api/objects/:type          create project|decision|person
PATCH /api/objects/:type/:id     update project|decision|person

POST /api/threads/:id/link      { type, id, role }   add object link
DELETE /api/threads/:id/link     { type, id }         remove object link
```

### Thread list response shape:

```typescript
type ThreadListItem = {
  id: string;
  createdAt: number;
  coreIntent: string;
  nextStep: string;
  status: 'open' | 'closed';
  mode: 'personal' | 'operator';
  thread_state: 'open' | 'closed' | 'archived';
  bucket: 'front_burner' | 'warm' | 'waiting' | 'parked' | 'archived';
  front_burner_rank: number | null;
  current_move: string | null;
  closure_condition: string | null;
  linked_objects: OperatorObject[];
  sift_count: number;  // turn count in thread
};
```

---

## Phase 5 — Front-burner Cap Logic

### On every thread update (PATCH /api/threads/:id):

```typescript
async function assignBucket(siftId: string, userId: number, newBucket: ThreadBucket): Promise<{ demotion?: { demoted_id: string; reason: string; move: string } }> {
  if (newBucket === 'front_burner') {
    const count = await storage.countFrontBurner(userId);
    if (count >= 3) {
      // Demote lowest-ranked front-burner thread
      const ranked = await storage.getFrontBurnerRank(userId);
      const demoted = ranked[ranked.length - 1]; // lowest rank (3)
      await storage.updateThreadState(demoted, userId, { bucket: 'warm', front_burner_rank: null });
      return {
        demotion: {
          demoted_id: demoted,
          reason: 'Thread cap exceeded — only 3 threads can be front-burner at once.',
          move: 'Pick the one that changes the others most if moved this week.',
        }
      };
    }
  }
  return {};
}
```

---

## Phase 6 — Analyze Flow Updates

### Operator system prompt addition (extend existing SYSTEM_PROMPT):

```typescript
const OPERATOR_ADDITION = `
MODE: OPERATOR — you are helping a person inside active responsibility. Be concrete, precise, situational. Use neutral framing ("this situation", "what's blocking", "the sequencing") before defaulting to "you". Name the load-bearing constraint first. One concrete next step. No reassurance language.
`;
```

### In `/api/sift` POST handler — pass mode to model:

```typescript
// Build context object for the model
const systemPrompt = mode === 'operator'
  ? SYSTEM_PROMPT + OPERATOR_ADDITION
  : SYSTEM_PROMPT;

// In the analyze call, also include:
{ ...payload, mode }
```

### Operator output extensions (returned in API response):

```typescript
type OperatorExtensions = {
  current_move: string | null;
  linked_object_ids: string[];
  decision_question: string | null;
  front_burner_rank: number | null;
  bucket: ThreadBucket | null;
};
```

---

## Phase 7 — Client UI Updates

### Files changed:
- `client/src/pages/home.tsx` — thread list with state, bucket, current_move
- `client/src/components/composer.tsx` — mode indicator ("Personal" / "Operator")
- `client/src/lib/api.ts` — new API calls for threads and objects

### Thread list item shows:
- Mode badge (Personal / Operator) — small, subtle
- Bucket indicator for operator threads
- `current_move` preview line (last 50 chars + "…")
- State: "Open · front-burner" / "Warm" / "Waiting" / "Parked" / "Archived"
- "Reopen" action on archived threads

### Composer shows:
- Mode label in top-right corner of the input area (not loud, small gray label)
- In Personal: "What are you holding right now?"
- In Operator: "What's on your mind?" or "What's the situation?"

---

## Migration Notes

All migrations are additive (ADD COLUMN only). No column drops, no row deletions.

Run on every server start via `DatabaseStorage` constructor — idempotent (`CREATE TABLE IF NOT EXISTS`, `addColumnIfMissing` helper).

No manual migration steps required. Deploy includes auto-migration.

---

## Blockers / Assumptions

1. **DB is on Fly persistent volume** — `/data/sift.db`. Local dev uses `./data.db`. Do not change `DB_PATH`.
2. **No new npm packages** — using existing `better-sqlite3` + `drizzle-orm`.
3. **Mode is set at creation only in V1** — no mid-thread mode switching (mode_locked=true from the start).
4. **Operator objects are not auto-created** — model mentions a project name but no explicit object is made. User or future flow creates them.
5. **No auth change** — existing `requireAuth` middleware works as-is.
6. **Front-burner ranking is sequential** — if 3 threads are ranked 1/2/3 and one is demoted, the remaining two keep their ranks (no re-sequence).
7. **Archive = soft delete for UI** — threads in `archived` state are hidden from main list but retrievable via `?state=archived`.
8. **No LLM-level changes to prompts** — routing and output shape changes only. Personal Sift and Operator Sift share the same canonical card format in V1; artifact escalation (decision memo, project brief) is post-V1.
9. **No UI for creating operator objects manually** — linking is automatic at thread level. Object management UI is post-V1.
10. **No delete on operator objects** — only status changes (active → paused → closed). Hard delete is post-V1.