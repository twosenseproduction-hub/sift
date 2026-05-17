import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---- Users ----
// Email and phone are captured quietly at signup for future reminders /
// reflections / product updates. At least one is required; both are stored
// verbatim (no verification flow in the prototype). Consent is two separate
// opt-ins — both default false — so we can respect whichever channel the user
// actually opted into.
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  handle: text("handle").notNull().unique(),
  passphraseHash: text("passphrase_hash").notNull(),
  email: text("email"),
  phone: text("phone"),
  consentUpdates: integer("consent_updates").notNull().default(0), // 0|1
  consentReflections: integer("consent_reflections").notNull().default(0), // 0|1
  supportProfile: text("support_profile"),
  memoryPreferences: text("memory_preferences"),
  createdAt: integer("created_at").notNull(),
});

export type User = typeof users.$inferSelect;

// ---- Sessions ----
// Bearer tokens persisted to SQLite so sessions survive server restarts/redeploys.
export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull(),
  createdAt: integer("created_at").notNull(),
});
export type Session = typeof sessions.$inferSelect;

// ---- Sifts ----
// A Sift = one "run" of messy thoughts → themes + next step
export const sifts = sqliteTable("sifts", {
  id: text("id").primaryKey(), // short public share id
  userId: integer("user_id"), // nullable: anonymous sifts
  guestSessionId: text("guest_session_id"), // nullable: anonymous browser session before account claim
  createdAt: integer("created_at").notNull(),
  input: text("input").notNull(),
  inputMode: text("input_mode").notNull(), // 'text' | 'voice'
  // JSON-serialized arrays / objects
  themes: text("themes").notNull(), // [{title, summary}]
  coreIntent: text("core_intent").notNull(),
  nextStep: text("next_step").notNull(),
  reflection: text("reflection").notNull(),
  // First-result Signal/Noise framing — populated by the analyze pass on
  // first sift. JSON-serialized string arrays. signalReason is a single
  // sentence naming why the elevated thread may carry consequence.
  // All three are nullable for backward compatibility with rows created
  // before this field existed.
  matters: text("matters"), // JSON string[] | null
  noise: text("noise"), // JSON string[] | null
  signalReason: text("signal_reason"), // string | null
  // Thread status: 'open' = still active, 'closed' = done for now.
  // Defaults to 'open' at insert time.
  status: text("status").notNull().default("open"),

  // ---- V1 thread fields ----
  mode: text("mode"), // 'personal' | 'operator'
  modeLocked: integer("mode_locked").notNull().default(0), // 0|1
  entrySignal: text("entry_signal"), // 'explicit_project'|'decision_language'|'stakeholder'|'structural_work'|'explicit_request'|'none'
  threadState: text("thread_state").notNull().default("open"), // 'open'|'closed'|'archived'
  frontBurnerRank: integer("front_burner_rank"), // 1|2|3|null
  currentMove: text("current_move"), // string|null
  closureCondition: text("closure_condition"), // string|null
  // Phase 3: which Operator artifact this sift represents. Null for
  // Personal sifts (analysisSchema path), and for legacy rows created
  // before Phase 3.
  artifactType: text("artifact_type"), // 'operator_card'|'decision_memo'|'project_brief'|'stakeholder_brief'|null
  // Phase 4: full serialized Operator artifact JSON. Only populated when
  // runOperatorAnalysis succeeds in Operator mode; null otherwise.
  operatorArtifact: text("operator_artifact"),
  // Step scope caption — JSON { durationEstimate, stoppingCondition }
  stepScope: text("step_scope"),
  // Snapshots before each inline correction (PATCH). JSON array.
  revisionHistory: text("revision_history"),
  // First suggested next step at sift creation; unchanged by check-ins.
  baselineNextStep: text("baseline_next_step"),

  // Training layer (internal analytics + quiet UX cues — never scores in UI)
  sortAlignment: real("sort_alignment"),
  recurringSignal: integer("recurring_signal"), // 0|1|null
  recurringTheme: text("recurring_theme"),
  redundancyHintLevel: text("redundancy_hint_level"), // 'low' | null (high not persisted)
  /** Set when low-redundancy sift was created — links to prior sift for re-entry compare */
  redundancyPriorSiftId: text("redundancy_prior_sift_id"),
  closedLoop: integer("closed_loop").notNull().default(0), // 0|1
  closurePromptShown: integer("closure_prompt_shown").notNull().default(0), // 0|1
  /** JSON string[3] — laughably small micro-tasks for "Break it down" */
  microTasks: text("micro_tasks"),
  /** Meta-sift: pattern-level analysis across threads (nullable = false) */
  metaSift: integer("meta_sift"),
  /** UI mode active when the sift was created: 'base' | 'companion' */
  uiMode: text("ui_mode"),
  /** Starting environment active when the sift was created: bedroom/desk/rooftop/library */
  environment: text("environment"),
  /** JSON SiftOnboardingProfile snapshot active when the sift was created */
  supportProfileSnapshot: text("support_profile_snapshot"),
  /** Latest generated Clarity Sheet summary JSON, if user requested one */
  claritySummary: text("clarity_summary"),
  /** 'full' | 'clarity_only' | 'do_not_remember' */
  memoryMode: text("memory_mode").notNull().default("full"),
  /** 0|1 — user-marked important in Library */
  pinned: integer("pinned").notNull().default(0),
  /** Optional transcript expiry timestamp. When elapsed, raw turns are removed. */
  transcriptExpiresAt: integer("transcript_expires_at"),
});

