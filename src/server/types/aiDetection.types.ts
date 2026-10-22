import type { AiContentExclusions, AiLanguageCoverage, AiReliability, AiSignal, AiSuspiciousSegment, AiVerdict } from "../../shared/types/index.js";
import type { suspiciousSegments } from "../domain/analysis/aiDetection.js";

export type SignalDraft = AiSignal & {
  weight: number;
};

export type AiDetectionResult = {
  probability: number;
  verdict: AiVerdict;
  signals: AiSignal[];
  reliability: AiReliability;
  language: AiLanguageCoverage;
  exclusions: AiContentExclusions;
  suspiciousSegments: AiSuspiciousSegment[];
};

export type AnalysisWindow = {
  index: number;
  startWord: number;
  endWord: number;
  text: string;
};
