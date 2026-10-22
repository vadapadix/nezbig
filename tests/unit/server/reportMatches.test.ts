import { expect, it } from "vitest";
import { uniqueMatches } from "../../../src/server/domain/analysis/reportMatches.js";
import { scoreCandidate } from "../../../src/server/domain/analysis/plagiarismScoring.js";

it("prefers fetched page evidence even when the search snippet had a higher score", () => {
  const text = "Цей довгий спільний фрагмент документа містить достатньо різних слів для надійної перевірки послідовності";
  const snippet = scoreCandidate(text, { url: "https://example.org/source", title: "Source", snippet: text, provider: "Test" }, 0);
  const page = { ...snippet, confidence: "page" as const, score: 10, matchedWordRanges: [] };
  expect(uniqueMatches([snippet, page])).toEqual([page]);
  expect(uniqueMatches([page, snippet])).toEqual([page]);
  expect(uniqueMatches([page, { ...snippet, chunkIndex: 1 }])).toHaveLength(2);
});
