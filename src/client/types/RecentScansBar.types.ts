import type { UserScanHistoryItem, ScanReport } from "../../shared/types/index";
export type StoredScanItem = UserScanHistoryItem;

export interface RecentScansBarProps {
  currentReportId?: string | null;
  onSelectReport: (report: ScanReport) => void;
}
