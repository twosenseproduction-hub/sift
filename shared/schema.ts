import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
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
  createdAt: integer("created_at").notNull(),
  input: text("input").notNull(),
  inputMode: text("input_mode").notNull(), // 'text' | 'voice'
  // JSON-serialized arrays / objects
  themes: text("themes").notNull(), // [{title, summary}]
  coreIntent: text("core_intent").notNull(),
  nextStep: text("next_step").notNull(),
  reflection: text("reflection").notNull(),
  // Thread status: 'open' = still active, 'closed' = done for now.
  // Defaults to 'open' at insert time.
  status: text("status").notNull().default("open"),
});

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

export const analyzeRequestSchema = z.object({
  input: z.string().min(1).max(8000),
  inputMode: z.enum(["text", "voice"]).default("text"),
});
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

export const themeSchema = z.object({
  title: z.string(),
  summary: z.string(),
});
export type Theme = z.infer<typeof themeSchema>;

export const analysisSchema = z.object({
  themes: z.array(themeSchema).min(1).max(5),
  coreIntent: z.string(),
  nextStep: z.string(),
  reflection: z.string(),
});
export type Analysis = z.infer<typeof analysisSchema>;

export type SiftResult = Analysis & {
  id: string;
  input: string;
  inputMode: "text" | "voice";
  createdAt: number;
  mine?: boolean; // set on client when viewing own sift
  checkins?: CheckinResult[];
  status?: SiftStatus;
  turns?: ThreadTurn[];
  bookmark?: Bookmark;
};

// Crisis safeguard — the server short-circuits when an input appears to
// describe suicidal ideation, self-harm, or intent to harm others. We do not
// persist the input, do not send it to the LLM, and do not return a normal
// SiftResult. The client renders a calm CareScreen instead.
export type CareResponse = { type: "care" };

export type SiftOrCareResult =
  | ({ type?: "sift" } & SiftResult)
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

// ---- Check-in schemas ----
export const checkinStatusSchema = z.enum(["did_it", "did_not", "in_progress"]);
export type CheckinStatus = z.infer<typeof checkinStatusSchema>;

export const checkinRequestSchema = z.object({
  status: checkinStatusSchema,
  note: z.string().max(4000).optional().default(""),
});
export type CheckinRequest = z.infer<typeof checkinRequestSchema>;

export const checkinAnalysisSchema = z.object({
  hearing: z.string(), // "what I'm hearing" — 2-4 sentences
  matters: z.array(z.string()).min(1).max(4), // "what matters" — 2-3 bullets
  noise: z.array(z.string()).min(1).max(3), // "what's noise" — 1-2 bullets
  nextStep: z.string(), // one refined action
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

// Signup requires a contact (email or phone) and two consent booleans.
export const signupSchema = z
  .object({
    handle: handleSchema,
    passphrase: passphraseSchema,
    contact: z
      .string()
      .trim()
      .min(1, "Enter your email or phone so we can reach you later"),
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
      contactMissing: boolean;
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
};

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
  kind: text("kind").notNull(), // 'message' | 'checkpoint' | 'closure'
  // JSON shape depends on kind:
  //   message (role='user'):   { text: string }
  //   message (role='sift'):   { mirror?: string, question?: string,
  //                              matters?: string[], noise?: string[],
  //                              mini?: string }
  //   checkpoint (role='sift'):{ pointing, unfolded, matters[], noise[],
  //                              lastLanded, nextStep } — same shape as Bookmark
  //   closure (role='sift'):   { reflection: string }
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
});
export type SiftTurnMessage = z.infer<typeof siftTurnMessageSchema>;

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
    };

export type Bookmark = {
  updatedAt: number;
  payload: BookmarkPayload;
};

// ---- Deepen / close API ----
export const deepenRequestSchema = z.object({
  text: z.string().min(1).max(4000),
});
export type DeepenRequest = z.infer<typeof deepenRequestSchema>;

// Response can include: the user turn that was just appended, a sift reply,
// optionally a checkpoint (synthesis) + updated bookmark, and a convergence
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
    };

export type CloseResponse =
  | { type: "care" }
  | { type: "closed"; reflection: string; turn: ThreadTurn };

