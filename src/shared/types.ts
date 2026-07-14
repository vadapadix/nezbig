export type ScanSettings = {
  maxChunks: number;
  chunkWords: number;
  overlapWords: number;
  sensitivity: "quick" | "balanced" | "deep";
};

export type UploadedText = {
  text: string;
  html?: string;
  fileName: string;
  wordCount: number;
  fileEvidence?: FileEvidence;
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

export type HumanizeRequest = {
  text: string;
  html?: string;
};

export type HumanizeChange = {
  label: string;
  count: number;
  detail: string;
};

export type HumanizeResult = {
  originalWordCount: number;
  revisedWordCount: number;
  revisedText: string;
  revisedHtml?: string;
  changes: HumanizeChange[];
  notes: string[];
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

export type SearchProviderDiagnostic = {
  provider: string;
  attempted: number;
  succeeded: number;
  failed: number;
  timedOut: number;
  results: number;
  skippedReason?: string;
};

export type SearchDiagnostics = {
  providers: SearchProviderDiagnostic[];
  pages: {
    attempted: number;
    verified: number;
    unavailable: number;
    cacheHits: number;
    negativeCacheHits: number;
  };
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
  submittedEvidence?: string;
  sourceEvidence?: string;
};

export type AiSignal = {
  label: string;
  score: number;
  detail: string;
  category?: "statistical" | "pattern" | "structure" | "safeguard";
  evidence?: string[];
};

export type AiReliability = {
  level: "low" | "medium" | "high";
  score: number;
  segmentCount: number;
  segmentSpread: number;
  reason: string;
};

export type AiVerdict = "insufficient" | "low" | "uncertain" | "mixed" | "elevated" | "high";

export type AiLanguageCoverage = {
  code: "uk" | "en" | "mixed" | "limited";
  supportedPercent: number;
  reason: string;
};

export type AiContentExclusions = {
  analyzedWords: number;
  codeWords: number;
  quotedWords: number;
  referenceWords: number;
};

export type AiSuspiciousSegment = {
  index: number;
  startWord: number;
  endWord: number;
  score: number;
  excerpt: string;
  evidence: string[];
};

export type FileEvidence = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  extension: string;
  extractionMethod: "plain-text" | "docx" | "pdf";
  extractedWordCount: number;
  extractedCharCount: number;
  signals: AiSignal[];
};

export type ScanReport = {
  id: string;
  fileName: string;
  checkedAt: string;
  wordCount: number;
  chunksChecked: number;
  plagiarismScore: number;
  aiProbability: number;
  aiVerdict: AiVerdict;
  aiReliability: AiReliability;
  aiLanguage: AiLanguageCoverage;
  aiExclusions: AiContentExclusions;
  aiSuspiciousSegments: AiSuspiciousSegment[];
  aiProvider: "local" | "openrouter" | "nvidia-nim";
  aiModel?: string;
  aiNote?: string;
  aiOpinionProbability?: number;
  aiOpinionModel?: string;
  aiOpinionNote?: string;
  aiOpinionSignals?: AiSignal[];
  scanNotes?: string[];
  searchDiagnostics?: SearchDiagnostics;
  skippedTitleWords?: number;
  fileEvidence?: FileEvidence;
  matches: PlagiarismMatch[];
  aiSignals: AiSignal[];
  summary: string;
};

export type LlmOpinion = {
  aiProbability: number;
  aiProvider: "openrouter" | "nvidia-nim";
  aiModel: string;
  aiNote?: string;
  aiSignals: AiSignal[];
};
