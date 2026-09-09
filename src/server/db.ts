import fs from "fs";
import path from "path";
import os from "os";
import { Redis } from "ioredis";
import { kv } from "@vercel/kv";
import type { ScanReport, UserScanHistoryItem } from "../shared/types.js";

// ---------- Redis Connection (Tier 1) ----------
const redisUrl = process.env.REDIS_URL;
export const redis = redisUrl ? new Redis(redisUrl) : null;

if (redis) {
  redis.on("error", (err: unknown) => console.error("[Redis] Error:", err));
  console.log("[Redis] Connected for History & Cache");
}

// ---------- Vercel KV Check (Tier 2) ----------
const isKvEnabled = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

// ---------- Persistent File Storage (Tier 3) ----------
let fileStorageDir: string | null = null;

function getFileStorageDir(): string {
  if (fileStorageDir) return fileStorageDir;

  const candidateDirs = [
    path.resolve(process.cwd(), ".nezbig-data"),
    path.resolve(os.tmpdir(), "nezbig-data")
  ];

  for (const dir of candidateDirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Test writability
      const testFile = path.join(dir, `.write-test-${Date.now()}`);
      fs.writeFileSync(testFile, "ok");
      fs.unlinkSync(testFile);

      const reportsDir = path.join(dir, "reports");
      if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

      const userHistDir = path.join(dir, "user-history");
      if (!fs.existsSync(userHistDir)) fs.mkdirSync(userHistDir, { recursive: true });

      fileStorageDir = dir;
      return fileStorageDir;
    } catch {
      // Try next candidate directory
    }
  }

  // Final fallback to tmpdir
  fileStorageDir = path.resolve(os.tmpdir(), "nezbig-data");
  try {
    fs.mkdirSync(path.join(fileStorageDir, "reports"), { recursive: true });
    fs.mkdirSync(path.join(fileStorageDir, "user-history"), { recursive: true });
  } catch {
    // ignore
  }
  return fileStorageDir;
}

// ---------- In-Memory Fallback (Tier 4) ----------
const memoryReports = new Map<string, ScanReport>();
const memoryUserHistory = new Map<string, UserScanHistoryItem[]>();

// ---------- Helper: Read/Write JSON safely ----------
function readJsonFile<T>(filePath: string): T | null {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data) as T;
    }
  } catch {
    // ignore
  }
  return null;
}

function writeJsonFile<T>(filePath: string, data: T): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data), "utf-8");
  } catch {
    // ignore file write errors on read-only environments
  }
}

// ---------- Reports Storage ----------

export async function saveReport(reportId: string, report: ScanReport): Promise<void> {
  // Tier 4: Memory
  memoryReports.set(reportId, report);

  // Tier 3: File
  try {
    const dir = getFileStorageDir();
    const filePath = path.join(dir, "reports", `${reportId}.json`);
    writeJsonFile(filePath, report);
  } catch {
    // ignore
  }

  // Tier 2: Vercel KV
  if (isKvEnabled) {
    try {
      await kv.set(`history:${reportId}`, JSON.stringify(report), { ex: 60 * 60 * 24 * 30 });
      await kv.zadd("history:index", { score: Date.now(), member: reportId });
    } catch (err) {
      console.error("[KV] saveReport error:", err);
    }
  }

  // Tier 1: Redis
  if (redis && redis.status === "ready") {
    try {
      await redis.set(`history:${reportId}`, JSON.stringify(report), "EX", 60 * 60 * 24 * 30);
      await redis.zadd("history:index", Date.now(), reportId);
      await redis.expire("history:index", 60 * 60 * 24 * 30);
    } catch (err) {
      console.error("[Redis] saveReport error:", err);
    }
  }
}

export async function getReport(reportId: string): Promise<ScanReport | null> {
  // Tier 4: Memory
  if (memoryReports.has(reportId)) {
    return memoryReports.get(reportId)!;
  }

  // Tier 3: File
  try {
    const dir = getFileStorageDir();
    const filePath = path.join(dir, "reports", `${reportId}.json`);
    const fileReport = readJsonFile<ScanReport>(filePath);
    if (fileReport) {
      memoryReports.set(reportId, fileReport);
      return fileReport;
    }
  } catch {
    // ignore
  }

  // Tier 2: Vercel KV
  if (isKvEnabled) {
    try {
      const data = await kv.get<string | ScanReport>(`history:${reportId}`);
      if (data) {
        const report = typeof data === "string" ? (JSON.parse(data) as ScanReport) : data;
        memoryReports.set(reportId, report);
        return report;
      }
    } catch (err) {
      console.error("[KV] getReport error:", err);
    }
  }

  // Tier 1: Redis
  if (redis && redis.status === "ready") {
    try {
      const data = await redis.get(`history:${reportId}`);
      if (data) {
        const report = JSON.parse(data) as ScanReport;
        memoryReports.set(reportId, report);
        return report;
      }
    } catch (err) {
      console.error("[Redis] getReport error:", err);
    }
  }

  return null;
}

