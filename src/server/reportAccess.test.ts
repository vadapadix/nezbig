import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import { app } from "./app.js";
import { saveReport, saveUserReport, getReport, getOwnedReport, getUserReports, syncUserReports, deleteUserReport, clearUserHistory, updateOwnedReport } from "./db.js";
import { generateToken } from "./auth.js";
import { reportCacheKey, reportCache, scanJobCache } from "./jobStore.js";
import type { ScanReport } from "../shared/types.js";

vi.mock("./webSearch.js", () => ({
  searchWebCandidatesDetailed: vi.fn(async () => ({ candidates: [], diagnostics: { providers: [{ provider: "mock", attempted: 1, succeeded: 1, failed: 0, timedOut: 0, results: 0 }], pages: { attempted: 0, verified: 0, unavailable: 0, cacheHits: 0, negativeCacheHits: 0 } } })),
  hydrateSearchCandidatesDetailed: vi.fn(async () => ({ candidates: [], diagnostics: { providers: [], pages: { attempted: 0, verified: 0, unavailable: 0, cacheHits: 0, negativeCacheHits: 0 } } }))
}));

function token(id: string) { return generateToken({ id, email: `${id}@example.com`, name: id, createdAt: new Date().toISOString() }); }
const text = "This document contains enough separate words for a reliable local analysis of original writing with multiple different sentences and a careful explanation of methods used in research.";
function report(id = crypto.randomUUID()): ScanReport {
  return { id, fileName: "private.docx", checkedAt: new Date().toISOString(), wordCount: 100, chunksChecked: 1, plagiarismScore: 0, aiProbability: 5, aiVerdict: "low", aiReliability: { level: "low", score: 30, segmentCount: 1, segmentSpread: 0, reason: "short" }, aiLanguage: { code: "en", supportedPercent: 100, reason: "" }, aiExclusions: { analyzedWords: 100, codeWords: 0, quotedWords: 0, referenceWords: 0 }, aiSuspiciousSegments: [], aiProvider: "local", matches: [], aiSignals: [], summary: "private", sourceText: "private source" };
}

describe("private reports", () => {
  it("permits only the owner to read a report or submit a stored AI update", async () => {
    const item = report();
    await saveReport(item.id, item, "owner");
    await saveUserReport("owner", item.id);
    expect((await request(app).get(`/api/history/${item.id}`)).status).toBe(401);
    expect((await request(app).get(`/api/history/${item.id}`).auth(token("other"), { type: "bearer" })).status).toBe(404);
    const owned = await request(app).get(`/api/history/${item.id}`).auth(token("owner"), { type: "bearer" });
    expect(owned.body.sourceText).toBe("private source");
    expect(owned.body.ownerId).toBeUndefined();
    const update = await request(app).post("/api/ai-opinion").auth(token("other"), { type: "bearer" }).send({ reportId: item.id, text });
    expect(update.status).toBe(404);
    expect((await getReport(item.id))?.aiOpinionProbability).toBeUndefined();
  });

  it("does not claim or overwrite another user's report through sync", async () => {
    const item = report();
    await saveReport(item.id, item, "victim");
    await saveUserReport("victim", item.id);
    expect(await syncUserReports("attacker", [{ ...item }])).toEqual([]);
    const copies = await syncUserReports("attacker", [{ ...item, fullReport: { ...item, sourceText: "attacker supplied" } }]);
    expect(copies[0]!.id).not.toBe(item.id);
    expect((await getOwnedReport("victim", item.id))?.sourceText).toBe("private source");
    expect(await getOwnedReport("attacker", item.id)).toBeNull();
    expect((await getOwnedReport("attacker", copies[0]!.id))?.sourceText).toBe("attacker supplied");
  });

  it("physically deletes report files and invalidates cached account results", async () => {
    const item = report();
    await saveReport(item.id, item, "delete-owner");
    await saveUserReport("delete-owner", item.id);
    const key = reportCacheKey("user:delete-owner", { text });
    reportCache.set(key, item);
    await deleteUserReport("delete-owner", item.id);
    expect(await getReport(item.id)).toBeNull();
    expect(fs.existsSync(path.join(process.env.NEZBIG_DATA_DIR!, "reports", `${item.id}.json`))).toBe(false);
    expect(reportCache.get(key)).toBeUndefined();
    const second = report();
    await saveReport(second.id, second, "delete-owner");
    await saveUserReport("delete-owner", second.id);
    await clearUserHistory("delete-owner");
    expect(await getReport(second.id)).toBeNull();
  });

  it("rejects storage paths", async () => {
    expect(await getReport("../../users/private")).toBeNull();
    await expect(saveReport("../escape", report())).rejects.toThrow(/Invalid/);
  });

  it("retains both reports when scans finish concurrently", async () => {
    const first = report();
    const second = report();
    await Promise.all([saveReport(first.id, first, "concurrent-owner"), saveReport(second.id, second, "concurrent-owner")]);
    await Promise.all([saveUserReport("concurrent-owner", first.id), saveUserReport("concurrent-owner", second.id)]);
    expect((await getUserReports("concurrent-owner")).map(item => item.id).sort()).toEqual([first.id, second.id].sort());
  });

  it("does not resurrect a report when an AI response arrives after deletion", async () => {
    const item = report();
    await saveReport(item.id, item, "late-ai-owner");
    await saveUserReport("late-ai-owner", item.id);
    await Promise.all([
      deleteUserReport("late-ai-owner", item.id),
      updateOwnedReport("late-ai-owner", item.id, { aiOpinionProbability: 90 })
    ]);
    expect(await getReport(item.id)).toBeNull();
  });
});