// Rolling discernment metrics per user — server-internal only, no public API.
export const discernmentProfiles = sqliteTable("discernment_profiles", {
  userId: integer("user_id").primaryKey(),
  avgSortAlignment: real("avg_sort_alignment"),
  recurringSignalCount: integer("recurring_signal_count").notNull().default(0),
  masteryCount: integer("mastery_count").notNull().default(0),
  threadClosureRate: real("thread_closure_rate"),
  /** Internal — how often this user used Break Down (tuning signal) */
  breakdownCount: integer("breakdown_count").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});
export type DiscernmentProfileRow = typeof discernmentProfiles.$inferSelect;


// ---- Checkins ----
// A Check-in = user returning to a past sift to log outcome + get adjusted guidance
export const checkins = sqliteTable("checkins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  siftId: text("sift_id").notNull(),
  createdAt: integer("created_at").notNull(),
  status: text("status").notNull(), // 'did_it' | 'did_not' | 'in_progress'
  note: text("note").notNull(), // user's optional context
  // JSON: { hearing, matters: string[], noise: string[], nextStep }
  response: text("response").notNull(),
});
export type Checkin = typeof checkins.$inferSelect;

export const insertSiftSchema = createInsertSchema(sifts).omit({
  createdAt: true,
});

export type InsertSift = z.infer<typeof insertSiftSchema>;
export type Sift = typeof sifts.$inferSelect;

// ---- API schemas ----

export const stepScopeSchema = z.object({
  durationEstimate: z.string(),
  stoppingCondition: z.string(),
});
export type StepScope = z.infer<typeof stepScopeSchema>;

export const siftOnboardingProfileSchema = z.object({
  mode: z.enum(["base", "companion"]).optional(),
  startingSpace: z.enum(["bedroom", "desk", "rooftop", "library"]).optional(),
  theme: z.enum(["system", "light", "dark"]).optional(),
  primaryIntent: z
    .enum(["sort_thoughts", "calm_noise", "understand_feelings", "find_next_step"])
    .optional(),
  supportStyle: z
    .enum(["gentle", "clear", "direct", "step_by_step"])
    .optional(),
  completedAt: z.string().optional(),
  /** Legacy rows from the first preference pass. */
  capturedAt: z.string().optional(),
});
export type SiftOnboardingProfile = z.infer<typeof siftOnboardingProfileSchema>;
export const supportProfileSchema = siftOnboardingProfileSchema;
export type SupportProfile = SiftOnboardingProfile;

export const supportProfileUpdateSchema = z.object({
  mode: supportProfileSchema.shape.mode.nullable().optional(),
  startingSpace: supportProfileSchema.shape.startingSpace.nullable().optional(),
  theme: supportProfileSchema.shape.theme.nullable().optional(),
  primaryIntent: supportProfileSchema.shape.primaryIntent.nullable().optional(),
  supportStyle: supportProfileSchema.shape.supportStyle.nullable().optional(),
  completedAt: z.string().nullable().optional(),
});
export type SupportProfileUpdateRequest = z.infer<typeof supportProfileUpdateSchema>;

export const memoryPreferencesSchema = z.object({
  rememberThemes: z.boolean().default(true),
  rememberTonePreferences: z.boolean().default(true),
  allowRelatedSuggestions: z.boolean().default(true),
  storeRawTranscript: z.boolean().default(true),
  clarityOnly: z.boolean().default(false),
});
export type MemoryPreferences = z.infer<typeof memoryPreferencesSchema>;

export const memoryPreferencesUpdateSchema = z.object({
  rememberThemes: z.boolean().optional(),
  rememberTonePreferences: z.boolean().optional(),
  allowRelatedSuggestions: z.boolean().optional(),
  storeRawTranscript: z.boolean().optional(),
  clarityOnly: z.boolean().optional(),
});
export type MemoryPreferencesUpdateRequest = z.infer<typeof memoryPreferencesUpdateSchema>;

export const defaultMemoryPreferences: MemoryPreferences = {
  rememberThemes: true,
  rememberTonePreferences: true,
  allowRelatedSuggestions: true,
  storeRawTranscript: true,
  clarityOnly: false,
};

export const analyzeRequestSchema = z.object({
  input: z.string().min(1).max(8000),
  inputMode: z.enum(["text", "voice"]).default("text"),
  /** Bedroom-only presentation phase. Warmup returns a softer first reply while still persisting structured fields. */
  phase: z.enum(["warmup", "structured"]).optional(),
  /** Bedroom-only prompt intent for non-structured warmup openings. */
  intent: z.enum(["warmup-companion", "greeting-warmup"]).optional(),
  /** User sort of short fragments before the main analysis pass. */
  fragmentSort: z
    .array(
      z.object({
        fragment: z.string(),
        bucket: z.enum(["matters", "noise", "unsure"]),
      }),
    )
    .optional(),
  skippedFragmentSort: z.boolean().optional(),
  /** Bypass redundancy gate — used after "Something changed" on high-similarity match. */
  forceAnalysis: z.boolean().optional(),
  /** Pattern-level sift from Garden — extra system prompt + persisted flag */
  metaSift: z.boolean().optional(),
  /** First-run/anonymous onboarding profile. Signed-in server profile still wins. */
  supportProfile: supportProfileUpdateSchema.optional(),
});
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

/** POST /api/sift/fragments — extract short phrases for the pre-sort UI */
export const siftFragmentsRequestSchema = z.object({
  input: z.string().min(1).max(8000),
});
export type SiftFragmentsRequest = z.infer<typeof siftFragmentsRequestSchema>;

export const siftFragmentsResponseSchema = z.object({
  fragments: z.array(z.string()).min(4).max(6),
});
export type SiftFragmentsResponse = z.infer<typeof siftFragmentsResponseSchema>;

export const fragmentBucketSchema = z.enum(["matters", "noise", "unsure"]);
export type FragmentBucket = z.infer<typeof fragmentBucketSchema>;

