import { describe, it, expect } from "vitest";
import { verifiedWordRanges, documentMatchCoverage } from "../../../src/server/domain/analysis/matchCoverage.js";
import { scoreCandidate, calculateConfirmedPlagiarismScore } from "../../../src/server/application/scanning/scoring.js";

describe("verified document coverage", () => {
  const passage = "These nine unusual words form a clearly identifiable copied passage for comparison";
  const page = `${passage} ${"additional unrelated background material ".repeat(9)}`;
  it("keeps a short strong match distinct from whole-document coverage", () => {
    const match = scoreCandidate(passage, { title: "Source", url: "https://example.com", provider: "test", snippet: "", sourceText: page }, 0, 100);
    expect(calculateConfirmedPlagiarismScore([match])).toBeGreaterThan(50);
    expect(documentMatchCoverage([match], 1000)).toEqual({ matchedWords: 12, percent: 1.2 });
  });
  it("unions duplicate sources and overlapping chunks instead of double counting", () => {
    const match = scoreCandidate(passage, { title: "Source", url: "https://example.com", provider: "test", snippet: "", sourceText: page }, 0, 100);
    expect(documentMatchCoverage([match, { ...match, matchedWordRanges: [{ start: 105, end: 120 }] }], 1000)).toEqual({ matchedWords: 20, percent: 2 });
  });
  it("does not treat snippets or short page fallbacks as verified coverage", () => {
    const match = scoreCandidate(passage, { title: "Source", url: "https://example.com", provider: "test", snippet: passage, sourceText: passage }, 0);
    expect(match.confidence).toBe("snippet");
    expect(documentMatchCoverage([match], 100)).toEqual({ matchedWords: 0, percent: 0 });
  });
  it("does not skip short words to invent a verbatim run", () => {
    expect(verifiedWordRanges("the cat is on the mat and it is very calm", "the cat is off a mat or it was very calm", 0)).toEqual([]);
  });
});
