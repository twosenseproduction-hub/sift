import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---- Users ----
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  handle: text("handle").notNull().unique(),
  passphraseHash: text("passphrase_hash").notNull(),
  createdAt: integer("created_at").notNull(),
});

export type User = typeof users.$inferSelect;

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
});

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
};

// Auth
export const authSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(2, "Handle must be at least 2 characters")
    .max(24, "Handle must be 24 characters or fewer")
    .regex(/^[a-z0-9_.-]+$/i, "Letters, numbers, dot, dash, underscore only"),
  passphrase: z
    .string()
    .min(6, "Passphrase must be at least 6 characters")
    .max(200, "Passphrase too long"),
});
export type AuthRequest = z.infer<typeof authSchema>;

export type Me = { id: number; handle: string } | null;

// History list item (compact)
export type SiftListItem = {
  id: string;
  createdAt: number;
  coreIntent: string;
  nextStep: string;
};
