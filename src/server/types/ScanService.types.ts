import type { PlagiarismMatch, SearchDiagnostics } from "../../shared/types/index.js";


export type ChunkMatch = {
  chunkText: string;
  match: PlagiarismMatch;
};

export type ChunkSearchResult = {
  matches: ChunkMatch[];
  diagnostics: SearchDiagnostics;
};
