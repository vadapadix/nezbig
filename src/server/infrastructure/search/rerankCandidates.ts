import type { SearchCandidate } from "../../../shared/types/index.js";
export async function rerankCandidates(query: string, candidates: SearchCandidate[]): Promise<SearchCandidate[]> {
  const apiKey = process.env.COHERE_API_KEY?.trim();
  if (!apiKey || candidates.length === 0) return candidates;

  try {
    const response = await fetch("https://api.cohere.ai/v1/rerank", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "rerank-multilingual-v3.0",
        query,
        documents: candidates.map((c) => c.sourceText || c.snippet),
        top_n: candidates.length
      })
    });

    if (!response.ok) {
      console.warn(`Cohere rerank failed: HTTP ${response.status}`);
      return candidates;
    }

    const payload = (await response.json()) as { results?: Array<{ index: number; relevance_score: number }> };
    if (!payload.results) return candidates;

    // Attach relevance score and sort
    const reranked = payload.results
      .map((r) => ({
        ...candidates[r.index],
        relevanceScore: r.relevance_score
      }))
      .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));

    return reranked;
  } catch (error) {
    console.warn("Error during semantic reranking:", error);
    return candidates;
  }
}

