import type { ReactNode } from "react";
import type { ScanReport } from "../../shared/types/index";

export interface PlagiarismMatchesProps {
  matches: ScanReport["matches"];
  confirmedMatchCount: number;
  leadMatchCount: number;
  allSearchProvidersFailed: boolean;
  diagnosticsNode?: ReactNode;
  matchesTotal?: number;
}
