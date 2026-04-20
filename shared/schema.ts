import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// A Sift = one "run" of messy thoughts → themes + next step
export const sifts = sqliteTable("sifts", {
  id: text("id").primaryKey(), // short public share id
  createdAt: integer("created_at").notNull(),
  input: text("input").notNull(),
  inputMode: text("input_mode").notNull(), // 'text' | 'voice'
  // JSON-serialized arrays / objects
  themes: text("themes").notNull(), // [{title, summary}]
  coreIntent: text("core_intent").notNull(),
  nextStep: text("next_step").notNull(), // actionable next step
  reflection: text("reflection").notNull(), // a one-line closing
});

export const insertSiftSchema = createInsertSchema(sifts).omit({
  createdAt: true,
});

export type InsertSift = z.infer<typeof insertSiftSchema>;
export type Sift = typeof sifts.$inferSelect;

// Analysis request schema (from client)
export const analyzeRequestSchema = z.object({
  input: z.string().min(1).max(8000),
  inputMode: z.enum(["text", "voice"]).default("text"),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

// Theme shape
export const themeSchema = z.object({
  title: z.string(),
  summary: z.string(),
});
export type Theme = z.infer<typeof themeSchema>;

// Structured AI output (what the model returns and what we return to client)
export const analysisSchema = z.object({
  themes: z.array(themeSchema).min(1).max(5),
  coreIntent: z.string(),
  nextStep: z.string(),
  reflection: z.string(),
});
export type Analysis = z.infer<typeof analysisSchema>;

// Full sift response (analysis + id for sharing)
export type SiftResult = Analysis & {
  id: string;
  input: string;
  inputMode: "text" | "voice";
  createdAt: number;
};