/** PATCH /api/sift/:id/correction */
export const siftCorrectionRequestSchema = z.object({
  reframe: z.string().min(1).max(4000),
});
export type SiftCorrectionRequest = z.infer<typeof siftCorrectionRequestSchema>;

export const themeSchema = z.object({
  title: z.string(),
  summary: z.string(),
});
export type Theme = z.infer<typeof themeSchema>;

export const siftRevisionSnapshotSchema = z.object({
  at: z.number(),
  coreIntent: z.string(),
  nextStep: z.string(),
  reflection: z.string(),
  themes: z.array(themeSchema),
  matters: z.array(z.string()),
  noise: z.array(z.string()),
  signalReason: z.string().nullable(),
  stepScope: stepScopeSchema.nullable(),
});
export type SiftRevisionSnapshot = z.infer<typeof siftRevisionSnapshotSchema>;

export const analysisSchema = z.object({
  themes: z.array(themeSchema).min(1).max(5),
  coreIntent: z.string(),
  nextStep: z.string(),
  reflection: z.string(),
  // Signal/Noise framing for the first-result UI.
  //   matters       — 2–4 short phrases (3–8 words) of what seems to carry
  //                   consequence right now, drawn from the user's own input.
  //   noise         — 1–3 short phrases of attention-consuming material that
  //                   does not currently increase truth, direction, or
  //                   meaningful movement.
  //   signalReason  — one sentence naming WHY the elevated thread may carry
  //                   consequence — provisional, not declarative.
  matters: z.array(z.string()).min(2).max(4),
  noise: z.array(z.string()).min(1).max(3),
  signalReason: z.string(),
  /** New analyses always populate; omitted on legacy rows */
  stepScope: stepScopeSchema.optional(),
});
export type Analysis = z.infer<typeof analysisSchema>;

export const siftSummaryOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
});

export const siftSummarySchema = z.object({
  summary: z.string(),
  themes: z.array(z.string()).min(2).max(4),
  constraints: z.array(z.string()).optional(),
  canWait: z.array(z.string()).optional(),
  options: z.array(siftSummaryOptionSchema).min(2).max(3),
  recommendedNextStep: siftSummaryOptionSchema,
  meta: z
    .object({
      generatedAt: z.string(),
      model: z.string().optional(),
    })
    .optional(),
});
export type SiftSummary = z.infer<typeof siftSummarySchema>;

// ────────────────────────────────────────────────────────────────────
// Operator artifacts (Phase 3)
// ────────────────────────────────────────────────────────────────────
//
// Operator-mode sifts return ONE of four discriminated artifact shapes.
// All share a common envelope; specialized variants add fields. The model
// picks the artifact type by content (priority: stakeholder_brief >
// decision_memo > project_brief > operator_card; default operator_card).
//
// Personal-mode sifts continue to use analysisSchema unchanged.

// reEntry — a compact, three-field recap surfaced when the user returns
// to a thread later. `state` is presentational ("waiting" is rendered
// in UI but stored as thread_state="open" on the row in Phase 3).
export const reEntrySchema = z.object({
  title: z.string().min(1).max(80),
  state: z.enum(["live", "paused", "waiting"]),
  lastMove: z.string().min(1),
});
export type ReEntry = z.infer<typeof reEntrySchema>;

// frontBurnerRelevance — model recommendation only. Never auto-promotes.
// score is 0–5 against the front-burner checklist; reason is one sentence.
export const frontBurnerRelevanceSchema = z.object({
  score: z.number().int().min(0).max(5),
  reason: z.string().min(1),
});
export type FrontBurnerRelevance = z.infer<typeof frontBurnerRelevanceSchema>;

// Common envelope shared by all four artifact variants.
const operatorEnvelopeShape = {
  coreIntent: z.string().min(1),
  whatImHearing: z.string().min(1),
  whatMattersNow: z.array(z.string()).min(2).max(4),
  // Operator may legitimately have nothing loud — empty array is valid.
  whatMayBeNoise: z.array(z.string()).max(3),
  currentMove: z.string().min(1),
  frontBurnerRelevance: frontBurnerRelevanceSchema,
  reEntry: reEntrySchema,
} as const;

// 1. operator_card — default. No specialized fields.
export const operatorCardSchema = z.object({
  artifactType: z.literal("operator_card"),
  ...operatorEnvelopeShape,
});

// 2. decision_memo — forced choice between named options.
export const decisionMemoSchema = z.object({
  artifactType: z.literal("decision_memo"),
  ...operatorEnvelopeShape,
  decisionQuestion: z.string().min(1),
  options: z
    .array(
      z.object({
        label: z.string().min(1),
        summary: z.string().min(1),
      }),
    )
    .min(2)
    .max(4),
  whyHard: z.string().min(1),
  whatToRevisit: z.string().min(1),
});

// 3. project_brief — bounded deliverable, mixed strategy/execution/risk.
export const projectBriefSchema = z.object({
  artifactType: z.literal("project_brief"),
  ...operatorEnvelopeShape,
  objective: z.string().min(1),
  currentReality: z.string().min(1),
  risks: z.array(z.string()).min(1).max(3),
  notTheProblem: z.string().min(1),
  dependencies: z.array(z.string()).max(3),
});

// 4. stakeholder_brief — specific person is the load-bearing factor.
export const stakeholderBriefSchema = z.object({
  artifactType: z.literal("stakeholder_brief"),
  ...operatorEnvelopeShape,
  personName: z.string().min(1),
  relationshipContext: z.string().min(1),
  dynamicShape: z.string().min(1),
  userPosition: z.string().min(1),
  theirPosition: z.string().min(1),
  directThing: z.string().min(1),
});

// Discriminated union covering all four variants. Use this for the
// runOperatorAnalysis() return type and on the wire between server/UI.
export const operatorArtifactSchema = z.discriminatedUnion("artifactType", [
  operatorCardSchema,
  decisionMemoSchema,
  projectBriefSchema,
  stakeholderBriefSchema,
]);
export type OperatorArtifact = z.infer<typeof operatorArtifactSchema>;

