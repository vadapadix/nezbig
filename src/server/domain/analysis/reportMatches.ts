import type { PlagiarismMatch } from "../../../shared/types/index.js";

/** A fetched page supersedes its search snippet, even at a lower score. */
export function uniqueMatches(matches: PlagiarismMatch[]): PlagiarismMatch[] {
  const best = new Map<string, PlagiarismMatch>();
  for (const match of matches) {
    const key = `${match.url.replace(/#.*$/, "").replace(/\/$/, "")}:${match.chunkIndex}`;
    const current = best.get(key);
    const verified = match.confidence === "page";
    const currentVerified = current?.confidence === "page";
    if (!current || (verified && !currentVerified) || (verified === currentVerified && match.score > current.score)) best.set(key, match);
  }
  return [...best.values()];
}
