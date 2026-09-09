import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app.js";
import {
  saveReport,
  getReport,
  saveUserReport,
  getUserReports,
  deleteUserReport,
  clearUserHistory,
  syncUserReports,
} from "./db.js";
import { createUser, generateToken } from "./auth.js";
import type { ScanReport, UserScanHistoryItem } from "../shared/types.js";

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
    summary: "Mock report summary",
  };
}

describe("Multi-Tier History Storage (db.ts)", () => {
  const testUserId = "user-test-db-123";

  it("saves and retrieves full report", async () => {
    const report = mockReport("rep-101", "document.docx");
    await saveReport("rep-101", report);

    const fetched = await getReport("rep-101");
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe("rep-101");
    expect(fetched?.fileName).toBe("document.docx");
    expect(fetched?.plagiarismScore).toBe(12);
  });

  it("saves user report and lists user history", async () => {
    const report1 = mockReport("rep-user-1", "file1.docx");
    const report2 = mockReport("rep-user-2", "file2.pdf");

    await saveReport("rep-user-1", report1);
    await saveReport("rep-user-2", report2);

    await saveUserReport(testUserId, "rep-user-1");
    await saveUserReport(testUserId, "rep-user-2");

    const history = await getUserReports(testUserId);
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0].id).toBe("rep-user-2"); // Newest prepended
    expect(history[1].id).toBe("rep-user-1");
  });

  it("deletes a single report from user history", async () => {
    await deleteUserReport(testUserId, "rep-user-1");
    const history = await getUserReports(testUserId);
    expect(history.some((h) => h.id === "rep-user-1")).toBe(false);
  });

  it("clears user history", async () => {
    await clearUserHistory(testUserId);
    const history = await getUserReports(testUserId);
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
        fullReport: clientReport,
      },
    ];

    const synced = await syncUserReports(testUserId, clientItems);
    expect(synced.some((s) => s.id === "client-rep-1")).toBe(true);

    const fullReport = await getReport("client-rep-1");
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
    const user = await createUser({
      name: "History User",
      email: `hist-${Date.now()}@example.com`,
      password: "password123",
    });
    const token = generateToken(user);

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
            fullReport: testReport,
          },
        ],
      });

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.ok).toBe(true);
    expect(syncRes.body.items.length).toBeGreaterThanOrEqual(1);

    // 2. GET /api/history
    const listRes = await request(app)
      .get("/api/history")
      .set("Authorization", `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.some((item: any) => item.id === "api-sync-rep-1")).toBe(true);

    // 3. GET /api/history/:id
    const reportRes = await request(app)
      .get("/api/history/api-sync-rep-1")
      .set("Authorization", `Bearer ${token}`);

    expect(reportRes.status).toBe(200);
    expect(reportRes.body.id).toBe("api-sync-rep-1");
    expect(reportRes.body.fileName).toBe("thesis.docx");

    // 4. DELETE /api/history/:id
    const deleteRes = await request(app)
      .delete("/api/history/api-sync-rep-1")
      .set("Authorization", `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.ok).toBe(true);

    const afterDeleteRes = await request(app)
      .get("/api/history")
      .set("Authorization", `Bearer ${token}`);

    expect(afterDeleteRes.body.some((item: any) => item.id === "api-sync-rep-1")).toBe(false);

    // 5. DELETE /api/history (Clear all)
    const clearRes = await request(app)
      .delete("/api/history")
      .set("Authorization", `Bearer ${token}`);

    expect(clearRes.status).toBe(200);
    expect(clearRes.body.ok).toBe(true);

    const emptyRes = await request(app)
      .get("/api/history")
      .set("Authorization", `Bearer ${token}`);

    expect(emptyRes.body.length).toBe(0);
  });
});