// Literal enum of valid artifactType values. Used for the
// sifts.artifact_type column and any narrowing on the client.
export const operatorArtifactTypeSchema = z.enum([
  "operator_card",
  "decision_memo",
  "project_brief",
  "stakeholder_brief",
]);
export type OperatorArtifactType = z.infer<typeof operatorArtifactTypeSchema>;

// ────────────────────────────────────────────────────────────────────

/** Low redundancy — full analysis still ran; quiet caption only */
export const redundancyHintWireSchema = z.object({
  level: z.literal("low"),
  message: z.string(),
});
export type RedundancyHintWire = z.infer<typeof redundancyHintWireSchema>;

/** High redundancy — short-circuit; no themes/matters in same payload */
export const redundancyGateWireSchema = z.object({
  level: z.literal("high"),
  priorSiftId: z.string(),
  priorNextStep: z.string(),
  message: z.string(),
  options: z.tuple([
    z.literal("Something changed"),
    z.literal("I think I know this"),
  ]),
});
export type RedundancyGateWire = z.infer<typeof redundancyGateWireSchema>;

export type SiftResult = Analysis & {
  id: string;
  input: string;
  inputMode: "text" | "voice";
  createdAt: number;
  /** Pattern-level sift (Garden meta-sift) */
  metaSift?: boolean;
  mine?: boolean; // set on client when viewing own sift
  checkins?: CheckinResult[];
  status?: SiftStatus;
  turns?: ThreadTurn[];
  bookmark?: Bookmark;
  /** Present when at least one correction ran — newest last */
  revisionHistory?: SiftRevisionSnapshot[];
  /** First suggested next step at creation; unchanged by check-ins */
  baselineNextStep?: string;
  /** Same recurring signal pattern detected across prior sifts — quiet caption */
  recurringSignal?: boolean;
  redundancyHint?: RedundancyHintWire;
  /** When present with level high, client renders gate UI instead of full card */
  redundancyGate?: RedundancyGateWire;
  /** Owner-only: discernment profile thresholds met; one-time closure nudge */
  showClosurePrompt?: boolean;
  /** Three micro-tasks from Break it down — null until generated */
  microTasks?: string[] | null;
  /** Routed mode — drives Operator-only UI affordances on the result. */
  mode?: SiftMode;
  /** Operator front-burner rank — 1|2|3 when set, null otherwise. */
  frontBurnerRank?: number | null;
  /** Operator artifact discriminator — used to render the right pill. */
  artifactType?: OperatorArtifactType | null;
  /** Phase 2 conversation summary, returned on explicit summary requests. */
  summary?: SiftSummary;
};

/** POST /api/sift may return this instead of a full SiftResult when redundancy is high */
export type SiftRedundancyGateResult = {
  id?: string;
  input: string;
  inputMode: "text" | "voice";
  createdAt: number;
  mine?: boolean;
  redundancyGate: RedundancyGateWire;
};

// Crisis safeguard — the server short-circuits when an input appears to
// describe suicidal ideation, self-harm, or intent to harm others. We do not
// persist the input, do not send it to the LLM, and do not return a normal
// SiftResult. The client renders a calm CareScreen instead.
export type CareResponse = { type: "care" };

export type SiftOrCareResult =
  | ({ type?: "sift" } & SiftResult)
  | SiftRedundancyGateResult
  | CareResponse;

export function isCareResponse(
  r: unknown,
): r is CareResponse {
  return (
    typeof r === "object" &&
    r !== null &&
    (r as { type?: unknown }).type === "care"
  );
}

/** POST /api/sift short-circuit — high redundancy gate payload */
export function isRedundancyGateResult(
  r: unknown,
): r is SiftRedundancyGateResult {
  return (
    typeof r === "object" &&
    r !== null &&
    (r as { redundancyGate?: { level?: string } }).redundancyGate?.level ===
      "high"
  );
}

/** PATCH /api/sift/:id/close — dismiss closure prompt and optionally close thread */
export const siftClosurePromptPatchSchema = z.object({
  closurePromptShown: z.literal(true),
  keepOpen: z.boolean().optional(),
});

export const siftBreakdownRequestSchema = z.object({
  nextStep: z.string().min(1).max(4000),
});
export type SiftBreakdownRequest = z.infer<typeof siftBreakdownRequestSchema>;

// POST /api/sift/:id/revise-step — step negotiation. The step is a proposal,
// never final. "smaller" asks for a narrower variant that still passes the
// scope/time tests. "different" asks for a different shape of move on the
// same underlying signal. Optional `feedback` lets the user name what felt
// off about the current step without re-sifting the whole read.
export const siftStepRevisionRequestSchema = z.object({
  variant: z.enum(["smaller", "different"]),
  feedback: z.string().max(600).optional(),
});
export type SiftStepRevisionRequest = z.infer<
  typeof siftStepRevisionRequestSchema
>;

export const siftStepRevisionResponseSchema = z.object({
  nextStep: z.string().min(1),
  stepScope: stepScopeSchema,
});
export type SiftStepRevisionResponse = z.infer<
  typeof siftStepRevisionResponseSchema
>;
export type SiftClosurePromptPatchRequest = z.infer<
  typeof siftClosurePromptPatchSchema
>;

// ---- Smart re-entry (GET /api/reentry) ----
export type ReEntryAction =
  | { type: "checkin"; threadId: string; threadTitle: string }
  | { type: "compare"; currentSiftId: string; priorSiftId: string }
  | { type: "revisit"; threadId: string; threadTitle: string };

export type ReEntryResponse = {
  prompt: string | null;
  action?: ReEntryAction;
};