describe("job and cache isolation", () => {
  it("keeps guest reports out of persistent storage and rejects another browser's polling", async () => {
    const agent = request.agent(app);
    const start = await agent.post("/api/scan/jobs").send({ text });
    expect(start.status).toBe(200);
    let status = await agent.get(`/api/scan-status/${start.body.jobId}`);
    for (let i = 0; i < 20 && status.body.status !== "completed"; i++) {
      await new Promise(resolve => setTimeout(resolve, 10));
      status = await agent.get(`/api/scan-status/${start.body.jobId}`);
    }
    expect(status.body.status).toBe("completed");
    expect(status.body.principal).toBeUndefined();
    expect(await getReport(status.body.result.id)).toBeNull();
    expect((await request(app).get(`/api/scan-status/${start.body.jobId}`)).status).toBe(404);
  });

  it("stores only account job metadata, and deletion makes completed jobs unreadable", async () => {
    const item = report();
    await saveReport(item.id, item, "job-owner");
    await saveUserReport("job-owner", item.id);
    const jobId = crypto.randomUUID();
    await scanJobCache.set(jobId, { id: jobId, principal: "user:job-owner", status: "completed", createdAt: new Date().toISOString(), result: item });
    expect((await scanJobCache.get(jobId))?.result).toBeUndefined();
    expect((await request(app).get(`/api/scan-status/${jobId}`).auth(token("other"), { type: "bearer" })).status).toBe(404);
    expect((await request(app).get(`/api/scan-status/${jobId}`).auth(token("job-owner"), { type: "bearer" })).body.result.id).toBe(item.id);
    await deleteUserReport("job-owner", item.id);
    expect((await request(app).get(`/api/scan-status/${jobId}`).auth(token("job-owner"), { type: "bearer" })).status).toBe(404);
  });

  it("separates users, filenames, file evidence and every setting in cache keys", () => {
    const input = { text, fileName: "a.docx", settings: { sensitivity: "balanced", chunkWords: 120, maxChunks: 14, overlapWords: 32 }, evidence: { sizeBytes: 100 } };
    const key = reportCacheKey("user:one", input);
    expect(reportCacheKey("user:two", input)).not.toBe(key);
    expect(reportCacheKey("user:one", { ...input, fileName: "b.docx" })).not.toBe(key);
    expect(reportCacheKey("user:one", { ...input, evidence: { sizeBytes: 200 } })).not.toBe(key);
    for (const setting of ["chunkWords", "maxChunks", "overlapWords"] as const) {
      expect(reportCacheKey("user:one", { ...input, settings: { ...input.settings, [setting]: input.settings[setting] + 1 } })).not.toBe(key);
    }
  });

  it("assigns a fresh identity on cache reuse and preserves a changed filename", async () => {
    const agent = request.agent(app);
    const first = await agent.post("/api/scan/jobs").send({ text, fileName: "first.docx" });
    let status = await agent.get(`/api/scan-status/${first.body.jobId}`);
    for (let i = 0; i < 20 && status.body.status !== "completed"; i++) {
      await new Promise(resolve => setTimeout(resolve, 10));
      status = await agent.get(`/api/scan-status/${first.body.jobId}`);
    }
    const repeat = await agent.post("/api/scan/jobs").send({ text, fileName: "first.docx" });
    expect(repeat.body.status).toBe("completed");
    expect(repeat.body.result.id).not.toBe(status.body.result.id);
    const changed = await agent.post("/api/scan/jobs").send({ text, fileName: "second.docx" });
    expect(changed.body.status).not.toBe("completed");
    let changedStatus = await agent.get(`/api/scan-status/${changed.body.jobId}`);
    for (let i = 0; i < 20 && changedStatus.body.status !== "completed"; i++) {
      await new Promise(resolve => setTimeout(resolve, 10));
      changedStatus = await agent.get(`/api/scan-status/${changed.body.jobId}`);
    }
    expect(changedStatus.body.result.fileName).toBe("second.docx");
  });
});
