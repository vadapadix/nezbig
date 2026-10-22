import crypto from "node:crypto";
import { redis } from "./redisClient.js";
import { User } from "../../domain/users/User.js";
import type { UserRecord, NewUserData } from "../../domain/users/types/User.js";
import type { UserRepository } from "../../domain/users/ports/UserRepository.js";
import fs from "fs";
import path from "path";
import os from "os";
export class PersistentUserRepository implements UserRepository {
  // ---------- In-memory & Persistent Storage ----------
  private readonly memoryUsers = new Map<string, UserRecord>();
  private readonly memoryEmailIndex = new Map<string, string>(); // email -> userId
  private readonly memoryGoogleIndex = new Map<string, string>(); // googleId -> userId

  private getUserStorageDir(): string {
    const candidateDirs = [
      ...(process.env.NEZBIG_DATA_DIR ? [path.resolve(process.env.NEZBIG_DATA_DIR, "users")] : []),
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

  private saveUserToFile(user: UserRecord): void {
    try {
      const dir = this.getUserStorageDir();
      fs.writeFileSync(path.join(dir, `${user.id}.json`), JSON.stringify(user), "utf-8");
    } catch {
      // ignore
    }
  }

  private loadUserFromFile(userId: string): UserRecord | null {
    try {
      const dir = this.getUserStorageDir();
      const filePath = path.join(dir, `${userId}.json`);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        const stored = JSON.parse(data) as UserRecord;
        return { ...stored, passwordHash: stored.passwordHash ?? null };
      }
    } catch {
      // ignore
    }
    return null;
  }

  private scanUsersFromFile(): UserRecord[] {
    try {
      const dir = this.getUserStorageDir();
      if (!fs.existsSync(dir)) return [];
      const files = fs.readdirSync(dir);
      const users: UserRecord[] = [];
      for (const file of files) {
        if (file.endsWith(".json")) {
          const u = this.loadUserFromFile(file.replace(".json", ""));
          if (u) users.push(u);
        }
      }
      return users;
    } catch {
      return [];
    }
  }

  // ---------- User CRUD ----------

  async create(data: NewUserData): Promise<UserRecord> {
    const user = User.create(data, crypto.randomUUID(), new Date().toISOString()).toRecord();
    const id = user.id;

    // Memory
    this.memoryUsers.set(id, user);
    this.memoryEmailIndex.set(user.email, id);
    if (user.googleId) {
      this.memoryGoogleIndex.set(user.googleId, id);
    }

    // File
    this.saveUserToFile(user);

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

  async findById(id: string): Promise<UserRecord | null> {
    // 1. Memory
    if (this.memoryUsers.has(id)) return this.memoryUsers.get(id)!;

    // 2. File
    const fileUser = this.loadUserFromFile(id);
    if (fileUser) {
      this.memoryUsers.set(id, fileUser);
      this.memoryEmailIndex.set(fileUser.email, id);
      if (fileUser.googleId) this.memoryGoogleIndex.set(fileUser.googleId, id);
      return fileUser;
    }

    // 3. Redis
    if (redis && redis.status === "ready") {
      try {
        const data = await redis.get(`user:${id}`);
        if (data) {
          const parsed = JSON.parse(data) as UserRecord;
          const user = { ...parsed, passwordHash: parsed.passwordHash ?? null };
          this.memoryUsers.set(id, user);
          return user;
        }
      } catch {
        // ignore
      }
    }

    return null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalizedEmail = email.toLowerCase();

    // 1. Memory index
    const userId = this.memoryEmailIndex.get(normalizedEmail);
    if (userId) {
      const user = await this.findById(userId);
      if (user) return user;
    }

    // 2. File search
    const diskUsers = this.scanUsersFromFile();
    const matched = diskUsers.find((u) => u.email === normalizedEmail);
    if (matched) {
      this.memoryUsers.set(matched.id, matched);
      this.memoryEmailIndex.set(normalizedEmail, matched.id);
      if (matched.googleId) this.memoryGoogleIndex.set(matched.googleId, matched.id);
      return matched;
    }

    // 3. Redis
    if (redis && redis.status === "ready") {
      try {
        const rUserId = await redis.get(`user:email:${normalizedEmail}`);
        if (rUserId) return this.findById(rUserId);
      } catch {
        // ignore
      }
    }

    return null;
  }

  async findByGoogleId(googleId: string): Promise<UserRecord | null> {
    // 1. Memory index
    const userId = this.memoryGoogleIndex.get(googleId);
    if (userId) {
      const user = await this.findById(userId);
      if (user) return user;
    }

    // 2. File search
    const diskUsers = this.scanUsersFromFile();
    const matched = diskUsers.find((u) => u.googleId === googleId);
    if (matched) {
      this.memoryUsers.set(matched.id, matched);
      this.memoryEmailIndex.set(matched.email, matched.id);
      this.memoryGoogleIndex.set(googleId, matched.id);
      return matched;
    }

    // 3. Redis
    if (redis && redis.status === "ready") {
      try {
        const rUserId = await redis.get(`user:google:${googleId}`);
        if (rUserId) return this.findById(rUserId);
      } catch {
        // ignore
      }
    }

    return null;
  }

  async update(id: string, updates: Partial<UserRecord>): Promise<UserRecord | null> {
    const user = await this.findById(id);
    if (!user) return null;

    const updated: UserRecord = { ...user, ...updates };

    // Memory
    this.memoryUsers.set(id, updated);
    if (updates.email) this.memoryEmailIndex.set(updates.email.toLowerCase(), id);
    if (updates.googleId) this.memoryGoogleIndex.set(updates.googleId, id);

    // File
    this.saveUserToFile(updated);

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
}
