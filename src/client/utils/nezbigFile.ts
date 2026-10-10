import type { ScanReport } from "../../shared/types";

export interface NezbigFileContainer {
  format: "nezbig-report";
  version: 1;
  app: string;
  generatedAt: string;
  report: ScanReport;
}

/**
 * Serializes a ScanReport into a standardized .nezbig format JSON string.
 */
export function serializeNezbigReport(report: ScanReport): string {
  const container: NezbigFileContainer = {
    format: "nezbig-report",
    version: 1,
    app: "Nezbig",
    generatedAt: new Date().toISOString(),
    report,
  };
  return JSON.stringify(container, null, 2);
}

/**
 * Parses raw text content from a .nezbig or .json file and returns a validated ScanReport,
 * or null if the content is not a valid Nezbig report.
 */
export function parseNezbigReport(rawContent: string): ScanReport | null {
  try {
    const parsed = JSON.parse(rawContent);
    if (!parsed || typeof parsed !== "object") return null;

    let targetReport: any = null;

    if (parsed.format === "nezbig-report" && parsed.report && typeof parsed.report === "object") {
      targetReport = parsed.report;
    } else if (typeof parsed.id === "string" && typeof parsed.plagiarismScore === "number") {
      targetReport = parsed;
    }

    if (!targetReport) return null;

    // Minimum structural validation for ScanReport
    if (
      typeof targetReport.id !== "string" ||
      typeof targetReport.fileName !== "string" ||
      typeof targetReport.plagiarismScore !== "number" ||
      !Array.isArray(targetReport.matches)
    ) {
      return null;
    }

    // Ensure array fallbacks
    if (!Array.isArray(targetReport.aiSignals)) {
      targetReport.aiSignals = [];
    }
    if (!Array.isArray(targetReport.scanNotes)) {
      targetReport.scanNotes = [];
    }

    return targetReport as ScanReport;
  } catch {
    return null;
  }
}

/**
 * Triggers a browser download of the report in .nezbig format.
 */
export function downloadNezbigFile(report: ScanReport): void {
  const content = serializeNezbigReport(report);
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const safeName = (report.fileName || "report").replace(/[^a-z0-9а-яіїєґ]/gi, "_");
  const link = document.createElement("a");
  link.href = url;
  link.download = `nezbig-report-${safeName}.nezbig`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
