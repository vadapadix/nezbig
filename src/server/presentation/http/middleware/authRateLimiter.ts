import { rateLimit } from "express-rate-limit";
export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, message: { error: "Забагато спроб входу. Спробуйте пізніше." } });
