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

  return (
    <section ref={reportRef} className="report" aria-labelledby="report-title">
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

      {report.scanNotes && report.scanNotes.length > 0 ? (
        <div className="scan-notes" aria-label={lang === "uk" ? "Примітки перевірки" : "Scan notes"}>
          {report.skippedTitleWords ? (
            <strong>
              {lang === "uk" ? "Титулку пропущено:" : "Title page skipped:"} {formatNumber(report.skippedTitleWords, lang)} {t("wordsCount")}
            </strong>
          ) : null}
          {report.scanNotes.map((note) => (
            <span key={note}>{translateScanNote(note, lang)}</span>
          ))}
        </div>
      ) : null}

      <div className="report-grid">
        <div className="report-left-stack">
          <PlagiarismMatches
            matches={report.matches}
            confirmedMatchCount={confirmedMatchCount}
            leadMatchCount={leadMatchCount}
            allSearchProvidersFailed={allSearchProvidersFailed}
            diagnosticsNode={report.searchDiagnostics ? <ProviderDiagnostics diagnostics={report.searchDiagnostics} /> : null}
          />

          <SuspiciousSegments segments={report.aiSuspiciousSegments} />

          {secondaryAiSignals.length > 0 ? (
            <div className="signal-list signal-list-left" aria-label={lang === "uk" ? "Додаткові AI-сигнали" : "Additional AI Signals"}>
              {secondaryAiSignals.map((signal) => (
                <SignalCard signal={signal} key={signal.label} />
              ))}
            </div>
          ) : null}
        </div>

        <AiAnalysisPanel report={report} llmBusy={llmBusy} primarySignals={primaryAiSignals} onRetryOpinion={onRetryOpinion} />
      </div>
    </section>
  );
}
