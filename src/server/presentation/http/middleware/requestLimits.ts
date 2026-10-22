import multer from "multer";
import { rateLimit } from "express-rate-limit";
export const scanLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: "Забагато запитів" } });
export const fileLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, message: { error: "Забагато запитів з файлами" } });
export const feedbackLimiter = rateLimit({ windowMs: 60 * 1000, max: 3, message: { error: "Забагато повідомлень" } });

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});
