import { useState } from "react";
import type { ScanReport } from "../../shared/types";
import { ExportToolbar } from "./ExportToolbar";
import { AiAnalysisPanel } from "./AiAnalysisPanel";
import { SuspiciousSegments } from "./SuspiciousSegments";
import { PlagiarismMatches } from "./PlagiarismMatches";
import { ProviderDiagnostics } from "./ProviderDiagnostics";
import { SignalCard } from "./SignalCard";
import { useLanguage } from "../context/LanguageContext";
import { formatNumber, riskLabel, aiMetricCaption, reportSummaryText, uncertaintyBand } from "../utils/reportLabels";
import { translateReportSummary, translateScanNote } from "../utils/reportI18n";

interface ReportViewProps {
  report: ScanReport;
  llmBusy: boolean;
  reportRef: React.RefObject<HTMLElement | null>;
  onRetryOpinion?: () => void;
}

export function ReportView({ report, llmBusy, reportRef, onRetryOpinion }: ReportViewProps) {
  const { lang, t } = useLanguage();
  const [copiedLink, setCopiedLink] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const confirmedMatchCount = report.matches.filter((match) => match.confidence === "page").length;
  const leadMatchCount = report.matches.length - confirmedMatchCount;
  const searchAttemptCount = report.searchDiagnostics?.providers.reduce((sum, provider) => sum + provider.attempted, 0) ?? 0;
  const searchSuccessCount = report.searchDiagnostics?.providers.reduce((sum, provider) => sum + provider.succeeded, 0) ?? 0;
  const searchCircuitOpen = report.searchDiagnostics?.providers.some((provider) => /повторних помилок/i.test(provider.skippedReason ?? "")) ?? false;
  const allSearchProvidersFailed = searchSuccessCount === 0 && (searchAttemptCount > 0 || searchCircuitOpen);

  const aiSignalSplit = Math.max(1, Math.ceil(report.aiSignals.length / 2));
  const primaryAiSignals = report.aiSignals.slice(0, aiSignalSplit);
  const secondaryAiSignals = report.aiSignals.slice(aiSignalSplit);

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/history/${report.id}`;
    void navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const filteredNotes = report.scanNotes?.filter(Boolean) ?? [];

  return (
    <section ref={reportRef} className="report" aria-labelledby="report-title">
      {/* 1. Header with metadata and actions */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-6 border-b border-white/10">
        <div className="min-w-0 flex-1">
          <p className="font-label-sm text-label-sm text-emerald-glow tracking-wider uppercase mb-1">
            {lang === "uk" ? "Звіт Незбіг" : "Nezbig Report"}
          </p>
          <h2 id="report-title" className="font-headline-lg text-headline-lg text-white font-bold break-all leading-tight">
            {report.fileName}
          </h2>
          <p className="text-body-md text-slate-100 mt-2 leading-relaxed max-w-3xl">
            {translateReportSummary(reportSummaryText(report, lang), lang)}
          </p>
        </div>
        <div className="flex flex-col lg:items-end gap-3 shrink-0">
          <time className="text-label-sm text-on-surface-variant font-mono" dateTime={report.checkedAt}>
            {new Intl.DateTimeFormat(lang === "uk" ? "uk-UA" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.checkedAt))}
          </time>
          <div className="flex flex-wrap items-center gap-2">
            <button 
              className={`px-3.5 py-2 rounded-xl border text-body-md font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                copiedLink
                  ? "bg-emerald-glow/20 border-emerald-glow text-emerald-glow shadow-sm"
                  : "border-emerald-glow/40 text-emerald-glow hover:bg-emerald-glow/10"
              }`}
              type="button" 
              onClick={handleCopyLink}
              title={copiedLink ? (lang === "uk" ? "Посилання скопійовано" : "Link copied") : (lang === "uk" ? "Копіювати посилання" : "Copy Link")}
            >
              <span className="material-symbols-outlined text-[18px]">
                {copiedLink ? "check" : "link"}
              </span>
              <span>{copiedLink ? (lang === "uk" ? "Скопійовано!" : "Copied!") : (lang === "uk" ? "Копіювати посилання" : "Copy Link")}</span>
            </button>
            <ExportToolbar report={report} />
          </div>
        </div>
      </div>

      {/* 2. Main Verdict Cards (Executive Metrics) */}
      <div className="metrics">
        <article>
          <span>{t("plagiarism")}</span>
          <strong>{report.plagiarismScore}%</strong>
          <small>{riskLabel(report.plagiarismScore, lang)} {lang === "uk" ? "ризик" : "risk"}</small>
        </article>
        <article>
          <span>{t("aiAnalysis")}</span>
          {report.aiVerdict === "insufficient" ? (
            <strong>—</strong>
          ) : (
            <>
              <strong>{report.aiProbability}%</strong>
              <small className="uncertainty-band">±{uncertaintyBand(report)} {lang === "uk" ? "п.п." : "pts"}</small>
            </>
          )}
          <small>{aiMetricCaption(report, lang)}</small>
        </article>
        <article>
          <span>{t("aiOpinion")}</span>
          <strong>{report.aiOpinionProbability !== undefined ? `${report.aiOpinionProbability}%` : "…"}</strong>
          <small>
            {report.aiOpinionProbability !== undefined
              ? `${riskLabel(report.aiOpinionProbability, lang)} ${t("levelFromModel")}`
              : llmBusy
                ? t("modelThinking")
                : t("noModelResponse")}
          </small>
        </article>
        <article>
          <span>{t("fragments")}</span>
          <strong>{formatNumber(report.chunksChecked, lang)}</strong>
          <small>{formatNumber(report.wordCount, lang)} {t("wordsCount")}</small>
        </article>
      </div>

      {/* 3. Primary Actionable Findings (Plagiarism & AI Segments) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start mt-6">
        {/* Left Column: Plagiarism Sources */}
        <div className="min-w-0">
          <PlagiarismMatches
            matches={report.matches}
            confirmedMatchCount={confirmedMatchCount}
            leadMatchCount={leadMatchCount}
            allSearchProvidersFailed={allSearchProvidersFailed}
          />
        </div>

        {/* Right Column: AI Suspicious Segments */}
        <div className="min-w-0">
          {report.aiSuspiciousSegments.length > 0 ? (
            <SuspiciousSegments segments={report.aiSuspiciousSegments} />
          ) : (
            <section className="segment-panel" aria-labelledby="ai-clean-status">
              <div className="section-heading-row">
                <h3 id="ai-clean-status">{lang === "uk" ? "Підозрілі фрагменти ШІ" : "AI Suspicious Segments"}</h3>
                <span>{lang === "uk" ? "0 фрагментів" : "0 segments"}</span>
              </div>
              <div className="p-5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 flex items-start gap-3.5">
                <span className="material-symbols-outlined text-[24px] text-emerald-400 shrink-0 mt-0.5">
                  verified
                </span>
                <div>
                  <strong className="block text-slate-100 font-semibold mb-1">
                    {lang === "uk" ? "ШІ-аномалій не виявлено" : "No AI anomalies detected"}
                  </strong>
                  <p className="text-body-sm text-slate-300 m-0 leading-relaxed">
                    {lang === "uk"
                      ? "Стилометричні показники ритму, довжини речень та лексичної варіативності перебувають у межах природного авторського тексту."
                      : "Stylometric indicators for sentence rhythm, length, and lexical diversity remain within natural human writing bounds."}
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* 4. Collapsible Technical Details & Forensics */}
      <div className="mt-8 border-t border-white/10 pt-6">
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-700/60 bg-surface-container/70 hover:bg-surface-container hover:border-slate-500 transition-all cursor-pointer text-left shadow-sm group"
          aria-expanded={showTechnicalDetails}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[22px]">tune</span>
            </div>
            <div>
              <span className="font-semibold text-slate-100 text-body-md block">
                {lang === "uk" ? "Додаткові відомості та технічні деталі" : "Additional Details & Technical Diagnostics"}
              </span>
              <span className="text-label-sm text-slate-400 block mt-0.5">
                {lang === "uk"
                  ? "Пошукові індекси, примітки вилучення тексту, фактори ШІ-аналізу"
                  : "Search providers, text extraction notes, NLP stylometry factors"}
              </span>
            </div>
          </div>
          <span className={`material-symbols-outlined text-[24px] text-slate-400 transition-transform duration-200 ${showTechnicalDetails ? "rotate-180" : ""}`}>
            expand_more
          </span>
        </button>

        {showTechnicalDetails && (
          <div className="p-6 mt-3 rounded-2xl border border-slate-800 bg-surface-container-low/95 flex flex-col gap-6 shadow-inner animate-in fade-in duration-200">
            {/* Search Providers Health */}
            {report.searchDiagnostics && (
              <div>
                <h4 className="text-label-lg font-bold text-slate-300 uppercase tracking-wider mb-2">
                  {lang === "uk" ? "Стан пошукових індексів" : "Search Provider Status"}
                </h4>
                <ProviderDiagnostics diagnostics={report.searchDiagnostics} />
              </div>
            )}

            {/* Processing & Extraction Notes */}
            {filteredNotes.length > 0 && (
              <div>
                <h4 className="text-label-lg font-bold text-slate-300 uppercase tracking-wider mb-2">
                  {lang === "uk" ? "Примітки обробки тексту" : "Processing Notes"}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {report.skippedTitleWords ? (
                    <span className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-body-sm text-emerald-300 font-medium">
                      {lang === "uk" ? "Титулку пропущено:" : "Title page skipped:"} {formatNumber(report.skippedTitleWords, lang)} {t("wordsCount")}
                    </span>
                  ) : null}
                  {report.skippedBibliographyWords ? (
                    <span className="px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-body-sm text-indigo-300 font-medium">
                      {lang === "uk" ? "Список джерел виключено:" : "Bibliography excluded:"} {formatNumber(report.skippedBibliographyWords, lang)} {t("wordsCount")}
                    </span>
                  ) : null}
                  {filteredNotes.map((note) => (
                    <span key={note} className="px-3 py-1.5 rounded-lg border border-slate-700/60 bg-surface-container text-body-sm text-slate-300">
                      {translateScanNote(note, lang)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Full NLP Stylometry Analysis Panel */}
            <div>
              <h4 className="text-label-lg font-bold text-slate-300 uppercase tracking-wider mb-3">
                {lang === "uk" ? "Повний стилометричний аналіз" : "Comprehensive Stylometric Analysis"}
              </h4>
              <AiAnalysisPanel report={report} llmBusy={llmBusy} primarySignals={primaryAiSignals} onRetryOpinion={onRetryOpinion} />
            </div>

            {/* Secondary Stylometric Signals */}
            {secondaryAiSignals.length > 0 && (
              <div>
                <h4 className="text-label-lg font-bold text-slate-300 uppercase tracking-wider mb-3">
                  {lang === "uk" ? "Додаткові стилометричні фактори" : "Additional Stylometric Factors"}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {secondaryAiSignals.map((signal) => (
                    <SignalCard signal={signal} key={signal.label} />
                  ))}
                </div>
              </div>
            )}

            {/* File Metadata */}
            {report.fileEvidence && (
              <div className="text-label-sm text-slate-400 border-t border-slate-800 pt-3 flex flex-wrap gap-4">
                <span><strong>{lang === "uk" ? "Файл:" : "File:"}</strong> {report.fileEvidence.fileName}</span>
                <span><strong>{lang === "uk" ? "Розмір:" : "Size:"}</strong> {Math.round(report.fileEvidence.sizeBytes / 1024)} KB</span>
                <span><strong>{lang === "uk" ? "Метод:" : "Method:"}</strong> {report.fileEvidence.extractionMethod}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