// ---- Check-in schemas ----
export const checkinStatusSchema = z.enum(["did_it", "did_not", "in_progress"]);
export type CheckinStatus = z.infer<typeof checkinStatusSchema>;

export const checkinRequestSchema = z.object({
  status: checkinStatusSchema,
  note: z.string().max(4000).optional().default(""),
});
export type CheckinRequest = z.infer<typeof checkinRequestSchema>;

/** LLM output only — priorNextStep added when persisting */
export const checkinModelOutputSchema = z.object({
  hearing: z.string(),
  matters: z.array(z.string()).min(1).max(4),
  noise: z.array(z.string()).min(1).max(3),
  nextStep: z.string(),
  changeReason: z.string().optional(),
});
export type CheckinModelOutput = z.infer<typeof checkinModelOutputSchema>;

export const checkinAnalysisSchema = z.object({
  hearing: z.string(), // "what I'm hearing" — 2-4 sentences
  matters: z.array(z.string()).min(1).max(4), // "what matters" — 2-3 bullets
  noise: z.array(z.string()).min(1).max(3), // "what's noise" — 1-2 bullets
  nextStep: z.string(), // one refined action
  /** Why the next step shifted — provisional, one or two sentences */
  changeReason: z.string().optional(),
  /** Filled server-side when persisting — step this check-in replaced */
  priorNextStep: z.string().optional(),
});
export type CheckinAnalysis = z.infer<typeof checkinAnalysisSchema>;

export type CheckinResult = CheckinAnalysis & {
  id: number;
  createdAt: number;
  status: CheckinStatus;
  note: string;
};

// Auth
// Email or phone validation — either is acceptable.
// Email: permissive RFC-ish check (we don't verify deliverability).
// Phone: digits + optional leading "+", 7–15 digits (E.164-ish). Spaces,
// parens, and dashes are stripped before validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;

function normalizePhone(s: string): string {
  return s.replace(/[\s().\-]/g, "");
}

/** "email" | "phone" | null */
export function classifyContact(raw: string): "email" | "phone" | null {
  const v = raw.trim();
  if (!v) return null;
  if (EMAIL_RE.test(v)) return "email";
  const normalized = normalizePhone(v);
  if (PHONE_RE.test(normalized)) return "phone";
  return null;
}

export const handleSchema = z
  .string()
  .trim()
  .min(2, "Handle must be at least 2 characters")
  .max(24, "Handle must be 24 characters or fewer")
  .regex(/^[a-z0-9_.-]+$/i, "Letters, numbers, dot, dash, underscore only");

export const passphraseSchema = z
  .string()
  .min(6, "Passphrase must be at least 6 characters")
  .max(200, "Passphrase too long");

// Login keeps the minimal shape — handle + passphrase only.
export const loginSchema = z.object({
  handle: handleSchema,
  passphrase: passphraseSchema,
});
export type LoginRequest = z.infer<typeof loginSchema>;

// Signup can be a light account first. Contact is optional and can be added later.
export const signupSchema = z
  .object({
    handle: handleSchema,
    passphrase: passphraseSchema,
    contact: z.string().trim().optional().default(""),
    consentUpdates: z.boolean().optional().default(false),
    consentReflections: z.boolean().optional().default(false),
    supportProfile: supportProfileUpdateSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.contact && classifyContact(data.contact) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid email or phone number",
        path: ["contact"],
      });
    }
  });
export type SignupRequest = z.infer<typeof signupSchema>;

// Existing users (created before this field existed) get a one-time skippable
// prompt. Same validation as signup but without handle/passphrase.
export const contactUpdateSchema = z
  .object({
    contact: z.string().trim().min(1, "Enter your email or phone"),
    consentUpdates: z.boolean().optional().default(false),
    consentReflections: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (classifyContact(data.contact) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid email or phone number",
        path: ["contact"],
      });
    }
  });
export type ContactUpdateRequest = z.infer<typeof contactUpdateSchema>;

// Legacy alias — some callers may still import authSchema. Points at login.
export const authSchema = loginSchema;
export type AuthRequest = LoginRequest;

// Me payload. `contactMissing` tells the client whether to show the one-time
// prompt to existing users who signed up before we captured contact info.
export type Me =
  | {
      id: number;
      handle: string;
      email: string | null;
      phone: string | null;
      contactMissing: boolean;
      supportProfile: SupportProfile | null;
      memoryPreferences: MemoryPreferences;
    }
  | null;

// Thread status — quiet open/closed marker on saved sifts.
export const siftStatusSchema = z.enum(["open", "closed"]);
export type SiftStatus = z.infer<typeof siftStatusSchema>;

export const updateSiftStatusSchema = z.object({
  status: siftStatusSchema,
});
export type UpdateSiftStatusRequest = z.infer<typeof updateSiftStatusSchema>;

// History list item (compact)
export type SiftListItem = {
  id: string;
  createdAt: number;
  coreIntent: string;
  nextStep: string;
  status: SiftStatus;
  /** Pattern-level sift */
  metaSift?: boolean;
  // V1 thread fields
  mode: 'personal' | 'operator' | null;
  threadState: 'open' | 'closed' | 'archived';
  frontBurnerRank: number | null;
  currentMove: string | null;
};

// ---- V1 enums ----
export type SiftMode = 'personal' | 'operator';
export type EntrySignal = 'explicit_project' | 'decision_language' | 'stakeholder' | 'structural_work' | 'explicit_request' | 'none';

export const siftModeSchema = z.enum(['personal', 'operator']);
export const entrySignalSchema = z.enum([
  'explicit_project', 'decision_language', 'stakeholder',
  'structural_work', 'explicit_request', 'none',
]);
export const threadStateSchema = z.enum(['open', 'closed', 'archived']);

