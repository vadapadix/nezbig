import type { ScanReport } from "../../shared/types/index";

export interface ExportToolbarProps {
  report: ScanReport;
  onMessage?: (msg: string, type?: "success" | "error" | "info") => void;
}
