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

import fs from "fs";
import path from "path";
import os from "os";

// ---------- In-memory & Persistent Storage ----------
const memoryUsers = new Map<string, User>();
const memoryEmailIndex = new Map<string, string>(); // email -> userId
const memoryGoogleIndex = new Map<string, string>(); // googleId -> userId

function getUserStorageDir(): string {
  const candidateDirs = [
    path.resolve(process.cwd(), ".nezbig-data", "users"),
    path.resolve(os.tmpdir(), "nezbig-data", "users")
  ];
  for (const dir of candidateDirs) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      return dir;
    } catch {
      // try next
    }
  }
  return path.resolve(os.tmpdir(), "nezbig-data", "users");
}

function saveUserToFile(user: User): void {
  try {
    const dir = getUserStorageDir();
    fs.writeFileSync(path.join(dir, `${user.id}.json`), JSON.stringify(user), "utf-8");
  } catch {
    // ignore
  }
}

function loadUserFromFile(userId: string): User | null {
  try {
    const dir = getUserStorageDir();
    const filePath = path.join(dir, `${userId}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data) as User;
    }
  } catch {
    // ignore
  }
  return null;
}

function scanUsersFromFile(): User[] {
  try {
    const dir = getUserStorageDir();
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir);
    const users: User[] = [];
    for (const file of files) {
      if (file.endsWith(".json")) {
        const u = loadUserFromFile(file.replace(".json", ""));
        if (u) users.push(u);
      }
    }
    return users;
  } catch {
    return [];
  }
}

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

  // Memory
  memoryUsers.set(id, user);
  memoryEmailIndex.set(user.email, id);
  if (user.googleId) {
    memoryGoogleIndex.set(user.googleId, id);
  }

  // File
  saveUserToFile(user);

  // Redis
  if (redis && redis.status === "ready") {
    try {
      const pipeline = redis.pipeline();
      pipeline.set(`user:${id}`, JSON.stringify(user));
      pipeline.set(`user:email:${user.email}`, id);
      if (user.googleId) {
        pipeline.set(`user:google:${user.googleId}`, id);
      }
      await pipeline.exec();
    } catch {
      // ignore
    }
  }

  return user;
}

export async function findUserById(id: string): Promise<User | null> {
  // 1. Memory
  if (memoryUsers.has(id)) return memoryUsers.get(id)!;

  // 2. File
  const fileUser = loadUserFromFile(id);
  if (fileUser) {
    memoryUsers.set(id, fileUser);
    memoryEmailIndex.set(fileUser.email, id);
    if (fileUser.googleId) memoryGoogleIndex.set(fileUser.googleId, id);
    return fileUser;
  }

  // 3. Redis
  if (redis && redis.status === "ready") {
    try {
      const data = await redis.get(`user:${id}`);
      if (data) {
        const user = JSON.parse(data) as User;
        memoryUsers.set(id, user);
        return user;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase();

  // 1. Memory index
  const userId = memoryEmailIndex.get(normalizedEmail);
  if (userId) {
    const user = await findUserById(userId);
    if (user) return user;
  }

  // 2. File search
  const diskUsers = scanUsersFromFile();
  const matched = diskUsers.find((u) => u.email === normalizedEmail);
  if (matched) {
    memoryUsers.set(matched.id, matched);
    memoryEmailIndex.set(normalizedEmail, matched.id);
    if (matched.googleId) memoryGoogleIndex.set(matched.googleId, matched.id);
    return matched;
  }

  // 3. Redis
  if (redis && redis.status === "ready") {
    try {
      const rUserId = await redis.get(`user:email:${normalizedEmail}`);
      if (rUserId) return findUserById(rUserId);
    } catch {
      // ignore
    }
  }

  return null;
}

export async function findUserByGoogleId(googleId: string): Promise<User | null> {
  // 1. Memory index
  const userId = memoryGoogleIndex.get(googleId);
  if (userId) {
    const user = await findUserById(userId);
    if (user) return user;
  }

  // 2. File search
  const diskUsers = scanUsersFromFile();
  const matched = diskUsers.find((u) => u.googleId === googleId);
  if (matched) {
    memoryUsers.set(matched.id, matched);
    memoryEmailIndex.set(matched.email, matched.id);
    memoryGoogleIndex.set(googleId, matched.id);
    return matched;
  }

  // 3. Redis
  if (redis && redis.status === "ready") {
    try {
      const rUserId = await redis.get(`user:google:${googleId}`);
      if (rUserId) return findUserById(rUserId);
    } catch {
      // ignore
    }
  }

  return null;
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
  const user = await findUserById(id);
  if (!user) return null;

  const updated: User = { ...user, ...updates };

  // Memory
  memoryUsers.set(id, updated);
  if (updates.email) memoryEmailIndex.set(updates.email.toLowerCase(), id);
  if (updates.googleId) memoryGoogleIndex.set(updates.googleId, id);

  // File
  saveUserToFile(updated);

  // Redis
  if (redis && redis.status === "ready") {
    try {
      await redis.set(`user:${id}`, JSON.stringify(updated));
      if (updates.googleId) {
        await redis.set(`user:google:${updates.googleId}`, id);
      }
      if (updates.email) {
        await redis.set(`user:email:${updates.email.toLowerCase()}`, id);
      }
    } catch {
      // ignore
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
  const isHttps = process.env.NODE_ENV === "production" && process.env.VERCEL === "1";
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
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
  // 1. Try Bearer header first (most specific from explicit client API call)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken) {
      const payload = verifyToken(bearerToken);
      if (payload) {
        req.user = payload;
        return next();
      }
    }
  }

  // 2. Try cookie (browser navigation or requests with cookies)
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) {
    const payload = verifyToken(cookieToken);
    if (payload) {
      req.user = payload;
      return next();
    }
  }

  next();
}

// ---------- Per-user history (delegated to multi-tier db.ts) ----------

export {
  saveUserReport,
  getUserReports,
  deleteUserReport,
  clearUserHistory,
  syncUserReports,
} from "./db.js";

export async function getUserReportIds(userId: string, limit = 20): Promise<string[]> {
  const { getUserReports } = await import("./db.js");
  const reports = await getUserReports(userId, limit);
  return reports.map((r) => r.id);
}
