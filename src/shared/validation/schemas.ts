import { z } from "zod";

export const ScanSettingsSchema = z.object({
  maxChunks: z.number().int().min(1).max(2000).optional(),
  chunkWords: z.number().int().min(70).max(520).optional(),
  overlapWords: z.number().int().min(0).max(180).optional(),
  sensitivity: z.enum(["quick", "balanced", "deep"]).optional()
});

export const ScanRequestSchema = z.object({
  text: z.string().min(120, "Додайте щонайменше 120 символів тексту для надійної перевірки."),
  fileName: z.string().optional(),
  settings: ScanSettingsSchema.optional()
});

export const LlmOpinionRequestSchema = z.object({
  text: z.string().min(120, "Додайте щонайменше 120 символів тексту для AI-думки."),
  localProbability: z.number().min(0).max(100).optional(),
  localSignals: z.array(z.any()).optional(),
  suspiciousExcerpts: z.array(z.string().max(2000)).max(8).optional(),
  reportId: z.string().uuid().optional()
});

export const HumanizeRequestSchema = z.object({
  text: z.string().min(1, "Текст не може бути порожнім"),
  html: z.string().optional(),
  mode: z.enum(["academic", "natural", "concise"]).optional()
});
