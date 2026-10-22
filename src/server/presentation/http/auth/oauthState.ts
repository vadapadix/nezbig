import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { jwtSecret } from "../../../infrastructure/auth/jwtConfig.js";
import { clientOrigins } from "../../../infrastructure/config/clientOrigins.js";
import { cookieOptions } from "./cookieOptions.js";
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
  } catch {
    return null;
  }
}
