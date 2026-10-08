import { normalizeWhitespace } from "./chunking.js";
import { FullTextIndex } from "./fullTextIndex.js";
import type { PlagiarismMatch, SearchCandidate } from "../shared/types.js";
import { tokenize, clampScore, stableHash, overlapRatio, buildNgrams } from "./utils/textUtils.js";

type CommonRun = {
  length: number;
  sourceStart: number;
  candidateStart: number;
};

function longestCommonRun(source: string[], candidate: string[]): CommonRun {
  const candidatePositions = new Map<string, number[]>();
  candidate.forEach((token, index) => {
    const positions = candidatePositions.get(token) ?? [];
    positions.push(index);
    candidatePositions.set(token, positions);
  });

  let previous = new Map<number, number>();
  let best: CommonRun = { length: 0, sourceStart: 0, candidateStart: 0 };

  source.forEach((token, sourceIndex) => {
    const current = new Map<number, number>();
    for (const candidateIndex of candidatePositions.get(token) ?? []) {
      const length = (previous.get(candidateIndex - 1) ?? 0) + 1;
      current.set(candidateIndex, length);
      if (length > best.length) {
        best = {
          length,
          sourceStart: sourceIndex - length + 1,
          candidateStart: candidateIndex - length + 1
        };
      }
    }
    previous = current;
  });

  return best;
}

function sourceForCandidate(candidate: SearchCandidate): string {
  const pageText = candidate.sourceText?.trim();
  // Require at least 30 words to consider page text reliable (was 18 — too low)
  if (pageText && pageText.split(/\s+/).length >= 30) return pageText;
  return `${candidate.title} ${candidate.snippet}`;
}

function winnowFingerprints(tokens: string[], gramSize = 4, windowSize = 4): Set<number> {
  const hashes: number[] = [];
  for (let index = 0; index <= tokens.length - gramSize; index += 1) {
    hashes.push(stableHash(tokens.slice(index, index + gramSize).join(" ")));
  }
  if (hashes.length === 0) return new Set();

  const fingerprints = new Set<number>();
  const effectiveWindow = Math.min(windowSize, hashes.length);
  let previousSelection = -1;

  for (let start = 0; start <= hashes.length - effectiveWindow; start += 1) {
    let minimum = Number.POSITIVE_INFINITY;
    let selectedIndex = start;
    for (let offset = 0; offset < effectiveWindow; offset += 1) {
      const index = start + offset;
      const value = hashes[index];
      // The rightmost minimum makes selection stable when the window shifts.
      if (value <= minimum) {
        minimum = value;
        selectedIndex = index;
      }
    }
    if (selectedIndex !== previousSelection) {
      fingerprints.add(hashes[selectedIndex]);
      previousSelection = selectedIndex;
    }
  }

  return fingerprints;
}

function setOverlapPercent(source: Set<number>, candidate: Set<number>): number {
  if (source.size === 0) return 0;
  let overlap = 0;
  for (const hash of source) {
    if (candidate.has(hash)) overlap += 1;
  }
  return overlap / source.size;
}

export function scoreCandidate(chunkText: string, candidate: SearchCandidate, chunkIndex: number): PlagiarismMatch {
  const sourceTokens = tokenize(chunkText);
  const sourceRunTokens = tokenize(chunkText, true);
  const candidateText = sourceForCandidate(candidate);
  const candidateTokens = tokenize(candidateText).slice(0, 16000);
  const candidateRunTokens = tokenize(candidateText, true).slice(0, 16000);
  const candidateIndex = new FullTextIndex(candidateTokens);

  const candidateSet = new Set(candidateTokens);
  const overlapCount = sourceTokens.filter((token) => candidateSet.has(token)).length;
  const overlapPercent = sourceTokens.length === 0 ? 0 : overlapCount / sourceTokens.length;
  const twoGramOverlap = overlapRatio(buildNgrams(sourceTokens, 2), buildNgrams(candidateTokens, 2));
  const threeGramOverlap = overlapRatio(buildNgrams(sourceTokens, 3), buildNgrams(candidateTokens, 3));
  const fourGramOverlap = overlapRatio(buildNgrams(sourceRunTokens, 4), buildNgrams(candidateRunTokens, 4));
  const hashOverlap = setOverlapPercent(winnowFingerprints(sourceRunTokens, 4, 4), winnowFingerprints(candidateRunTokens, 4, 4));
  const fullTextRank = candidateIndex.rank(sourceTokens);
  const commonRun = longestCommonRun(sourceRunTokens, candidateRunTokens);
  const longestRun = commonRun.length;

  const runScore = Math.min(1, longestRun / 10);
  const phraseScore = Math.max(twoGramOverlap * 0.45 + threeGramOverlap * 0.55, fourGramOverlap);
  const pageBonus = candidate.sourceText ? 1 : 0.85;

  let baseScore = (overlapPercent * 0.24 + fullTextRank * 0.20 + phraseScore * 0.22 + runScore * 0.20 + hashOverlap * 0.14) * 100 * pageBonus;

  // Verbatim copy-paste boost when significant contiguous runs exist
  if (longestRun >= 8) {
    baseScore = Math.max(baseScore, Math.min(100, longestRun * 6.5) * pageBonus);
  }

  const score = clampScore(baseScore);

  return {
    ...candidate,
    chunkIndex,
    score,
    overlapPercent: clampScore(overlapPercent * 100),
    ngramOverlapPercent: clampScore(phraseScore * 100),
    hashOverlapPercent: clampScore(hashOverlap * 100),
    fullTextRank: clampScore(fullTextRank * 100),
    longestRun,
    confidence: candidate.sourceText ? "page" : "snippet",
    excerpt: normalizeWhitespace(chunkText).split(" ").slice(0, 48).join(" "),
    submittedEvidence: longestRun >= 4 ? sourceRunTokens.slice(commonRun.sourceStart, commonRun.sourceStart + longestRun).join(" ") : undefined,
    sourceEvidence: longestRun >= 4 && candidate.sourceText ? candidateRunTokens.slice(commonRun.candidateStart, commonRun.candidateStart + longestRun).join(" ") : undefined
  };
}
