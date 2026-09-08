import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { redis } from "./db.js";

// ---------- Types ----------
export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash?: string; // absent for Google-only users
  googleId?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthPayload {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

// ---------- Config ----------
const JWT_SECRET = process.env.JWT_SECRET || "nezbig-dev-secret-change-me-in-prod";
const JWT_EXPIRES = "30d";
const COOKIE_NAME = "nezbig_token";
const SALT_ROUNDS = 10;

// ---------- In-memory fallback ----------
const memoryUsers = new Map<string, User>();
const memoryEmailIndex = new Map<string, string>(); // email -> userId
const memoryGoogleIndex = new Map<string, string>(); // googleId -> userId

// ---------- User CRUD ----------

export async function createUser(data: {
  name: string;
  email: string;
  password?: string;
  googleId?: string;
  avatarUrl?: string;
}): Promise<User> {
  const id = crypto.randomUUID();
  const user: User = {
    id,
    name: data.name,
    email: data.email.toLowerCase(),
    passwordHash: data.password ? await bcrypt.hash(data.password, SALT_ROUNDS) : undefined,
    googleId: data.googleId,
    avatarUrl: data.avatarUrl,
    createdAt: new Date().toISOString(),
  };

  if (redis) {
    const pipeline = redis.pipeline();
    pipeline.set(`user:${id}`, JSON.stringify(user));
    pipeline.set(`user:email:${user.email}`, id);
    if (user.googleId) {
      pipeline.set(`user:google:${user.googleId}`, id);
    }
    await pipeline.exec();
  } else {
    memoryUsers.set(id, user);
    memoryEmailIndex.set(user.email, id);
    if (user.googleId) {
      memoryGoogleIndex.set(user.googleId, id);
    }
  }

  return user;
}

export async function findUserById(id: string): Promise<User | null> {
  if (redis) {
    const data = await redis.get(`user:${id}`);
    return data ? (JSON.parse(data) as User) : null;
  }
  return memoryUsers.get(id) || null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase();
  if (redis) {
    const userId = await redis.get(`user:email:${normalizedEmail}`);
    if (!userId) return null;
    return findUserById(userId);
  }
  const userId = memoryEmailIndex.get(normalizedEmail);
  return userId ? memoryUsers.get(userId) || null : null;
}

export async function findUserByGoogleId(googleId: string): Promise<User | null> {
  if (redis) {
    const userId = await redis.get(`user:google:${googleId}`);
    if (!userId) return null;
    return findUserById(userId);
  }
  const userId = memoryGoogleIndex.get(googleId);
  return userId ? memoryUsers.get(userId) || null : null;
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
  const user = await findUserById(id);
  if (!user) return null;

  const updated = { ...user, ...updates };

  if (redis) {
    await redis.set(`user:${id}`, JSON.stringify(updated));
    if (updates.googleId) {
      await redis.set(`user:google:${updates.googleId}`, id);
    }
  } else {
    memoryUsers.set(id, updated);
    if (updates.googleId) {
      memoryGoogleIndex.set(updates.googleId, id);
    }
  }

  return updated;
}

// ---------- Password ----------

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  if (!user.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

// ---------- JWT ----------

export function generateToken(user: User): string {
  const payload: AuthPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

// ---------- Cookie helpers ----------

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: "/",
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

// ---------- Middleware ----------

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  let token = req.cookies?.[COOKIE_NAME];
  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.slice(7).trim();
  }
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  next();
}

// ---------- Per-user history ----------

export async function saveUserReport(userId: string, reportId: string): Promise<void> {
  if (redis) {
    try {
      await redis.zadd(`user:history:${userId}`, Date.now(), reportId);
      // Keep max 100 reports per user, trim older ones
      await redis.zremrangebyrank(`user:history:${userId}`, 0, -101);
    } catch (err) {
      console.error("[Redis] saveUserReport error:", err);
    }
  }
}

export async function getUserReportIds(userId: string, limit = 20): Promise<string[]> {
  if (redis) {
    try {
      const ids = await redis.zrevrange(`user:history:${userId}`, 0, limit - 1);
      if (ids && ids.length > 0) return ids;
    } catch (err) {
      console.error("[Redis] getUserReportIds error:", err);
    }
  }
  return [];
}
