import { normalizeWhitespace } from "../chunking.js";

export const STOP_WORDS = new Set([
  "але", "або", "для", "про", "при", "що", "це", "цей", "ця", "цих", "так", "які", "який", "яка", "було", "були", "бути",
  "the", "and", "that", "with", "from", "this", "have", "are", "was", "were"
]);

export function tokenize(text: string, keepStopWords = false): string[] {
  const tokens = normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);

  return keepStopWords ? tokens : tokens.filter((word) => !STOP_WORDS.has(word));
}

export function splitSentences(text: string): string[] {
  return normalizeWhitespace(text)
    .split(/(?<=[.!?…])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function standardDeviation(values: number[], average: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 1;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average === 0) return 1;
  return standardDeviation(values, average) / average;
}

export function countRegexMatches(text: string, regex: RegExp): string[] {
  const matches = text.match(regex) ?? [];
  return matches.map((match) => normalizeWhitespace(match)).filter(Boolean);
}

export function sampleEvidence(values: string[], max = 4): string[] {
  return [...new Set(values.map((value) => value.slice(0, 120)))].slice(0, max);
}

export function buildNgrams(tokens: string[], size: number): Set<string> {
  const ngrams = new Set<string>();
  for (let index = 0; index <= tokens.length - size; index += 1) {
    ngrams.add(tokens.slice(index, index + size).join(" "));
  }
  return ngrams;
}

export function overlapRatio(source: Set<string>, candidate: Set<string>): number {
  if (source.size === 0) return 0;
  let matches = 0;
  for (const item of source) {
    if (candidate.has(item)) matches += 1;
  }
  return matches / source.size;
}

export function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
