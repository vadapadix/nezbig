import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { jwtSecret } from "../../../infrastructure/auth/jwtConfig.js";
import { cookieOptions } from "./cookieOptions.js";
// Guest job IDs are not credentials. The signed cookie binds polling to the browser that submitted the job.
export function scanPrincipal(req: Request, res: Response): string {
  if (req.user) return `user:${req.user.id}`;
  try {
    const payload = jwt.verify(req.cookies?.nezbig_guest || "", jwtSecret, { audience: "scan-guest", algorithms: ["HS256"] });
    if (typeof payload !== "string" && typeof payload.id === "string") return `guest:${payload.id}`;
  } catch {
    /* create a fresh guest session */
  }
  const id = crypto.randomUUID();
  res.cookie("nezbig_guest", jwt.sign({ id }, jwtSecret, { audience: "scan-guest", expiresIn: "2h", algorithm: "HS256" }), { ...cookieOptions(), maxAge: 2 * 60 * 60 * 1000 });
  return `guest:${id}`;
}
