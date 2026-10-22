import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../../src/server/presentation/http/app.js";
import { reports } from "../../../src/server/composition/reports.js";
import { authenticationService, tokens } from "../../../src/server/composition/auth.js";
import type { ScanReport, UserScanHistoryItem } from "../../../src/shared/types/index.js";

function mockReport(id: string, fileName = "test.docx"): ScanReport {
  return {
    id,
    fileName,
    checkedAt: new Date().toISOString(),
    wordCount: 150,
    chunksChecked: 2,
    plagiarismScore: 12,
    aiProbability: 5,
    aiVerdict: "low",
    aiReliability: { level: "high", score: 95, segmentCount: 1, segmentSpread: 1, reason: "ok" },
    aiLanguage: { code: "uk", supportedPercent: 100, reason: "ok" },
    aiExclusions: { analyzedWords: 150, codeWords: 0, quotedWords: 0, referenceWords: 0 },
    aiSuspiciousSegments: [],
    aiProvider: "local",
    matches: [],
    aiSignals: [],
    summary: "Mock report summary"
  };
}

describe("Multi-Tier History Storage (db.ts)", () => {
  const testUserId = "user-test-db-123";

  it("returns document coverage independently of strongest match and ignores stale summaries", async () => {
    const report = { ...mockReport("metrics-report"), plagiarismScore: 26, matchedTextPercent: 0, aiProbability: 4 };
    await reports.saveReport(report.id, report, testUserId);
    await reports.saveUserReport(testUserId, report.id, { fileName: "stale", checkedAt: report.checkedAt, plagiarismScore: 99, aiProbability: 99 });
    const item = (await reports.getUserReports(testUserId)).find((item) => item.id === report.id);
    expect(item).toMatchObject({ plagiarismScore: 26, matchedTextPercent: 0, aiProbability: 4 });
    await reports.deleteUserReport(testUserId, report.id);
  });

  it("saves and retrieves full report", async () => {
    const report = mockReport("rep-101", "document.docx");
    await reports.saveReport("rep-101", report);

    const fetched = await reports.getReport("rep-101");
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe("rep-101");
    expect(fetched?.fileName).toBe("document.docx");
    expect(fetched?.plagiarismScore).toBe(12);
  });

  it("saves user report and lists user history", async () => {
    const report1 = mockReport("rep-user-1", "file1.docx");
    const report2 = mockReport("rep-user-2", "file2.pdf");

    await reports.saveReport("rep-user-1", report1);
    await reports.saveReport("rep-user-2", report2);

    await reports.saveUserReport(testUserId, "rep-user-1");
    await reports.saveUserReport(testUserId, "rep-user-2");

    const history = await reports.getUserReports(testUserId);
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0].id).toBe("rep-user-2"); // Newest prepended
    expect(history[1].id).toBe("rep-user-1");
  });

  it("deletes a single report from user history", async () => {
    await reports.deleteUserReport(testUserId, "rep-user-1");
    const history = await reports.getUserReports(testUserId);
    expect(history.some((h) => h.id === "rep-user-1")).toBe(false);
  });

  it("clears user history", async () => {
    await reports.clearUserHistory(testUserId);
    const history = await reports.getUserReports(testUserId);
    expect(history.length).toBe(0);
  });

  it("syncs client items into user account", async () => {
    const clientReport = mockReport("client-rep-1", "synced.docx");
    const clientItems: UserScanHistoryItem[] = [
      {
        id: "client-rep-1",
        fileName: "synced.docx",
        checkedAt: new Date().toISOString(),
        plagiarismScore: 18,
        wordCount: 300,
        fullReport: clientReport
      }
    ];

    const synced = await reports.syncUserReports(testUserId, clientItems);
    const imported = synced.find((s) => s.fileName === "synced.docx")!;
    expect(imported.id).not.toBe("client-rep-1");

    const fullReport = await reports.getReport(imported.id);
    expect(fullReport).not.toBeNull();
    expect(fullReport?.fileName).toBe("synced.docx");
  });
});

describe("History REST API Endpoints (/api/history)", () => {
  it("returns empty list for unauthenticated user on GET /api/history", async () => {
    const res = await request(app).get("/api/history");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("allows authenticated user to view history and sync reports", async () => {
    const user = await authenticationService.register({
      name: "History User",
      email: `hist-${Date.now()}@example.com`,
      password: "password123"
    });
    const token = tokens.generate(user);

    // 1. Sync client items
    const testReport = mockReport("api-sync-rep-1", "thesis.docx");
    const syncRes = await request(app)
      .post("/api/history/sync")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [
          {
            id: "api-sync-rep-1",
            fileName: "thesis.docx",
            checkedAt: new Date().toISOString(),
            plagiarismScore: 8,
            wordCount: 500,
            fullReport: testReport
          }
        ]
      });

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.ok).toBe(true);
    expect(syncRes.body.items.length).toBeGreaterThanOrEqual(1);

    // 2. GET /api/history
    const listRes = await request(app).get("/api/history").set("Authorization", `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    const importedId = syncRes.body.items.find((item: any) => item.fileName === "thesis.docx").id;
    expect(importedId).not.toBe("api-sync-rep-1");
    expect(listRes.body.some((item: any) => item.id === importedId)).toBe(true);

    // 3. GET /api/history/:id
    const reportRes = await request(app).get(`/api/history/${importedId}`).set("Authorization", `Bearer ${token}`);

    expect(reportRes.status).toBe(200);
    expect(reportRes.body.id).toBe(importedId);
    expect(reportRes.body.fileName).toBe("thesis.docx");

    // 4. DELETE /api/history/:id
    const deleteRes = await request(app).delete(`/api/history/${importedId}`).set("Authorization", `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.ok).toBe(true);

    const afterDeleteRes = await request(app).get("/api/history").set("Authorization", `Bearer ${token}`);

    expect(afterDeleteRes.body.some((item: any) => item.id === importedId)).toBe(false);
    expect(await reports.getReport(importedId)).toBeNull();

    // 5. DELETE /api/history (Clear all)
    const clearRes = await request(app).delete("/api/history").set("Authorization", `Bearer ${token}`);

    expect(clearRes.status).toBe(200);
    expect(clearRes.body.ok).toBe(true);

    const emptyRes = await request(app).get("/api/history").set("Authorization", `Bearer ${token}`);

    expect(emptyRes.body.length).toBe(0);
  });
});
