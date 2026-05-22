export type ScanSettings = {
  maxChunks: number;
  chunkWords: number;
  overlapWords: number;
  sensitivity: "quick" | "balanced" | "deep";
};

export type UploadedText = {
  text: string;
  fileName: string;
  wordCount: number;
};

export type ScanRequest = {
  text: string;
  fileName?: string;
  settings: ScanSettings;
};

export type LlmOpinionRequest = {
  text: string;
  localProbability: number;
  localSignals: AiSignal[];
};

export type SearchCandidate = {
  title: string;
  url: string;
  snippet: string;
  query?: string;
  provider?: string;
  sourceText?: string;
  verifiedTextLength?: number;
};

export type PlagiarismMatch = SearchCandidate & {
  chunkIndex: number;
  score: number;
  overlapPercent: number;
  ngramOverlapPercent: number;
  hashOverlapPercent: number;
  fullTextRank: number;
  longestRun: number;
  confidence: "snippet" | "page";
  excerpt: string;
};

export type AiSignal = {
  label: string;
  score: number;
  detail: string;
  category?: "statistical" | "pattern" | "structure" | "safeguard";
  evidence?: string[];
};

export type ScanReport = {
  id: string;
  fileName: string;
  checkedAt: string;
  wordCount: number;
  chunksChecked: number;
  plagiarismScore: number;
  aiProbability: number;
  aiProvider: "local" | "openrouter";
  aiModel?: string;
  aiNote?: string;
  aiOpinionProbability?: number;
  aiOpinionModel?: string;
  aiOpinionNote?: string;
  aiOpinionSignals?: AiSignal[];
  scanNotes?: string[];
  skippedTitleWords?: number;
  matches: PlagiarismMatch[];
  aiSignals: AiSignal[];
  summary: string;
};

export type LlmOpinion = {
  aiProbability: number;
  aiProvider: "openrouter";
  aiModel: string;
  aiNote?: string;
  aiSignals: AiSignal[];
};
