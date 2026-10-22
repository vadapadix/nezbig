import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RecentScansBar } from "../../../src/client/components/RecentScansBar";
import { historyItemFromReport, historyMetrics } from "../../../src/shared/historyMetrics";
import type { ScanReport, UserScanHistoryItem } from "../../../src/shared/types/index";
import { GUEST_HISTORY_KEY } from "../../../src/client/utils/localHistory";

vi.mock("../../../src/client/hooks/useAuth", () => ({ useAuth: () => ({ isLoggedIn: false }) }));
vi.mock("../../../src/client/context/LanguageContext", () => ({ useLanguage: () => ({ lang: "uk" }) }));
const report = {
  id: "metrics",
  fileName: "document.docx",
  checkedAt: "2026-10-22T17:21:00Z",
  wordCount: 1015,
  plagiarismScore: 26,
  matchedTextPercent: 0,
  aiProbability: 4,
  aiVerdict: "low"
} as ScanReport;
const item: UserScanHistoryItem = { id: report.id, fileName: report.fileName, checkedAt: report.checkedAt, plagiarismScore: 26, aiProbability: 4 };
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("History metrics", () => {
  it("never treats match strength as coverage for an older summary", () => {
    expect(historyMetrics(item)).toEqual({ coverage: undefined, ai: 4 });
  });
  it("uses the complete report over stale cached scores", () => {
    expect(historyMetrics({ ...item, matchedTextPercent: 90, aiProbability: 99, fullReport: report })).toEqual({ coverage: 0, ai: 4 });
  });
  it("does not present unavailable analysis as zero", () => {
    const failed = { ...report, aiVerdict: "insufficient", searchDiagnostics: { providers: [{ attempted: 1, succeeded: 0, failed: 1 }] } } as ScanReport;
    expect(historyItemFromReport(failed)).toMatchObject({ matchedTextPercent: undefined, aiProbability: undefined });
  });
  it("shows explicit labels and the same values as the screenshot report", () => {
    localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify([{ ...item, fullReport: report }]));
    render(
      <MemoryRouter>
        <RecentScansBar onSelectReport={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText("Збіги 0%")).toBeInTheDocument();
    expect(screen.getByText("ШІ 4%")).toBeInTheDocument();
    expect(screen.queryByText("26%")).not.toBeInTheDocument();
  });
});
