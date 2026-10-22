import { Redis } from "ioredis";
// ---------- Redis Connection (Tier 1) ----------
const redisUrl = process.env.REDIS_URL;
export const redis = redisUrl ? new Redis(redisUrl) : null;

if (redis) {
  redis.on("error", (err: unknown) => console.error("[Redis] Error:", err));
  console.log("[Redis] Connected for History & Cache");
}

