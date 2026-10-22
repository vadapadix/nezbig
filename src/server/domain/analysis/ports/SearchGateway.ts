import type { SearchCandidate, SearchDiagnostics } from "../../../../shared/types/index.js";
export interface SearchProfile {
  hydrateLimit?: number;
  includeAcademic?: boolean;
  queryLimit?: number;
}
export interface SearchResult {
  candidates: SearchCandidate[];
  diagnostics: SearchDiagnostics;
}
export interface SearchGateway {
  search(text: string, maxResults: number, deep: boolean, profile: SearchProfile): Promise<SearchResult>;
  hydrate(candidates: SearchCandidate[], limit: number): Promise<SearchResult>;
  rerank(text: string, candidates: SearchCandidate[]): Promise<SearchCandidate[]>;
}
export interface AnalysisLogger {
  warn(error: unknown, message?: string): void;
}
