import type { AiSignal } from "../../../../shared/types/index.js";
export type LocalAiResult = {
  probability: number;
  signals: AiSignal[];
  suspiciousExcerpts?: string[];
};

export type AuthorshipSignals = {
  probability: number;
  signals: AiSignal[];
  verdict?: string;
};