// ---------- User History Storage ----------

export async function getUserReports(userId: string, limit = 100): Promise<UserScanHistoryItem[]> {
  // 1. Memory check
  let list = memoryUserHistory.get(userId);

  // 2. File check
  if (!list || list.length === 0) {
    try {
      const dir = getFileStorageDir();
      const filePath = path.join(dir, "user-history", `${userId}.json`);
      const fileData = readJsonFile<UserScanHistoryItem[]>(filePath);
      if (fileData && Array.isArray(fileData)) {
        list = fileData;
        memoryUserHistory.set(userId, list);
      }
    } catch {
      // ignore
    }
  }

  // 3. Vercel KV check
  if ((!list || list.length === 0) && isKvEnabled) {
    try {
      const ids = await kv.zrange<string[]>(`user:history:${userId}`, 0, limit - 1, { rev: true });
      if (ids && ids.length > 0) {
        const items: UserScanHistoryItem[] = [];
        for (const id of ids) {
          const report = await getReport(id);
          if (report) {
            items.push({
              id: report.id,
              fileName: report.fileName,
              checkedAt: report.checkedAt,
              plagiarismScore: report.plagiarismScore,
              wordCount: report.wordCount,
              aiProbability: report.aiProbability,
            });
          }
        }
        if (items.length > 0) {
          list = items;
          memoryUserHistory.set(userId, list);
        }
      }
    } catch (err) {
      console.error("[KV] getUserReports error:", err);
    }
  }

  // 4. Redis check
  if ((!list || list.length === 0) && redis && redis.status === "ready") {
    try {
      const ids = await redis.zrevrange(`user:history:${userId}`, 0, limit - 1);
      if (ids && ids.length > 0) {
        const items: UserScanHistoryItem[] = [];
        for (const id of ids) {
          const report = await getReport(id);
          if (report) {
            items.push({
              id: report.id,
              fileName: report.fileName,
              checkedAt: report.checkedAt,
              plagiarismScore: report.plagiarismScore,
              wordCount: report.wordCount,
              aiProbability: report.aiProbability,
            });
          }
        }
        if (items.length > 0) {
          list = items;
          memoryUserHistory.set(userId, list);
        }
      }
    } catch (err) {
      console.error("[Redis] getUserReports error:", err);
    }
  }

  return (list || []).slice(0, limit);
}

export async function saveUserReport(
  userId: string,
  reportId: string,
  summary?: Partial<UserScanHistoryItem>
): Promise<void> {
  const current = await getUserReports(userId, 100);

  let newItem: UserScanHistoryItem;
  if (summary?.fileName && summary.checkedAt && summary.plagiarismScore !== undefined) {
    newItem = {
      id: reportId,
      fileName: summary.fileName,
      checkedAt: summary.checkedAt,
      plagiarismScore: summary.plagiarismScore,
      wordCount: summary.wordCount,
      aiProbability: summary.aiProbability,
    };
  } else {
    const report = await getReport(reportId);
    newItem = {
      id: reportId,
      fileName: report?.fileName || "Документ",
      checkedAt: report?.checkedAt || new Date().toISOString(),
      plagiarismScore: report?.plagiarismScore ?? 0,
      wordCount: report?.wordCount,
      aiProbability: report?.aiProbability,
    };
  }

  // Deduplicate and prepend
  const updated = [newItem, ...current.filter((item) => item.id !== reportId)].slice(0, 100);

  // 1. Memory
  memoryUserHistory.set(userId, updated);

  // 2. File
  try {
    const dir = getFileStorageDir();
    const filePath = path.join(dir, "user-history", `${userId}.json`);
    writeJsonFile(filePath, updated);
  } catch {
    // ignore
  }

  // 3. Vercel KV
  if (isKvEnabled) {
    try {
      await kv.zadd(`user:history:${userId}`, { score: Date.now(), member: reportId });
      await kv.zremrangebyrank(`user:history:${userId}`, 0, -101);
    } catch (err) {
      console.error("[KV] saveUserReport error:", err);
    }
  }

  // 4. Redis
  if (redis && redis.status === "ready") {
    try {
      await redis.zadd(`user:history:${userId}`, Date.now(), reportId);
      await redis.zremrangebyrank(`user:history:${userId}`, 0, -101);
    } catch (err) {
      console.error("[Redis] saveUserReport error:", err);
    }
  }
}

