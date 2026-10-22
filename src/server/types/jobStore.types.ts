import type { ScanReport } from "../../shared/types/index.js";

export type ScanJobStatus = "pending" | "processing" | "completed" | "error";

export type ScanJob = {
  id: string;
  status: ScanJobStatus;
  progress?: {
    chunksChecked: number;
    totalChunks: number;
  };
  result?: ScanReport;
  error?: string;
  createdAt: string;
  principal: string;
  reportId?: string;
};
