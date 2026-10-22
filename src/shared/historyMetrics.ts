import type { ScanReport, UserScanHistoryItem } from "./types/index.js";

export function isSearchUnavailable(report: ScanReport): boolean {
  const providers = report.searchDiagnostics?.providers ?? [];
  const succeeded = providers.reduce((sum, provider) => sum + provider.succeeded, 0);
  const attempts = providers.reduce((sum, provider) => sum + provider.attempted, 0);
  return succeeded === 0 && (attempts > 0 || providers.some((provider) => /повторних помилок/i.test(provider.skippedReason ?? "")));
}

export function historyItemFromReport(report: ScanReport): UserScanHistoryItem {
  return {
    id: report.id,
    fileName: report.fileName,
    checkedAt: report.checkedAt,
    plagiarismScore: report.plagiarismScore,
    matchedTextPercent: isSearchUnavailable(report) ? undefined : report.matchedTextPercent,
    wordCount: report.wordCount,
    aiProbability: report.aiVerdict === "insufficient" ? undefined : report.aiProbability
  };
}

export function historyMetrics(item: UserScanHistoryItem) {
  const source = item.fullReport ? historyItemFromReport(item.fullReport) : item;
  return { coverage: source.matchedTextPercent, ai: source.aiProbability };
}