export async function deleteUserReport(userId: string, reportId: string): Promise<void> {
  const current = await getUserReports(userId, 100);
  const updated = current.filter((item) => item.id !== reportId);

  // 1. Memory
  memoryUserHistory.set(userId, updated);

  // 2. File
  try {
    const dir = getFileStorageDir();
    const filePath = path.join(dir, "user-history", `${userId}.json`);
    writeJsonFile(filePath, updated);
  } catch {
    // ignore
  }

  // 3. Vercel KV
  if (isKvEnabled) {
    try {
      await kv.zrem(`user:history:${userId}`, reportId);
    } catch (err) {
      console.error("[KV] deleteUserReport error:", err);
    }
  }

  // 4. Redis
  if (redis && redis.status === "ready") {
    try {
      await redis.zrem(`user:history:${userId}`, reportId);
    } catch (err) {
      console.error("[Redis] deleteUserReport error:", err);
    }
  }
}

export async function clearUserHistory(userId: string): Promise<void> {
  // 1. Memory
  memoryUserHistory.set(userId, []);

  // 2. File
  try {
    const dir = getFileStorageDir();
    const filePath = path.join(dir, "user-history", `${userId}.json`);
    writeJsonFile(filePath, []);
  } catch {
    // ignore
  }

  // 3. Vercel KV
  if (isKvEnabled) {
    try {
      await kv.del(`user:history:${userId}`);
    } catch (err) {
      console.error("[KV] clearUserHistory error:", err);
    }
  }

  // 4. Redis
  if (redis && redis.status === "ready") {
    try {
      await redis.del(`user:history:${userId}`);
    } catch (err) {
      console.error("[Redis] clearUserHistory error:", err);
    }
  }
}

export async function syncUserReports(
  userId: string,
  clientItems: UserScanHistoryItem[]
): Promise<UserScanHistoryItem[]> {
  const existing = await getUserReports(userId, 100);
  const existingIds = new Set(existing.map((item) => item.id));

  // Save any full reports passed from client
  for (const item of clientItems) {
    if (item.fullReport && item.id) {
      await saveReport(item.id, item.fullReport);
    }
  }

  // Merge client items with server items
  const combined: UserScanHistoryItem[] = [...existing];
  for (const item of clientItems) {
    if (item.id && !existingIds.has(item.id)) {
      existingIds.add(item.id);
      combined.push({
        id: item.id,
        fileName: item.fileName,
        checkedAt: item.checkedAt || new Date().toISOString(),
        plagiarismScore: item.plagiarismScore ?? 0,
        wordCount: item.wordCount,
        aiProbability: item.aiProbability,
      });
    }
  }

  // Sort newest first
  combined.sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
  const trimmed = combined.slice(0, 100);

  // 1. Memory
  memoryUserHistory.set(userId, trimmed);

  // 2. File
  try {
    const dir = getFileStorageDir();
    const filePath = path.join(dir, "user-history", `${userId}.json`);
    writeJsonFile(filePath, trimmed);
  } catch {
    // ignore
  }

  // 3. Vercel KV
  if (isKvEnabled) {
    try {
      for (const item of trimmed) {
        await kv.zadd(`user:history:${userId}`, { score: new Date(item.checkedAt).getTime(), member: item.id });
      }
    } catch (err) {
      console.error("[KV] syncUserReports error:", err);
    }
  }

  // 4. Redis
  if (redis && redis.status === "ready") {
    try {
      for (const item of trimmed) {
        await redis.zadd(`user:history:${userId}`, new Date(item.checkedAt).getTime(), item.id);
      }
    } catch (err) {
      console.error("[Redis] syncUserReports error:", err);
    }
  }

  return trimmed;
}

