import type { StoredReport } from "../../types/ReportRepository.types.js";
export type { StoredReport } from "../../types/ReportRepository.types.js";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "node:crypto";
import { invalidatePrincipalReports } from "../cache/jobStore.js";
import { kv } from "@vercel/kv";
import type { ScanReport, UserScanHistoryItem } from "../../../shared/types/index.js";

import { redis } from "./redisClient.js";
// ---------- Vercel KV Check (Tier 2) ----------
const isKvEnabled = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

// ---------- Persistent File Storage (Tier 3) ----------
let fileStorageDir: string | null = null;

function getFileStorageDir(): string {
  if (fileStorageDir) return fileStorageDir;

  const candidateDirs = [
    ...(process.env.NEZBIG_DATA_DIR ? [path.resolve(process.env.NEZBIG_DATA_DIR)] : []),
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
export const isStorageId = (id: string): boolean => /^[a-zA-Z0-9_-]{1,128}$/.test(id);
const reportLocks = new Map<string, Promise<unknown>>();

async function withReportLock<T>(id: string, action: () => Promise<T>): Promise<T> {
  const previous = reportLocks.get(id) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(action);
  reportLocks.set(id, current);
  try {
    return await current;
  } finally {
    if (reportLocks.get(id) === current) reportLocks.delete(id);
  }
}

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
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(temporary, filePath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

// ---------- Reports Storage ----------

export class ReportRepository {
  async saveReport(reportId: string, report: ScanReport, ownerId?: string, existingOnly = false): Promise<boolean> {
    if (!isStorageId(reportId)) throw new Error("Invalid report ID");
    const previous = (await this.getReport(reportId)) as StoredReport | null;
    if (existingOnly && !previous) return false;
    if (previous?.ownerId && previous.ownerId !== ownerId) throw new Error("Report owner mismatch");
    const { ownerId: _untrustedOwner, ...content } = report as StoredReport;
    const stored = { ...content, id: reportId, ...(ownerId ? { ownerId } : {}) };
    const key = `history:${reportId}`;
    // A configured remote store is authoritative. Never fall back to a stale local replica after deletion.
    if (redis) {
      const result = existingOnly
        ? await redis.set(key, JSON.stringify(stored), "EX", 60 * 60 * 24 * 30, "XX")
        : await redis.set(key, JSON.stringify(stored), "EX", 60 * 60 * 24 * 30);
      if (!result) return false;
      await redis.zadd("history:index", Date.now(), reportId);
      return true;
    }
    if (isKvEnabled) {
      const result = existingOnly
        ? await kv.set(key, JSON.stringify(stored), { ex: 60 * 60 * 24 * 30, xx: true })
        : await kv.set(key, JSON.stringify(stored), { ex: 60 * 60 * 24 * 30 });
      if (!result) return false;
      await kv.zadd("history:index", { score: Date.now(), member: reportId });
      return true;
    }
    const filePath = path.join(getFileStorageDir(), "reports", `${reportId}.json`);
    const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(stored), { mode: 0o600 });
      fs.renameSync(temporary, filePath);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
    return true;
  }

  async getReport(reportId: string): Promise<ScanReport | null> {
    if (!isStorageId(reportId)) return null;
    if (redis) {
      const data = await redis.get(`history:${reportId}`);
      return data ? (JSON.parse(data) as ScanReport) : null;
    }
    if (isKvEnabled) {
      const data = await kv.get<string | ScanReport>(`history:${reportId}`);
      return typeof data === "string" ? (JSON.parse(data) as ScanReport) : data;
    }
    return readJsonFile<ScanReport>(path.join(getFileStorageDir(), "reports", `${reportId}.json`));
  }

  // ---------- User History Storage ----------

  async getUserReports(userId: string, limit = 100): Promise<UserScanHistoryItem[]> {
    if (!isStorageId(userId)) return [];
    if (redis || isKvEnabled) {
      const ids = redis ? await redis.zrevrange(`user:history:${userId}`, 0, limit - 1) : await kv.zrange<string[]>(`user:history:${userId}`, 0, limit - 1, { rev: true });
      const items: UserScanHistoryItem[] = [];
      for (const id of ids) {
        const report = (await this.getReport(id)) as StoredReport | null;
        if (report && (!report.ownerId || report.ownerId === userId))
          items.push({
            id,
            fileName: report.fileName,
            checkedAt: report.checkedAt,
            plagiarismScore: report.plagiarismScore,
            wordCount: report.wordCount,
            aiProbability: report.aiProbability
          });
      }
      return items;
    }
    const filePath = path.join(getFileStorageDir(), "user-history", `${userId}.json`);
    return (readJsonFile<UserScanHistoryItem[]>(filePath) || []).slice(0, limit);
  }

  async saveUserReport(userId: string, reportId: string, summary?: Partial<UserScanHistoryItem>): Promise<void> {
    return withReportLock(`user:${userId}`, () => this.storeUserReport(userId, reportId, summary));
  }

  async storeUserReport(userId: string, reportId: string, summary?: Partial<UserScanHistoryItem>): Promise<void> {
    if (!isStorageId(userId) || !isStorageId(reportId)) throw new Error("Invalid storage ID");
    const stored = (await this.getReport(reportId)) as StoredReport | null;
    if (stored?.ownerId && stored.ownerId !== userId) throw new Error("Report owner mismatch");
    if (stored && !stored.ownerId) await this.saveReport(reportId, stored, userId);
    const current = await this.getUserReports(userId, 100);

    let newItem: UserScanHistoryItem;
    if (summary?.fileName && summary.checkedAt && summary.plagiarismScore !== undefined) {
      newItem = {
        id: reportId,
        fileName: summary.fileName,
        checkedAt: summary.checkedAt,
        plagiarismScore: summary.plagiarismScore,
        wordCount: summary.wordCount,
        aiProbability: summary.aiProbability
      };
    } else {
      const report = await this.getReport(reportId);
      newItem = {
        id: reportId,
        fileName: report?.fileName || "Документ",
        checkedAt: report?.checkedAt || new Date().toISOString(),
        plagiarismScore: report?.plagiarismScore ?? 0,
        wordCount: report?.wordCount,
        aiProbability: report?.aiProbability
      };
    }

    // Deduplicate and prepend
    const updated = [newItem, ...current.filter((item) => item.id !== reportId)].slice(0, 100);
    for (const item of current) {
      if (!updated.some((kept) => kept.id === item.id) && (await this.getOwnedReport(userId, item.id))) {
        await this.deleteReport(item.id);
        invalidatePrincipalReports(`user:${userId}`);
      }
    }

    // Remote stores are authoritative; local deployments persist an atomic history snapshot.
    if (!redis && !isKvEnabled) writeJsonFile(path.join(getFileStorageDir(), "user-history", `${userId}.json`), updated);

    // 3. Vercel KV
    if (isKvEnabled) {
      try {
        await kv.zadd(`user:history:${userId}`, { score: Date.now(), member: reportId });
        await kv.zremrangebyrank(`user:history:${userId}`, 0, -101);
      } catch (err) {
        throw err;
      }
    }

    // 4. Redis
    if (redis) {
      try {
        await redis.zadd(`user:history:${userId}`, Date.now(), reportId);
        await redis.zremrangebyrank(`user:history:${userId}`, 0, -101);
      } catch (err) {
        throw err;
      }
    }
  }

  async deleteUserReport(userId: string, reportId: string): Promise<void> {
    await withReportLock(reportId, () => withReportLock(`user:${userId}`, () => this.removeUserReport(userId, reportId)));
  }

  async removeUserReport(userId: string, reportId: string): Promise<void> {
    const report = await this.getOwnedReport(userId, reportId);
    if (report) await this.deleteReport(reportId);
    invalidatePrincipalReports(`user:${userId}`);
    const current = await this.getUserReports(userId, 100);
    const updated = current.filter((item) => item.id !== reportId);

    // Remote stores are authoritative; local deployments persist an atomic history snapshot.
    if (!redis && !isKvEnabled) writeJsonFile(path.join(getFileStorageDir(), "user-history", `${userId}.json`), updated);

    // 3. Vercel KV
    if (isKvEnabled) {
      try {
        await kv.zrem(`user:history:${userId}`, reportId);
      } catch (err) {
        console.error("[KV] deleteUserReport error:", err);
      }
    }

    // 4. Redis
    if (redis) {
      try {
        await redis.zrem(`user:history:${userId}`, reportId);
      } catch (err) {
        console.error("[Redis] deleteUserReport error:", err);
      }
    }
  }

  async clearUserHistory(userId: string): Promise<void> {
    const current = await this.getUserReports(userId, 100);
    for (const item of current) await this.deleteUserReport(userId, item.id);
    invalidatePrincipalReports(`user:${userId}`);
  }

  async syncUserReports(userId: string, clientItems: UserScanHistoryItem[]): Promise<UserScanHistoryItem[]> {
    return withReportLock(`user:${userId}`, () => this.mergeUserReports(userId, clientItems));
  }

  async mergeUserReports(userId: string, clientItems: UserScanHistoryItem[]): Promise<UserScanHistoryItem[]> {
    const existing = await this.getUserReports(userId, 100);
    const safeItems: UserScanHistoryItem[] = [];
    for (const item of clientItems) {
      if (!item || typeof item.id !== "string") continue;
      const owned = await this.getOwnedReport(userId, item.id);
      if (owned) {
        safeItems.push({ ...item, fullReport: undefined });
        continue;
      }
      // A client-supplied ID is never authority to claim or overwrite a server report.
      if (!item.fullReport || !this.isImportableReport(item.fullReport)) continue;
      const id = crypto.randomUUID();
      const report = { ...item.fullReport, id };
      await this.saveReport(id, report, userId);
      safeItems.push({
        id,
        fileName: report.fileName,
        checkedAt: report.checkedAt,
        plagiarismScore: report.plagiarismScore,
        wordCount: report.wordCount,
        aiProbability: report.aiProbability,
        fullReport: report
      });
    }
    clientItems = safeItems;
    const existingIds = new Set(existing.map((item) => item.id));

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
          aiProbability: item.aiProbability
        });
      }
    }

    // Sort newest first
    combined.sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
    const trimmed = combined.slice(0, 100);
    for (const item of combined.slice(100)) {
      const stored = (await this.getReport(item.id)) as StoredReport | null;
      if (stored?.ownerId === userId) await this.deleteReport(item.id);
    }

    // Remote stores are authoritative; local deployments persist an atomic history snapshot.
    if (!redis && !isKvEnabled) writeJsonFile(path.join(getFileStorageDir(), "user-history", `${userId}.json`), trimmed);

    // 3. Vercel KV
    if (isKvEnabled) {
      try {
        for (const item of trimmed) {
          await kv.zadd(`user:history:${userId}`, { score: new Date(item.checkedAt).getTime(), member: item.id });
        }
      } catch (err) {
        throw err;
      }
    }

    // 4. Redis
    if (redis) {
      try {
        for (const item of trimmed) {
          await redis.zadd(`user:history:${userId}`, new Date(item.checkedAt).getTime(), item.id);
        }
      } catch (err) {
        throw err;
      }
    }

    return trimmed.map((item) => {
      const imported = safeItems.find((candidate) => candidate.id === item.id);
      return imported?.fullReport ? { ...item, fullReport: imported.fullReport } : item;
    });
  }

  async getOwnedReport(userId: string, reportId: string): Promise<ScanReport | null> {
    if (!isStorageId(userId) || !isStorageId(reportId)) return null;
    const report = (await this.getReport(reportId)) as StoredReport | null;
    if (!report) return null;
    if (report.ownerId ? report.ownerId !== userId : !(await this.getUserReports(userId, 100)).some((item) => item.id === reportId)) return null;
    const { ownerId: _ownerId, ...content } = report;
    return content;
  }

  async updateOwnedReport(userId: string, reportId: string, updates: Partial<ScanReport>): Promise<boolean> {
    return withReportLock(reportId, async () => {
      const current = await this.getOwnedReport(userId, reportId);
      if (!current) return false;
      return await this.saveReport(reportId, { ...current, ...updates, id: reportId }, userId, true);
    });
  }

  async deleteReport(reportId: string): Promise<void> {
    if (!isStorageId(reportId)) throw new Error("Invalid report ID");
    // Remote failures are surfaced so the caller can retry instead of reporting a false deletion.
    if (isKvEnabled) {
      await kv.del(`history:${reportId}`);
      await kv.zrem("history:index", reportId);
    }
    if (redis) {
      await redis.del(`history:${reportId}`);
      await redis.zrem("history:index", reportId);
    }
    fs.rmSync(path.join(getFileStorageDir(), "reports", `${reportId}.json`), { force: true });
  }

  isImportableReport(value: ScanReport): boolean {
    return (
      typeof value === "object" &&
      value !== null &&
      typeof value.fileName === "string" &&
      value.fileName.length <= 1000 &&
      typeof value.checkedAt === "string" &&
      Number.isFinite(Date.parse(value.checkedAt)) &&
      Number.isFinite(value.plagiarismScore) &&
      value.plagiarismScore >= 0 &&
      value.plagiarismScore <= 100 &&
      Number.isFinite(value.wordCount) &&
      Array.isArray(value.matches) &&
      Array.isArray(value.aiSignals) &&
      typeof value.summary === "string" &&
      !!value.aiReliability
    );
  }
}
