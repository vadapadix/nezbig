import type { ScanReport } from "../../shared/types/index";

export interface NezbigFileContainer {
  format: "nezbig-report";
  version: 1;
  app: string;
  generatedAt: string;
  report: ScanReport;
}
