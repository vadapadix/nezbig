import type { SearchCandidate, SearchDiagnostics } from "../../shared/types/index.js";

export type SearchProfile = {
  hydrateLimit?: number;
  includeAcademic?: boolean;
  queryLimit?: number;
};

export type WebSearchResult = {
  candidates: SearchCandidate[];
  diagnostics: SearchDiagnostics;
};

export type ProviderTask = {
  provider: string;
  run: () => Promise<SearchCandidate[]>;
};

export type PageReadResult = {
  text?: string;
  attempted: boolean;
  cacheHit: boolean;
  negativeCacheHit: boolean;
};
