import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { LanguageProvider } from "../context/LanguageContext";
import { ReportView } from "./ReportView";
import type { ScanReport, PlagiarismMatch } from "../../shared/types";

vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ isLoggedIn: true }) }));
vi.mock("./ExportToolbar", () => ({ ExportToolbar: () => <button>PDF</button> }));

const match = (confidence: "page" | "snippet", title: string): PlagiarismMatch => ({
  confidence, title, url: `https://example.com/${title}`, provider: "Test", snippet: "Source context", chunkIndex: 0,
  score: 80, overlapPercent: 60, ngramOverlapPercent: 40, hashOverlapPercent: 50, fullTextRank: 30, longestRun: 12, excerpt: "text",
  submittedEvidence: "This is the shared passage in the submitted document."
});
const baseReport = (changes: Partial<ScanReport> = {}): ScanReport => ({
  id: "report-one", fileName: "Дослідження.docx", checkedAt: "2026-10-16T09:00:00Z", wordCount: 1000, chunksChecked: 8,
  plagiarismScore: 80, matchedWords: 20, matchedTextPercent: 2, aiProbability: 25, aiVerdict: "uncertain",
  aiReliability: { level: "low", score: 30, segmentCount: 2, segmentSpread: 12, reason: "Limited evidence" },
  aiLanguage: { code: "uk", supportedPercent: 100, reason: "" },
  aiExclusions: { analyzedWords: 1000, quotedWords: 0, codeWords: 0, referenceWords: 0 },
  aiProvider: "local", aiSignals: [], aiSuspiciousSegments: [], matches: [match("page", "Verified"), match("snippet", "Lead")], summary: "summary",
  searchDiagnostics: { providers: [{ provider: "Test", attempted: 1, succeeded: 1, failed: 0, timedOut: 0, results: 2 }], pages: { attempted: 1, verified: 1, unavailable: 0, cacheHits: 0, negativeCacheHits: 0 } }, ...changes
});
function LocationProbe() { return <span data-testid="location">{useLocation().search}</span>; }
function show(report = baseReport(), options: { busy?: boolean; path?: string; retry?: () => void; message?: (text: string, type?: "success" | "error" | "info") => void } = {}) {
  return render(<MemoryRouter initialEntries={[options.path || "/"]}><LanguageProvider><ReportView report={report} llmBusy={options.busy || false} reportRef={{ current: null }} onRetryOpinion={options.retry} onMessage={options.message} /><LocationProbe /></LanguageProvider></MemoryRouter>);
}
beforeEach(() => { localStorage.setItem("nezbig_lang", "uk"); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

describe("results report", () => {
  it("keeps AI explanation and model opinion visible without opening a tab or disclosure", () => {
    show(baseReport({ aiOpinionProbability: 42 }));
    expect(screen.getByRole("heading", { name: "Розширений ШІ-аналіз" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "ШІ-думка" })).toBeVisible();
    expect(screen.getByText("42%", { selector: ".results-indicator" })).toBeVisible();
    expect(screen.getByText("25", { selector: ".results-percentage" })).toHaveTextContent("25%");
    expect(screen.queryByRole("heading", { name: "Як читати показники" })).not.toBeInTheDocument();
  });
  it("separates document coverage from strongest-match strength", () => {
    show();
    expect(screen.getByRole("heading", { level: 1, name: "Дослідження.docx" })).toBeInTheDocument();
    expect(screen.getByText("2", { selector: ".results-plagiarism-percentage" })).toHaveTextContent("2%");
    expect(screen.getByText("80/100", { selector: "dd" })).toBeInTheDocument();
    expect(screen.queryByText(/Текст є унікальним/)).not.toBeInTheDocument();
  });

  it("does not show zero coverage as success when search failed", () => {
    const item = baseReport({ matchedTextPercent: 0, matches: [] });
    item.searchDiagnostics!.providers[0] = { provider: "Test", attempted: 2, succeeded: 0, failed: 2, timedOut: 1, results: 0 };
    show(item);
    expect(screen.getByText("—", { selector: ".results-plagiarism-percentage" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Джерела не вдалося перевірити" })).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("labels legacy coverage as unknown", () => {
    show(baseReport({ matchedTextPercent: undefined, matchedWords: undefined }));
    expect(screen.getByText("Для цього звіту покриття не обчислено")).toBeInTheDocument();
  });

  it("supports arrow-key tabs, keeps focus, and preserves existing URL parameters", () => {
    show(baseReport(), { path: "/?document=kept" });
    const sources = screen.getByRole("tab", { name: /Джерела та збіги/ });
    sources.focus();
    fireEvent.keyDown(sources, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Аналіз ШІ" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Аналіз ШІ" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("location")).toHaveTextContent("document=kept&reportTab=ai");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Аналіз ШІ");
  });

  it("keeps AI loading separate from the completed source report and disables duplicate retries", () => {
    const retry = vi.fn();
    show(baseReport(), { path: "/?reportTab=ai", busy: true, retry });
    expect(screen.getByRole("status")).toHaveTextContent("Основний звіт уже доступний");
    expect(screen.getByRole("button", { name: "Очікування відповіді…" })).toBeDisabled();
    expect(retry).not.toHaveBeenCalled();
  });

  it("retries unavailable model opinion without replacing source verification", () => {
    const retry = vi.fn();
    show(baseReport({ aiOpinionError: "Модель не відповіла." }), { path: "/?reportTab=ai", retry });
    fireEvent.click(screen.getByRole("button", { name: "Повторити запит до моделі" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByText("Модель не відповіла.")).toBeInTheDocument();
  });

  it("filters verified evidence separately from search leads", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Підтверджені" }));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByRole("link", { name: /Verified/ })).toBeInTheDocument();
    expect(within(panel).queryByRole("link", { name: /Lead/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Пошукові підказки" }));
    expect(within(panel).getByText(/Повний текст сторінки не підтверджено/)).toBeInTheDocument();
  });

  it("reports clipboard failure instead of claiming the link was copied", async () => {
    const message = vi.fn();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    show(baseReport(), { message });
    fireEvent.click(screen.getByRole("button", { name: "Копіювати приватне посилання" }));
    await waitFor(() => expect(message).toHaveBeenCalledWith(expect.stringContaining("Не вдалося скопіювати"), "error"));
    expect(screen.queryByRole("button", { name: "Посилання скопійовано" })).not.toBeInTheDocument();
  });
});
