import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";

export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET?.trim();
  const placeholder = !secret || /change|your-secret|dev-secret/i.test(secret);
  if (env.NODE_ENV === "production" && (placeholder || secret.length < 32)) {
    throw new Error("Set JWT_SECRET to a random secret of at least 32 characters before production startup.");
  }
  return placeholder ? crypto.randomBytes(48).toString("hex") : secret;
}

export const jwtSecret = resolveJwtSecret();
export const secureCookies = () => process.env.NODE_ENV === "production";
export const cookieOptions = () => ({ httpOnly: true, secure: secureCookies(), sameSite: "lax" as const, path: "/" });

export function clientOrigins(): string[] {
  const configured = [process.env.CLIENT_URL, ...(process.env.AUTH_ALLOWED_ORIGINS || "").split(",")].filter(Boolean) as string[];
  if (process.env.NODE_ENV !== "production") configured.push("http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:8787", "http://127.0.0.1:4173");
  return [...new Set(configured.map((value) => {
    const url = new URL(value.trim());
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid client origin");
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Production client origins require HTTPS");
    return url.origin;
  }))];
}

export function beginGoogleOAuth(req: Request, res: Response): string {
  const origins = clientOrigins();
  const origin = typeof req.query.origin === "string" ? req.query.origin : origins[0];
  if (!origin || !origins.includes(origin)) throw new Error("Недозволена адреса повернення.");
  const nonce = crypto.randomBytes(32).toString("hex");
  res.cookie("nezbig_oauth_state", nonce, { ...cookieOptions(), maxAge: 10 * 60 * 1000 });
  return jwt.sign({ origin, nonce }, jwtSecret, { audience: "google-oauth-state", expiresIn: "10m", algorithm: "HS256" });
}

export function consumeGoogleOAuth(req: Request, res: Response): string | null {
  res.clearCookie("nezbig_oauth_state", cookieOptions());
  try {
    if (typeof req.query.state !== "string" || typeof req.cookies?.nezbig_oauth_state !== "string") return null;
    const state = jwt.verify(req.query.state, jwtSecret, { audience: "google-oauth-state", algorithms: ["HS256"] });
    if (typeof state === "string" || typeof state.nonce !== "string" || typeof state.origin !== "string") return null;
    const received = Buffer.from(req.cookies.nezbig_oauth_state);
    const expected = Buffer.from(state.nonce);
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected) || !clientOrigins().includes(state.origin)) return null;
    return state.origin;
  } catch { return null; }
}

// Guest job IDs are not credentials. The signed cookie binds polling to the browser that submitted the job.
export function scanPrincipal(req: Request, res: Response): string {
  if (req.user) return `user:${req.user.id}`;
  try {
    const payload = jwt.verify(req.cookies?.nezbig_guest || "", jwtSecret, { audience: "scan-guest", algorithms: ["HS256"] });
    if (typeof payload !== "string" && typeof payload.id === "string") return `guest:${payload.id}`;
  } catch { /* create a fresh guest session */ }
  const id = crypto.randomUUID();
  res.cookie("nezbig_guest", jwt.sign({ id }, jwtSecret, { audience: "scan-guest", expiresIn: "2h", algorithm: "HS256" }), { ...cookieOptions(), maxAge: 2 * 60 * 60 * 1000 });
  return `guest:${id}`;
}
