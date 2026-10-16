import fs from "fs";
import path from "path";
import os from "os";
import crypto from "node:crypto";
import { invalidatePrincipalReports } from "./jobStore.js";
import { Redis } from "ioredis";
import { kv } from "@vercel/kv";
// ---------- Redis Connection (Tier 1) ----------
const redisUrl = process.env.REDIS_URL;
export const redis = redisUrl ? new Redis(redisUrl) : null;
if (redis) {
    redis.on("error", (err) => console.error("[Redis] Error:", err));
    console.log("[Redis] Connected for History & Cache");
}
// ---------- Vercel KV Check (Tier 2) ----------
const isKvEnabled = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
// ---------- Persistent File Storage (Tier 3) ----------
let fileStorageDir = null;
function getFileStorageDir() {
    if (fileStorageDir)
        return fileStorageDir;
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
            if (!fs.existsSync(reportsDir))
                fs.mkdirSync(reportsDir, { recursive: true });
            const userHistDir = path.join(dir, "user-history");
            if (!fs.existsSync(userHistDir))
                fs.mkdirSync(userHistDir, { recursive: true });
            fileStorageDir = dir;
            return fileStorageDir;
        }
        catch {
            // Try next candidate directory
        }
    }
    // Final fallback to tmpdir
    fileStorageDir = path.resolve(os.tmpdir(), "nezbig-data");
    try {
        fs.mkdirSync(path.join(fileStorageDir, "reports"), { recursive: true });
        fs.mkdirSync(path.join(fileStorageDir, "user-history"), { recursive: true });
    }
    catch {
        // ignore
    }
    return fileStorageDir;
}
export const isStorageId = (id) => /^[a-zA-Z0-9_-]{1,128}$/.test(id);
const reportLocks = new Map();
async function withReportLock(id, action) {
    const previous = reportLocks.get(id) ?? Promise.resolve();
    const current = previous.catch(() => { }).then(action);
    reportLocks.set(id, current);
    try {
        return await current;
    }
    finally {
        if (reportLocks.get(id) === current)
            reportLocks.delete(id);
    }
}
// ---------- Helper: Read/Write JSON safely ----------
function readJsonFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, "utf-8");
            return JSON.parse(data);
        }
    }
    catch {
        // ignore
    }
    return null;
}
function writeJsonFile(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporary, JSON.stringify(data), { mode: 0o600 });
        fs.renameSync(temporary, filePath);
    }
    finally {
        fs.rmSync(temporary, { force: true });
    }
}
// ---------- Reports Storage ----------
export async function saveReport(reportId, report, ownerId, existingOnly = false) {
    if (!isStorageId(reportId))
        throw new Error("Invalid report ID");
    const previous = await getReport(reportId);
    if (existingOnly && !previous)
        return false;
    if (previous?.ownerId && previous.ownerId !== ownerId)
        throw new Error("Report owner mismatch");
    const { ownerId: _untrustedOwner, ...content } = report;
    const stored = { ...content, id: reportId, ...(ownerId ? { ownerId } : {}) };
    const key = `history:${reportId}`;
    // A configured remote store is authoritative. Never fall back to a stale local replica after deletion.
    if (redis) {
        const result = existingOnly
            ? await redis.set(key, JSON.stringify(stored), "EX", 60 * 60 * 24 * 30, "XX")
            : await redis.set(key, JSON.stringify(stored), "EX", 60 * 60 * 24 * 30);
        if (!result)
            return false;
        await redis.zadd("history:index", Date.now(), reportId);
        return true;
    }
    if (isKvEnabled) {
        const result = existingOnly
            ? await kv.set(key, JSON.stringify(stored), { ex: 60 * 60 * 24 * 30, xx: true })
            : await kv.set(key, JSON.stringify(stored), { ex: 60 * 60 * 24 * 30 });
        if (!result)
            return false;
        await kv.zadd("history:index", { score: Date.now(), member: reportId });
        return true;
    }
    const filePath = path.join(getFileStorageDir(), "reports", `${reportId}.json`);
    const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporary, JSON.stringify(stored), { mode: 0o600 });
        fs.renameSync(temporary, filePath);
    }
    finally {
        fs.rmSync(temporary, { force: true });
    }
    return true;
}
export async function getReport(reportId) {
    if (!isStorageId(reportId))
        return null;
    if (redis) {
        const data = await redis.get(`history:${reportId}`);
        return data ? JSON.parse(data) : null;
    }
    if (isKvEnabled) {
        const data = await kv.get(`history:${reportId}`);
        return typeof data === "string" ? JSON.parse(data) : data;
    }
    return readJsonFile(path.join(getFileStorageDir(), "reports", `${reportId}.json`));
}
// ---------- User History Storage ----------
export async function getUserReports(userId, limit = 100) {
    if (!isStorageId(userId))
        return [];
    if (redis || isKvEnabled) {
        const ids = redis ? await redis.zrevrange(`user:history:${userId}`, 0, limit - 1) : await kv.zrange(`user:history:${userId}`, 0, limit - 1, { rev: true });
        const items = [];
        for (const id of ids) {
            const report = await getReport(id);
            if (report && (!report.ownerId || report.ownerId === userId))
                items.push({ id, fileName: report.fileName, checkedAt: report.checkedAt, plagiarismScore: report.plagiarismScore, wordCount: report.wordCount, aiProbability: report.aiProbability });
        }
        return items;
    }
    const filePath = path.join(getFileStorageDir(), "user-history", `${userId}.json`);
    return (readJsonFile(filePath) || []).slice(0, limit);
}
export async function saveUserReport(userId, reportId, summary) {
    return withReportLock(`user:${userId}`, () => storeUserReport(userId, reportId, summary));
}
async function storeUserReport(userId, reportId, summary) {
    if (!isStorageId(userId) || !isStorageId(reportId))
        throw new Error("Invalid storage ID");
    const stored = await getReport(reportId);
    if (stored?.ownerId && stored.ownerId !== userId)
        throw new Error("Report owner mismatch");
    if (stored && !stored.ownerId)
        await saveReport(reportId, stored, userId);
    const current = await getUserReports(userId, 100);
    let newItem;
    if (summary?.fileName && summary.checkedAt && summary.plagiarismScore !== undefined) {
        newItem = {
            id: reportId,
            fileName: summary.fileName,
            checkedAt: summary.checkedAt,
            plagiarismScore: summary.plagiarismScore,
            wordCount: summary.wordCount,
            aiProbability: summary.aiProbability,
        };
    }
    else {
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
    for (const item of current) {
        if (!updated.some(kept => kept.id === item.id) && await getOwnedReport(userId, item.id)) {
            await deleteReport(item.id);
            invalidatePrincipalReports(`user:${userId}`);
        }
    }
    // Remote stores are authoritative; local deployments persist an atomic history snapshot.
    if (!redis && !isKvEnabled)
        writeJsonFile(path.join(getFileStorageDir(), "user-history", `${userId}.json`), updated);
    // 3. Vercel KV
    if (isKvEnabled) {
        try {
            await kv.zadd(`user:history:${userId}`, { score: Date.now(), member: reportId });
            await kv.zremrangebyrank(`user:history:${userId}`, 0, -101);
        }
        catch (err) {
            throw err;
        }
    }
    // 4. Redis
    if (redis) {
        try {
            await redis.zadd(`user:history:${userId}`, Date.now(), reportId);
            await redis.zremrangebyrank(`user:history:${userId}`, 0, -101);
        }
        catch (err) {
            throw err;
        }
    }
}
export async function deleteUserReport(userId, reportId) {
    await withReportLock(reportId, () => withReportLock(`user:${userId}`, () => removeUserReport(userId, reportId)));
}
async function removeUserReport(userId, reportId) {
    const report = await getOwnedReport(userId, reportId);
    if (report)
        await deleteReport(reportId);
    invalidatePrincipalReports(`user:${userId}`);
    const current = await getUserReports(userId, 100);
    const updated = current.filter((item) => item.id !== reportId);
    // Remote stores are authoritative; local deployments persist an atomic history snapshot.
    if (!redis && !isKvEnabled)
        writeJsonFile(path.join(getFileStorageDir(), "user-history", `${userId}.json`), updated);
    // 3. Vercel KV
    if (isKvEnabled) {
        try {
            await kv.zrem(`user:history:${userId}`, reportId);
        }
        catch (err) {
            console.error("[KV] deleteUserReport error:", err);
        }
    }
    // 4. Redis
    if (redis) {
        try {
            await redis.zrem(`user:history:${userId}`, reportId);
        }
        catch (err) {
            console.error("[Redis] deleteUserReport error:", err);
        }
    }
}
export async function clearUserHistory(userId) {
    const current = await getUserReports(userId, 100);
    for (const item of current)
        await deleteUserReport(userId, item.id);
    invalidatePrincipalReports(`user:${userId}`);
}
export async function syncUserReports(userId, clientItems) {
    return withReportLock(`user:${userId}`, () => mergeUserReports(userId, clientItems));
}
async function mergeUserReports(userId, clientItems) {
    const existing = await getUserReports(userId, 100);
    const safeItems = [];
    for (const item of clientItems) {
        if (!item || typeof item.id !== "string")
            continue;
        const owned = await getOwnedReport(userId, item.id);
        if (owned) {
            safeItems.push({ ...item, fullReport: undefined });
            continue;
        }
        // A client-supplied ID is never authority to claim or overwrite a server report.
        if (!item.fullReport || !isImportableReport(item.fullReport))
            continue;
        const id = crypto.randomUUID();
        const report = { ...item.fullReport, id };
        await saveReport(id, report, userId);
        safeItems.push({ id, fileName: report.fileName, checkedAt: report.checkedAt, plagiarismScore: report.plagiarismScore, wordCount: report.wordCount, aiProbability: report.aiProbability, fullReport: report });
    }
    clientItems = safeItems;
    const existingIds = new Set(existing.map((item) => item.id));
    // Merge client items with server items
    const combined = [...existing];
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
    for (const item of combined.slice(100)) {
        const stored = await getReport(item.id);
        if (stored?.ownerId === userId)
            await deleteReport(item.id);
    }
    // Remote stores are authoritative; local deployments persist an atomic history snapshot.
    if (!redis && !isKvEnabled)
        writeJsonFile(path.join(getFileStorageDir(), "user-history", `${userId}.json`), trimmed);
    // 3. Vercel KV
    if (isKvEnabled) {
        try {
            for (const item of trimmed) {
                await kv.zadd(`user:history:${userId}`, { score: new Date(item.checkedAt).getTime(), member: item.id });
            }
        }
        catch (err) {
            throw err;
        }
    }
    // 4. Redis
    if (redis) {
        try {
            for (const item of trimmed) {
                await redis.zadd(`user:history:${userId}`, new Date(item.checkedAt).getTime(), item.id);
            }
        }
        catch (err) {
            throw err;
        }
    }
    return trimmed.map(item => {
        const imported = safeItems.find(candidate => candidate.id === item.id);
        return imported?.fullReport ? { ...item, fullReport: imported.fullReport } : item;
    });
}
export async function getOwnedReport(userId, reportId) {
    if (!isStorageId(userId) || !isStorageId(reportId))
        return null;
    const report = await getReport(reportId);
    if (!report)
        return null;
    if (report.ownerId ? report.ownerId !== userId : !(await getUserReports(userId, 100)).some(item => item.id === reportId))
        return null;
    const { ownerId: _ownerId, ...content } = report;
    return content;
}
export async function updateOwnedReport(userId, reportId, updates) {
    return withReportLock(reportId, async () => {
        const current = await getOwnedReport(userId, reportId);
        if (!current)
            return false;
        return await saveReport(reportId, { ...current, ...updates, id: reportId }, userId, true);
    });
}
async function deleteReport(reportId) {
    if (!isStorageId(reportId))
        throw new Error("Invalid report ID");
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
function isImportableReport(value) {
    return typeof value === "object" && value !== null &&
        typeof value.fileName === "string" && value.fileName.length <= 1000 &&
        typeof value.checkedAt === "string" && Number.isFinite(Date.parse(value.checkedAt)) &&
        Number.isFinite(value.plagiarismScore) && value.plagiarismScore >= 0 && value.plagiarismScore <= 100 &&
        Number.isFinite(value.wordCount) && Array.isArray(value.matches) && Array.isArray(value.aiSignals) &&
        typeof value.summary === "string" && !!value.aiReliability;
}
