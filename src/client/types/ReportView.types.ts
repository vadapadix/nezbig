import type { ScanReport } from "../../shared/types/index";
import type { tabKeys } from "../components/ReportView";

export interface ReportViewProps {
  report: ScanReport;
  llmBusy: boolean;
  reportRef: React.RefObject<HTMLElement | null>;
  onRetryOpinion?: () => void;
  onBackToEditor?: () => void;
  onMessage?: (msg: string, type?: "success" | "error" | "info") => void;
}

export type ReportTab = typeof tabKeys[number];
