import { describe, expect, it } from "vitest";
import type { AiLanguageCoverage, AiReliability, ScanReport } from "../../shared/types";
import { summarizeAiError, uncertaintyBand, formatAiOpinionVerdict } from "./reportLabels";

const reliability = (score: number, spread: number): AiReliability => ({ level: "medium", score, segmentCount: 4, segmentSpread: spread, reason: "тест" });
const language: AiLanguageCoverage = { code: "uk", supportedPercent: 95, reason: "тест" };

const baseReport = (overrides: Partial<ScanReport>): ScanReport =>
  ({
    id: "00000000-0000-4000-8000-000000000000",
    fileName: "тест",
    checkedAt: new Date().toISOString(),
    wordCount: 900,
    chunksChecked: 1,
    plagiarismScore: 0,
    aiProbability: 40,
    aiVerdict: "elevated",
    aiReliability: reliability(70, 10),
    aiLanguage: language,
    aiExclusions: { analyzedWords: 900, codeWords: 0, quotedWords: 0, referenceWords: 0 },
    aiSuspiciousSegments: [],
    matches: [],
    aiSignals: [],
    summary: "",
    ...overrides
  }) as ScanReport;

describe("uncertaintyBand", () => {
  it("narrows the band when reliability is high and segments agree", () => {
    const report = baseReport({ aiReliability: reliability(90, 5), wordCount: 1200 });
    expect(uncertaintyBand(report)).toBeLessThanOrEqual(8);
  });

  it("widens the band for low reliability, large spread or short texts", () => {
    const unreliable = baseReport({ aiReliability: reliability(20, 30), wordCount: 1000 });
    const shortText = baseReport({ aiReliability: reliability(60, 10), wordCount: 150 });

    expect(uncertaintyBand(unreliable)).toBeGreaterThan(15);
    expect(uncertaintyBand(shortText)).toBeGreaterThanOrEqual(uncertaintyBand(baseReport({})));
  });

  it("stays within honest bounds of 4 to 35 points", () => {
    expect(uncertaintyBand(baseReport({ aiReliability: reliability(100, 0) }))).toBeGreaterThanOrEqual(4);
    expect(uncertaintyBand(baseReport({ aiReliability: reliability(0, 100), wordCount: 50 }))).toBeLessThanOrEqual(35);
  });
});

describe("summarizeAiError", () => {
  it("maps provider failures to short Ukrainian explanations", () => {
    expect(summarizeAiError(new Error("HTTP 429 rate-limited"))).toContain("лімітом");
    expect(summarizeAiError(new Error("insufficient_quota"))).toContain("квота");
    expect(summarizeAiError(new Error("The operation was aborted due to timeout"))).toContain("не відповіла");
  });
});

describe("formatAiOpinionVerdict", () => {
  it("uses custom aiOpinionVerdict when provided", () => {
    const report = baseReport({ aiOpinionProbability: 10, aiOpinionVerdict: "Текст містить автентичну структуру автора." });
    expect(formatAiOpinionVerdict(report, "uk")).toBe("Текст містить автентичну структуру автора.");
  });

  it("filters out technical fallback messages and provides an intelligent linguistic conclusion", () => {
    const report = baseReport({
      aiOpinionProbability: 8,
      aiOpinionNote: "AI fallback: спрацювала nvidia/nemotron-3-super-120b-a12b:free; перед цим пробували openrouter/free"
    });
    const verdict = formatAiOpinionVerdict(report, "uk");
    expect(verdict).not.toContain("fallback");
    expect(verdict).not.toContain("nvidia");
    expect(verdict).toContain("природн");
  });

  it("returns appropriate verdict for high AI probability", () => {
    const report = baseReport({ aiOpinionProbability: 85 });
    expect(formatAiOpinionVerdict(report, "uk")).toContain("генерації штучним інтелектом");
  });
});