export const updateThreadSchema = z.object({
  threadState: threadStateSchema.optional(),
  frontBurnerRank: z.number().int().min(1).max(3).nullable().optional(),
  currentMove: z.string().nullable().optional(),
  closureCondition: z.string().nullable().optional(),
});
export type UpdateThreadRequest = z.infer<typeof updateThreadSchema>;

// ---- V1 tables ----
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  goal: text("goal"),
  status: text("status").notNull().default("active"), // 'active'|'paused'|'closed'
  deadline: integer("deadline"),
  owner: text("owner"),
  currentRisk: text("current_risk"),
  currentMove: text("current_move"),
  blockers: text("blockers"), // JSON string[]
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export type Project = typeof projects.$inferSelect;

export const decisions = sqliteTable("decisions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  decisionQuestion: text("decision_question"),
  options: text("options"), // JSON string[]
  constraints: text("constraints"), // JSON string[]
  reversibleOrNot: integer("reversible_or_not").notNull().default(1),
  dueBy: integer("due_by"),
  recommendedNextMove: text("recommended_next_move"),
  status: text("status").notNull().default("open"), // 'open'|'decided'|'parked'
  decidedOption: text("decided_option"),
  decidedAt: integer("decided_at"),
  parkReason: text("park_reason"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export type Decision = typeof decisions.$inferSelect;

export const persons = sqliteTable("persons", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  role: text("role"),
  relationshipToUser: text("relationship_to_user"),
  sensitivityLevel: text("sensitivity_level").default("medium"),
  openLoops: text("open_loops"), // JSON string[]
  lastMaterialInteraction: integer("last_material_interaction"),
  interactionSummary: text("interaction_summary"),
  primaryProject: text("primary_project"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export type Person = typeof persons.$inferSelect;

export const threadLinks = sqliteTable("thread_links", {
  threadId: text("thread_id").notNull(),
  objectType: text("object_type").notNull(), // 'project'|'decision'|'person'
  objectId: text("object_id").notNull(),
  role: text("role").notNull().default("secondary"), // 'primary'|'secondary'|'referenced'
});
export type ThreadLink = typeof threadLinks.$inferSelect;


// ---- Thread turns ----
// A thread turn is one back-and-forth beat inside a sift's deepening flow.
// role='user' holds what the user wrote; role='sift' holds a compact
// conversational response (mirror, question, shifted sense of matters/noise,
// mini synthesis) OR a structured checkpoint card. We keep the payload as
// JSON so the kind can evolve without another migration.
export const threadTurns = sqliteTable("thread_turns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  siftId: text("sift_id").notNull(),
  createdAt: integer("created_at").notNull(),
  role: text("role").notNull(), // 'user' | 'sift'
  kind: text("kind").notNull(), // 'message' | 'checkpoint' | 'closure' | 'sort_prompt' | 'sort_result'
  // JSON shape depends on kind:
  //   message (role='user'):    { text: string }
  //   message (role='sift'):    { mirror?: string, question?: string,
  //                               matters?: string[], noise?: string[],
  //                               mini?: string }
  //   checkpoint (role='sift'): { pointing, unfolded, matters[], noise[],
  //                               lastLanded, nextStep } — same shape as Bookmark
  //   closure (role='sift'):    { reflection: string }
  //   sort_prompt (role='sift'):{ intro: string, items: string[] }
  //                               — items are short thread-derived phrases
  //                               the user will sort into matters vs noise
  //   sort_result (role='user'):{ matters: string[], noise: string[],
  //                               unsure: string[], skipped?: boolean }
  payload: text("payload").notNull(),
});
export type ThreadTurnRow = typeof threadTurns.$inferSelect;

// ---- Thread bookmarks ----
// One-per-sift upsertable recap. Stores the latest synthesis checkpoint so
// re-entry shows a compact card instead of raw history.
export const threadBookmarks = sqliteTable("thread_bookmarks", {
  siftId: text("sift_id").primaryKey(),
  updatedAt: integer("updated_at").notNull(),
  // JSON of BookmarkPayload
  payload: text("payload").notNull(),
});
export type ThreadBookmarkRow = typeof threadBookmarks.$inferSelect;

// The six required labeled sections, derived from the whole thread.
// Label copy (preserve verbatim in the UI):
//   "What this may be pointing to" — pointing
//   "What has unfolded so far" — unfolded
//   "What seems to matter most right now" — matters
//   "What may be noise right now" — noise
//   "Where you last landed" — lastLanded
//   "A next step, if there is one" — nextStep
export const bookmarkPayloadSchema = z.object({
  pointing: z.string(),
  unfolded: z.string(),
  matters: z.array(z.string()).min(1).max(4),
  noise: z.array(z.string()).min(1).max(3),
  lastLanded: z.string(),
  nextStep: z.string(),
});
export type BookmarkPayload = z.infer<typeof bookmarkPayloadSchema>;

// Sift turn (server response shape). Narrower than the row — payload is parsed.
export const siftTurnMessageSchema = z.object({
  mirror: z.string().optional(),
  question: z.string().optional(),
  matters: z.array(z.string()).max(4).optional(),
  noise: z.array(z.string()).max(3).optional(),
  mini: z.string().optional(),
  // Phase 4: operator deepening may return an updated currentMove so the
  // sift row stays accurate across turns. Strictly optional — backward-
  // compatible with every existing message.
  operatorCurrentMove: z.string().optional(),
});
export type SiftTurnMessage = z.infer<typeof siftTurnMessageSchema>;

// Signal/Noise sort practice
// A dedicated practice moment inserted into the thread every few user turns.
// Sift offers a set of short phrases distilled from the thread itself, and the
// user actively sorts each into "matters" vs "noise" vs "not sure". The result
// is persisted in the thread (so the model and the bookmark can both reflect
// what the user chose) and materially shapes the next Sift reply.
export const sortPromptPayloadSchema = z.object({
  intro: z.string(),
  // 6–10 short phrases from the thread. 2–7 words each.
  items: z.array(z.string().min(1).max(80)).min(4).max(10),
});
export type SortPromptPayload = z.infer<typeof sortPromptPayloadSchema>;

export const sortResultPayloadSchema = z.object({
  matters: z.array(z.string()).default([]),
  noise: z.array(z.string()).default([]),
  unsure: z.array(z.string()).default([]),
  skipped: z.boolean().optional(),
});
export type SortResultPayload = z.infer<typeof sortResultPayloadSchema>;

export type ThreadTurn =
  | { id: number; createdAt: number; role: "user"; kind: "message"; text: string }
  | {
      id: number;
      createdAt: number;
      role: "sift";
      kind: "message";
      message: SiftTurnMessage;
    }
  | {
      id: number;
      createdAt: number;
      role: "sift";
      kind: "checkpoint";
      checkpoint: BookmarkPayload;
    }
  | {
      id: number;
      createdAt: number;
      role: "sift";
      kind: "closure";
      reflection: string;
    }
  | {
      id: number;
      createdAt: number;
      role: "sift";
      kind: "sort_prompt";
      sortPrompt: SortPromptPayload;
    }
  | {
      id: number;
      createdAt: number;
      role: "user";
      kind: "sort_result";
      sortResult: SortResultPayload;
    };

export type Bookmark = {
  updatedAt: number;
  payload: BookmarkPayload;
};

export type LibrarySiftPreview = {
  summary: string;
  matters: string[];
  noise: string[];
  nextStep: string;
};

export type LibrarySiftItem = {
  id: string;
  title: string;
  createdAt: number;
  summary: string;
  tags: string[];
  hasNextStep: boolean;
  pinned: boolean;
  memoryMode: "full" | "clarity_only" | "do_not_remember";
  transcriptExpiresAt: number | null;
  mode: "base" | "companion" | "personal" | "operator" | null;
  environment: "bedroom" | "desk" | "rooftop" | "library" | null;
  preview: LibrarySiftPreview;
};

export type LibrarySiftDetail = LibrarySiftItem & {
  input: string;
  themes: Theme[];
  reflection: string | null;
  transcript: ThreadTurn[];
  related: LibrarySiftItem[];
};

export type LibraryRecurringTheme = {
  label: string;
  count: number;
};

export type LibraryResponse = {
  items: LibrarySiftItem[];
  recurringThemes: LibraryRecurringTheme[];
  memoryPreferences: MemoryPreferences;
};

export const sessionMemoryModeSchema = z.enum(["full", "clarity_only", "do_not_remember"]);
export const updateSessionMemorySchema = z.object({
  memoryMode: sessionMemoryModeSchema.optional(),
  pinned: z.boolean().optional(),
  transcriptExpiresAt: z.number().int().positive().nullable().optional(),
});
export type UpdateSessionMemoryRequest = z.infer<typeof updateSessionMemorySchema>;

/** Owner-facing thread payload from GET /api/threads/:id (inner `thread` key). */
export type ThreadDetail = {
  id: string;
  createdAt: number;
  input: string;
  inputMode: string;
  coreIntent: string;
  nextStep: string;
  reflection: string | null;
  status: SiftStatus;
  mode: SiftMode;
  modeLocked: boolean;
  entrySignal: string | null;
  threadState: 'open' | 'closed' | 'archived';
  frontBurnerRank: number | null;
  currentMove: string | null;
  closureCondition: string | null;
  turns: ThreadTurn[];
  bookmark?: Bookmark | null;
};

// ---- Deepen / close API ----
export const clientTranscriptTurnSchema = z.object({
  role: z.enum(["user", "sift"]),
  text: z.string().min(1).max(4000),
});
export type ClientTranscriptTurn = z.infer<typeof clientTranscriptTurnSchema>;

export const deepenRequestSchema = z.object({
  text: z.string().min(1).max(4000).optional(),
  mode: z.literal("summary").optional(),
  phase: z.enum(["warmup", "structured"]).optional(),
  intent: z.enum(["warmup-companion", "greeting-warmup"]).optional(),
  /** Bedroom summary guardrail: visible current-session transcript from the client. */
  clientTranscript: z.array(clientTranscriptTurnSchema).max(24).optional(),
  /** First-run/anonymous onboarding profile. Signed-in server profile still wins. */
  supportProfile: supportProfileUpdateSchema.optional(),
}).refine((v) => v.mode === "summary" || !!v.text?.trim(), {
  message: "Text is required unless requesting a summary",
  path: ["text"],
});
export type DeepenRequest = z.infer<typeof deepenRequestSchema>;

// Response can include: the user turn that was just appended, a sift reply,
// optionally a checkpoint (synthesis) + updated bookmark, optionally a
// sort_prompt (when the server decides it's time for a Signal/Noise practice
// moment — instead of emitting a sift message in this turn), and a convergence
// flag hinting that the thread may be landing.
export type DeepenResponse =
  | {
      type: "care";
    }
  | {
      type: "turns";
      turns: ThreadTurn[]; // newly appended turns, oldest first
      bookmark?: Bookmark;
      converged?: boolean;
      // When true, the last turn in `turns` is a sort_prompt and the client
      // should render the practice activity before accepting more input.
      awaitingSort?: boolean;
    }
  | {
      type: "summary";
      summary: SiftSummary;
    };

// Submit a completed (or skipped) signal/noise sort. The server persists it,
// updates the bookmark's matters/noise with the user's own choices, and
// produces the next Sift reply that references the sort.
export const sortRequestSchema = z.object({
  matters: z.array(z.string()).max(10).default([]),
  noise: z.array(z.string()).max(10).default([]),
  unsure: z.array(z.string()).max(10).default([]),
  skipped: z.boolean().optional(),
});
export type SortRequest = z.infer<typeof sortRequestSchema>;

export type SortResponse =
  | { type: "care" }
  | {
      type: "turns";
      turns: ThreadTurn[]; // sort_result + sift message (and optional checkpoint)
      bookmark?: Bookmark;
      converged?: boolean;
    };

export type CloseResponse =
  | { type: "care" }
  | { type: "closed"; reflection: string; turn: ThreadTurn };

// ---- Feedback ----
//
// First-party in-app feedback. Captured at well-defined moments in the flow
// (the result card, mid-deepening, summary/checkpoint, and at closure) and
// reviewed in the admin page. We persist tiny snapshots of the user's input
// and the model's coreIntent at the moment they gave feedback so the admin
// can spot patterns without having to chase the original sift each time.
export const feedback = sqliteTable("feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: integer("created_at").notNull(),
  userId: integer("user_id"), // nullable: anonymous feedback
  siftId: text("sift_id"), // nullable: feedback not tied to a sift
  stage: text("stage").notNull(), // 'result' | 'deepening' | 'summary' | 'closure'
  sentiment: text("sentiment").notNull(), // 'helpful' | 'not_helpful'
  tag: text("tag"), // nullable label
  message: text("message"), // optional free text
  inputSnapshot: text("input_snapshot"), // truncated copy of the user's original input
  coreIntentSnapshot: text("core_intent_snapshot"), // model's coreIntent at the time
  resolved: integer("resolved").notNull().default(0), // 0|1
});
export type FeedbackRow = typeof feedback.$inferSelect;

export const feedbackStageSchema = z.enum([
  "result",
  "deepening",
  "summary",
  "closure",
]);
export type FeedbackStage = z.infer<typeof feedbackStageSchema>;

export const feedbackSentimentSchema = z.enum(["helpful", "not_helpful"]);
export type FeedbackSentiment = z.infer<typeof feedbackSentimentSchema>;

// Suggested tags. The server accepts any short snake_case-ish string within
// these bounds so we can experiment without locking the wire format, but the
// client only surfaces this curated set.
export const POSITIVE_TAGS = [
  "felt_accurate",
  "made_things_clearer",
  "good_next_step",
  "calming",
  "helped_me_focus",
] as const;
export const NEGATIVE_TAGS = [
  "too_vague",
  "missed_the_point",
  "too_wordy",
  "not_actionable",
  "felt_repetitive",
] as const;
export type PositiveTag = (typeof POSITIVE_TAGS)[number];
export type NegativeTag = (typeof NEGATIVE_TAGS)[number];

export const feedbackRequestSchema = z.object({
  siftId: z.string().min(1).max(64).optional().nullable(),
  stage: feedbackStageSchema,
  sentiment: feedbackSentimentSchema,
  tag: z.string().min(1).max(64).optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
});
export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;

// Wire shape returned by the API. Booleans/nulls are normalized; raw 0/1
// flags from SQLite are converted before this leaves the server.
export type Feedback = {
  id: number;
  createdAt: number;
  userId: number | null;
  userHandle: string | null; // joined for admin convenience
  siftId: string | null;
  stage: FeedbackStage;
  sentiment: FeedbackSentiment;
  tag: string | null;
  message: string | null;
  inputSnapshot: string | null;
  coreIntentSnapshot: string | null;
  resolved: boolean;
};

export type FeedbackStats = {
  total: number;
  helpful: number;
  notHelpful: number;
  unresolved: number;
  byStage: Record<FeedbackStage, { helpful: number; notHelpful: number }>;
  topTags: Array<{ tag: string; count: number; sentiment: FeedbackSentiment }>;
};

// ---- Admin review privacy boundary ----
//
// The admin reviewer needs enough context to assess sift quality (themes,
// coreIntent, nextStep, reflection, basic metadata) without ever seeing the
// raw user prompt. The DB still stores the raw input on the sifts table and
// truncated input snapshots on the feedback table — those columns are
// intentionally untouched so normal product behavior continues to work. But
// admin review responses are built from these explicit allowlist DTOs, which
// have no field that could carry prompt text. The `promptRedacted: true`
// literal lets the admin UI surface the boundary intentionally.

export type AdminReviewSift = {
  id: string;
  createdAt: number;
  inputMode: "text" | "voice";
  promptRedacted: true;
  themes: Theme[];
  coreIntent: string;
  nextStep: string;
  reflection: string;
  status?: SiftStatus;
  promptMeta: {
    charCount: number;
    inputMode: "text" | "voice";
  };
};

// Admin-side review shape for a single feedback row. Mirrors the user-facing
// Feedback type but strips both the user's typed message AND any field that
// could leak the original prompt (inputSnapshot is removed; coreIntentSnapshot
// stays because coreIntent is a model output, not the user's words). The
// admin reviewer still sees the user's free-text feedback message because
// that's what they typed about the sift, not the sift itself.
export type AdminReviewFeedback = {
  id: number;
  createdAt: number;
  userId: number | null;
  userHandle: string | null;
  siftId: string | null;
  stage: FeedbackStage;
  sentiment: FeedbackSentiment;
  tag: string | null;
  message: string | null;
  resolved: boolean;
  // Explicit redaction marker — `true` means the original prompt is in storage
  // but intentionally withheld from admin review.
  promptRedacted: true;
  // Model-output context the reviewer is allowed to see. Null when the
  // feedback row has no associated sift (e.g. closure feedback without id).
  coreIntentSnapshot: string | null;
  // Lightweight, non-content-revealing metadata about the original prompt.
  // Null when the feedback row has no associated sift.
  promptMeta: {
    charCount: number;
    inputMode: "text" | "voice";
  } | null;
};

