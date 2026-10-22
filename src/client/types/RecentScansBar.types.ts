import type { ScanReport } from "../../shared/types/index";

export interface StoredScanItem {
  id: string;
  fileName: string;
  checkedAt: string;
  plagiarismScore: number;
  wordCount?: number;
  aiProbability?: number;
  fullReport?: ScanReport;
}

export interface RecentScansBarProps {
  currentReportId?: string | null;
  onSelectReport: (report: ScanReport) => void;
}
