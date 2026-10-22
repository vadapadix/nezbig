import type { PlagiarismMatch, SearchDiagnostics } from "../../shared/types/index.js";
import type { chunkText } from "../domain/analysis/chunking.js";

export type ChunkMatch = {
  chunkText: string;
  match: PlagiarismMatch;
};

export type ChunkSearchResult = {
  matches: ChunkMatch[];
  diagnostics: SearchDiagnostics;
};
