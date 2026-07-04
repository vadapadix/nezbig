import { normalizeWhitespace } from "./chunking.js";
import { FullTextIndex } from "./fullTextIndex.js";
import type { PlagiarismMatch, SearchCandidate } from "../shared/types.js";
import {
  tokenize,
  clampScore,
  stableHash,
  overlapRatio,
  buildNgrams,
} from "./utils/textUtils.js";

// Additional utilities used only here or not yet moved
function longestCommonRun(source: string[], candidate: string[]): number {
  const previous = new Array(candidate.length + 1).fill(0);
  const current = new Array(candidate.length + 1).fill(0);
  let longest = 0;

  for (let i = 1; i <= source.length; i += 1) {
    for (let j = 1; j <= candidate.length; j += 1) {
      current[j] = source[i - 1] === candidate[j - 1] ? previous[j - 1] + 1 : 0;
      longest = Math.max(longest, current[j]);
    }
    previous.splice(0, previous.length, ...current);
    current.fill(0);
  }

  return longest;
}

function sourceForCandidate(candidate: SearchCandidate): string {
  const pageText = candidate.sourceText?.trim();
  if (pageText && pageText.split(/\s+/).length >= 18) return pageText;
  return `${candidate.title} ${candidate.snippet}`;
}

function hashTree(tokens: string[], size = 5): Set<number> {
  const leaves: number[] = [];
  for (let index = 0; index <= tokens.length - size; index += 1) {
    leaves.push(stableHash(tokens.slice(index, index + size).join(" ")));
  }

  const hashes = new Set(leaves);
  let level = leaves;
  while (level.length > 1) {
    const next: number[] = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      next.push(stableHash(`${left}:${right}`));
    }
    for (const hash of next) hashes.add(hash);
    level = next;
  }

  return hashes;
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
  const candidateTokens = tokenize(candidateText).slice(0, 8000);
  const candidateRunTokens = tokenize(candidateText, true).slice(0, 8000);
  const candidateIndex = new FullTextIndex(candidateTokens);

  const candidateSet = new Set(candidateTokens);
  const overlapCount = sourceTokens.filter((token) => candidateSet.has(token)).length;
  const overlapPercent = sourceTokens.length === 0 ? 0 : overlapCount / sourceTokens.length;
  const threeGramOverlap = overlapRatio(buildNgrams(sourceTokens, 3), buildNgrams(candidateTokens, 3));
  const fiveGramOverlap = overlapRatio(buildNgrams(sourceRunTokens, 5), buildNgrams(candidateRunTokens, 5));
  const hashOverlap = setOverlapPercent(hashTree(sourceRunTokens), hashTree(candidateRunTokens));
  const fullTextRank = candidateIndex.rank(sourceTokens);
  const longestRun = longestCommonRun(sourceRunTokens, candidateRunTokens);

  // Покращений розрахунок: ваги змінено для точнішої детекції парафразу
  const runScore = Math.min(1, longestRun / 15); // Знижено поріг для довгої послідовності
  const phraseScore = Math.max(threeGramOverlap * 0.75, fiveGramOverlap);
  const pageBonus = candidate.sourceText ? 1 : 0.72; // Трохи більше значення для повних текстів

  // Додаємо більше ваги на n-грами та довгі послідовності
  const score = clampScore(
    (overlapPercent * 0.15 + 
     phraseScore * 0.35 + 
     runScore * 0.25 + 
     hashOverlap * 0.15 + 
     fullTextRank * 0.1) * 100 * pageBonus
  );

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
    excerpt: normalizeWhitespace(chunkText).split(" ").slice(0, 48).join(" ")
  };
}
