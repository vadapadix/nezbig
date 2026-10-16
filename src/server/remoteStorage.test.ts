import { beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { ScanReport } from "../shared/types.js";

const remote = vi.hoisted(() => ({ values: new Map<string, unknown>(), deleteOnConditionalSet: false }));
vi.mock("@vercel/kv", () => ({ kv: {
  get: vi.fn(async (key: string) => remote.values.get(key) ?? null),
  set: vi.fn(async (key: string, value: unknown, options?: { xx?: boolean }) => {
    if (options?.xx && remote.deleteOnConditionalSet) { remote.values.delete(key); remote.deleteOnConditionalSet = false; }
    if (options?.xx && !remote.values.has(key)) return null;
    remote.values.set(key, value);
    return "OK";
  }),
  zadd: vi.fn(async () => 1),
  del: vi.fn(async (key: string) => remote.values.delete(key)),
  zrem: vi.fn(async () => 1)
} }));

let db: typeof import("./db.js");
beforeAll(async () => {
  process.env.KV_REST_API_URL = "https://mock.invalid";
  process.env.KV_REST_API_TOKEN = "mock-only";
  db = await import("./db.js");
});

describe("authoritative remote reports", () => {
  const makeReport = (): ScanReport => ({ id: crypto.randomUUID(), fileName: "remote.txt", checkedAt: new Date().toISOString(), wordCount: 50, chunksChecked: 1, plagiarismScore: 0, aiProbability: 0, aiVerdict: "low", aiReliability: { level: "low", score: 30, reason: "", segmentCount: 1, segmentSpread: 0 }, aiLanguage: { code: "en", reason: "", supportedPercent: 100 }, aiExclusions: { analyzedWords: 50, codeWords: 0, quotedWords: 0, referenceWords: 0 }, aiProvider: "local", aiSignals: [], aiSuspiciousSegments: [], matches: [], summary: "", sourceText: "sensitive source" });

  it("does not fall back to an old file after another instance deletes the remote report", async () => {
    const item = makeReport();
    await db.saveReport(item.id, item, "owner");
    const directory = path.join(process.env.NEZBIG_DATA_DIR!, "reports");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, `${item.id}.json`), JSON.stringify({ ...item, ownerId: "owner" }));
    remote.values.delete(`history:${item.id}`);
    expect(await db.getOwnedReport("owner", item.id)).toBeNull();
  });

  it("does not recreate a report deleted between the ownership check and AI update", async () => {
    const item = makeReport();
    await db.saveReport(item.id, item, "owner");
    remote.deleteOnConditionalSet = true;
    expect(await db.updateOwnedReport("owner", item.id, { aiOpinionProbability: 90 })).toBe(false);
    expect(await db.getReport(item.id)).toBeNull();
  });
});
