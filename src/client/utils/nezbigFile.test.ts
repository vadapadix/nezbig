import { describe, it, expect } from "vitest";
import { serializeNezbigReport, parseNezbigReport } from "./nezbigFile";
import type { ScanReport } from "../../shared/types";

const mockReport: ScanReport = {
  id: "test-scan-123",
  fileName: "курсова_робота.docx",
  checkedAt: "2026-10-10T12:00:00.000Z",
  wordCount: 500,
  chunksChecked: 5,
  plagiarismScore: 12,
  summary: "Текст містить незначні збіги.",
  matches: [
    {
      title: "Example Source",
      url: "https://example.com/source",
      snippet: "Приклад знайденого тексту",
      provider: "google",
      chunkIndex: 0,
      score: 15,
      overlapPercent: 12,
      ngramOverlapPercent: 10,
      hashOverlapPercent: 8,
      fullTextRank: 1,
      longestRun: 7,
      confidence: "page",
      excerpt: "Приклад тексту користувача",
    },
  ],
  aiProbability: 8,
  aiVerdict: "low",
  aiReliability: { score: 90, level: "high", segmentCount: 5, segmentSpread: 5, reason: "OK" },
  aiLanguage: { code: "uk", supportedPercent: 100, reason: "Ukrainian supported" },
  aiExclusions: { analyzedWords: 500, codeWords: 0, quotedWords: 0, referenceWords: 0 },
  aiSuspiciousSegments: [],
  aiProvider: "local",
  aiSignals: [],
  scanNotes: ["Тестова перевірка"],
};

describe("nezbigFile utility", () => {
  it("serializes and parses report round-trip correctly", () => {
    const serialized = serializeNezbigReport(mockReport);
    expect(serialized).toContain('"format": "nezbig-report"');
    expect(serialized).toContain('"version": 1');
    expect(serialized).toContain('"test-scan-123"');

    const parsed = parseNezbigReport(serialized);
    expect(parsed).not.toBeNull();
    expect(parsed?.id).toBe(mockReport.id);
    expect(parsed?.fileName).toBe(mockReport.fileName);
    expect(parsed?.plagiarismScore).toBe(12);
    expect(parsed?.matches.length).toBe(1);
    expect(parsed?.matches[0].url).toBe("https://example.com/source");
  });

  it("parses raw legacy JSON report directly", () => {
    const rawJson = JSON.stringify(mockReport);
    const parsed = parseNezbigReport(rawJson);
    expect(parsed).not.toBeNull();
    expect(parsed?.id).toBe("test-scan-123");
    expect(parsed?.plagiarismScore).toBe(12);
  });

  it("returns null for invalid or corrupted text", () => {
    expect(parseNezbigReport("not a json")).toBeNull();
    expect(parseNezbigReport("{}")).toBeNull();
    expect(parseNezbigReport(JSON.stringify({ someField: 123 }))).toBeNull();
    expect(parseNezbigReport(JSON.stringify({ id: 123, fileName: "test" }))).toBeNull();
  });
});
