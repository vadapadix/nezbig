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
  const [activeTab, setActiveTab] = useState<"sources" | "ai" | "technical">(
    report.plagiarismScore > 0 || report.matches.length > 0
      ? "sources"
      : report.aiProbability >= 25
        ? "ai"
        : "sources"
  );

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

  // Filter out any provider diagnostic strings from notes to avoid duplication with ProviderDiagnostics
  const filteredNotes = (report.scanNotes?.filter(Boolean) ?? []).filter(
    (note) => !/^Вебіндекси:|^Web indexes:|^Перевірка сторінок:|^Page verification:/i.test(note)
  );

  const isClean = report.plagiarismScore <= 15 && report.aiProbability <= 20;
  const isHighRisk = report.plagiarismScore >= 35 || report.aiProbability >= 50;

  return (
    <section ref={reportRef} className="report flex flex-col gap-6" aria-labelledby="report-title">
      {/* 1. Executive Hero Dashboard */}
      <div className="p-6 md:p-8 rounded-3xl border border-white/10 bg-surface-container/90 backdrop-blur-xl shadow-xl flex flex-col gap-6">
        {/* Header Bar: Meta & Export Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-glow border border-emerald-500/30">
                {lang === "uk" ? "Офіційний звіт Незбіг" : "Official Nezbig Report"}
              </span>
              <time className="text-xs text-slate-400 font-mono" dateTime={report.checkedAt}>
                {new Intl.DateTimeFormat(lang === "uk" ? "uk-UA" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.checkedAt))}
              </time>
            </div>
            <h2 id="report-title" className="text-headline-md md:text-headline-lg text-white font-bold break-all leading-tight">
              {report.fileName}
            </h2>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                copiedLink
                  ? "bg-emerald-glow/20 border-emerald-glow text-emerald-glow shadow-sm"
                  : "border-slate-700 hover:border-emerald-glow/50 text-slate-200 hover:text-emerald-glow bg-surface-container-high/60"
              }`}
              type="button"
              onClick={handleCopyLink}
              title={copiedLink ? (lang === "uk" ? "Посилання скопійовано" : "Link copied") : (lang === "uk" ? "Копіювати посилання" : "Copy Link")}
            >
              <span className="material-symbols-outlined text-[18px]">
                {copiedLink ? "check" : "share"}
              </span>
              <span>{copiedLink ? (lang === "uk" ? "Скопійовано!" : "Поділитися") : (lang === "uk" ? "Поділитися" : "Share")}</span>
            </button>
            <ExportToolbar report={report} />
          </div>
        </div>

        {/* Primary Overall Verdict Banner */}
        <div
          className={`p-4 md:p-5 rounded-2xl border flex items-start gap-4 transition-all ${
            isClean
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-100"
              : isHighRisk
                ? "bg-rose-500/10 border-rose-500/30 text-rose-100"
                : "bg-amber-500/10 border-amber-500/30 text-amber-100"
          }`}
        >
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-2xl ${
              isClean
                ? "bg-emerald-500/20 text-emerald-400"
                : isHighRisk
                  ? "bg-rose-500/20 text-rose-400"
                  : "bg-amber-500/20 text-amber-400"
            }`}
          >
            <span className="material-symbols-outlined">
              {isClean ? "verified" : isHighRisk ? "warning" : "info"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-body-lg font-bold text-white mb-1 leading-snug">
              {isClean
                ? (lang === "uk" ? "Текст успішно пройшов перевірку" : "Document passed verification")
                : isHighRisk
                  ? (lang === "uk" ? "Виявлено суттєві запозичення або високий ризик ШІ" : "Significant matches or elevated AI risk detected")
                  : (lang === "uk" ? "Текст містить окремі запозичення або помірні ознаки ШІ" : "Moderate matches or potential AI traces detected")}
            </h3>
            <p className="text-body-sm text-slate-300 m-0 leading-relaxed">
              {translateReportSummary(reportSummaryText(report, lang), lang)}
            </p>
          </div>
        </div>

        {/* 4 Executive Score Meters (.metrics) */}
        <div className="metrics grid grid-cols-2 lg:grid-cols-4 gap-4 m-0">
          {/* 1. Plagiarism Score */}
          <article className="p-4 md:p-5 rounded-2xl bg-surface-container-high/60 border border-white/5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-label-md font-semibold text-slate-400 uppercase tracking-wider">{t("plagiarism")}</span>
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  report.plagiarismScore >= 35 ? "bg-rose-500" : report.plagiarismScore >= 15 ? "bg-amber-500" : "bg-emerald-400"
                }`}
              />
            </div>
            <strong>{report.plagiarismScore}%</strong>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden my-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  report.plagiarismScore >= 35 ? "bg-rose-500" : report.plagiarismScore >= 15 ? "bg-amber-500" : "bg-emerald-400"
                }`}
                style={{ width: `${Math.min(100, Math.max(4, report.plagiarismScore))}%` }}
              />
            </div>
            <small className="text-xs text-slate-300">
              {riskLabel(report.plagiarismScore, lang)} {lang === "uk" ? "ризик" : "risk"} ·{" "}
              {confirmedMatchCount > 0
                ? `${confirmedMatchCount} ${lang === "uk" ? "підтвердж." : "verified"}`
                : lang === "uk" ? "0 запозичень" : "0 matches"}
            </small>
          </article>

          {/* 2. AI Stylometry Analysis */}
          <article className="p-4 md:p-5 rounded-2xl bg-surface-container-high/60 border border-white/5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-label-md font-semibold text-slate-400 uppercase tracking-wider">{t("aiAnalysis")}</span>
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  report.aiProbability >= 50 ? "bg-rose-500" : report.aiProbability >= 20 ? "bg-amber-500" : "bg-emerald-400"
                }`}
              />
            </div>
            {report.aiVerdict === "insufficient" ? (
              <strong>—</strong>
            ) : (
              <div>
                <strong>{report.aiProbability}%</strong>
                <span className="uncertainty-band text-xs text-slate-400 ml-1.5">
                  ±{uncertaintyBand(report)} {lang === "uk" ? "п.п." : "pts"}
                </span>
              </div>
            )}
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden my-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  report.aiProbability >= 50 ? "bg-rose-500" : report.aiProbability >= 20 ? "bg-amber-500" : "bg-emerald-400"
                }`}
                style={{ width: `${Math.min(100, Math.max(4, report.aiProbability))}%` }}
              />
            </div>
            <small className="text-xs text-slate-300">{aiMetricCaption(report, lang)}</small>
          </article>

          {/* 3. AI Opinion (LLM) */}
          <article className="p-4 md:p-5 rounded-2xl bg-surface-container-high/60 border border-white/5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-label-md font-semibold text-slate-400 uppercase tracking-wider">{t("aiOpinion")}</span>
              <span className="material-symbols-outlined text-slate-400 text-sm">smart_toy</span>
            </div>
            <strong>{report.aiOpinionProbability !== undefined ? `${report.aiOpinionProbability}%` : "…"}</strong>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden my-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (report.aiOpinionProbability ?? 0) >= 50 ? "bg-rose-500" : (report.aiOpinionProbability ?? 0) >= 20 ? "bg-amber-500" : "bg-emerald-400"
                }`}
                style={{ width: `${Math.min(100, Math.max(4, report.aiOpinionProbability ?? 0))}%` }}
              />
            </div>
            <small className="text-xs text-slate-300 truncate">
              {report.aiOpinionProbability !== undefined
                ? `${riskLabel(report.aiOpinionProbability, lang)} ${t("levelFromModel")}`
                : llmBusy
                  ? t("modelThinking")
                  : t("noModelResponse")}
            </small>
          </article>

          {/* 4. Document Volume & Chunks */}
          <article className="p-4 md:p-5 rounded-2xl bg-surface-container-high/60 border border-white/5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-label-md font-semibold text-slate-400 uppercase tracking-wider">{t("fragments")}</span>
              <span className="material-symbols-outlined text-slate-400 text-sm">description</span>
            </div>
            <strong>{formatNumber(report.chunksChecked, lang)}</strong>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden my-2">
              <div className="h-full rounded-full bg-primary" style={{ width: "100%" }} />
            </div>
            <small className="text-xs text-slate-300">
              {formatNumber(report.wordCount, lang)} {t("wordsCount")}
            </small>
          </article>
        </div>

        {/* Quick Processing Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="px-3 py-1 rounded-lg bg-surface-container-high border border-white/5 text-xs text-slate-300 font-medium flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-slate-400">text_snippet</span>
            <span>{formatNumber(report.wordCount, lang)} {t("wordsCount")}</span>
          </span>

          {report.skippedBibliographyWords ? (
            <span className="px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-300 font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-indigo-400">menu_book</span>
              <span>{lang === "uk" ? "Список джерел виключено:" : "Bibliography excluded:"} {formatNumber(report.skippedBibliographyWords, lang)} {t("wordsCount")}</span>
            </span>
          ) : null}

          {report.skippedTitleWords ? (
            <span className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-emerald-400">school</span>
              <span>{lang === "uk" ? "Титулку виключено:" : "Title page excluded:"} {formatNumber(report.skippedTitleWords, lang)} {t("wordsCount")}</span>
            </span>
          ) : null}

          {report.fileEvidence && (
            <span className="px-3 py-1 rounded-lg bg-surface-container-high border border-white/5 text-xs text-slate-300 font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-slate-400">attach_file</span>
              <span>{report.fileEvidence.fileName} ({Math.round(report.fileEvidence.sizeBytes / 1024)} KB)</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Interactive Navigation Tabs (Segmented Control) */}
      <div className="flex flex-wrap p-1.5 rounded-2xl bg-surface-container-high/70 backdrop-blur-md border border-white/10 gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab("sources")}
          className={`flex-1 min-w-[150px] py-3 px-4 rounded-xl font-medium text-body-md transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
            activeTab === "sources"
              ? "bg-emerald-glow/20 border border-emerald-glow/60 text-emerald-glow shadow-md"
              : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">policy</span>
          <span>{lang === "uk" ? "Джерела та збіги" : "Sources & Matches"}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
              report.matches.length > 0 ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"
            }`}
          >
            {report.matches.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ai")}
          className={`flex-1 min-w-[150px] py-3 px-4 rounded-xl font-medium text-body-md transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
            activeTab === "ai"
              ? "bg-emerald-glow/20 border border-emerald-glow/60 text-emerald-glow shadow-md"
              : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">psychology</span>
          <span>{lang === "uk" ? "Аналіз ШІ та AI-думка" : "AI Analysis & Opinion"}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
              report.aiProbability >= 50
                ? "bg-rose-500/20 text-rose-300"
                : report.aiProbability >= 20
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-emerald-500/20 text-emerald-300"
            }`}
          >
            {report.aiVerdict === "insufficient" ? "—" : `${report.aiProbability}%`}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("technical")}
          className={`flex-1 min-w-[150px] py-3 px-4 rounded-xl font-medium text-body-md transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
            activeTab === "technical"
              ? "bg-emerald-glow/20 border border-emerald-glow/60 text-emerald-glow shadow-md"
              : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">tune</span>
          <span>{lang === "uk" ? "Додаткові відомості" : "Technical Details"}</span>
        </button>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: Sources & Matches */}
      {activeTab === "sources" && (
        <div className="animate-in fade-in duration-200">
          <PlagiarismMatches
            matches={report.matches}
            confirmedMatchCount={confirmedMatchCount}
            leadMatchCount={leadMatchCount}
            allSearchProvidersFailed={allSearchProvidersFailed}
          />
        </div>
      )}

      {/* TAB 2: AI Analysis & AI Opinion */}
      {activeTab === "ai" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          {/* AI Opinion Highlight Box */}
          <section className="p-6 rounded-2xl border border-slate-700/80 bg-surface-container/90 flex flex-col gap-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                </div>
                <div>
                  <h3 className="text-body-lg font-bold text-white m-0">
                    {lang === "uk" ? "AI-думка від нейромережі" : "Independent AI Opinion"}
                  </h3>
                  <span className="text-xs text-slate-400">
                    {report.aiOpinionModel ? `Модель: ${report.aiOpinionModel}` : (lang === "uk" ? "Глибинний семантичний аналіз" : "Deep semantic inspection")}
                  </span>
                </div>
              </div>

              {report.aiOpinionProbability !== undefined ? (
                <span className={`px-3 py-1 rounded-xl text-label-md font-bold ${
                  report.aiOpinionProbability >= 50
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    : report.aiOpinionProbability >= 20
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                }`}>
                  {report.aiOpinionProbability}% · {riskLabel(report.aiOpinionProbability, lang)} {lang === "uk" ? "ризик" : "risk"}
                </span>
              ) : null}
            </div>

            {report.aiOpinionProbability !== undefined ? (
              <div className="flex flex-col gap-3">
                <p className="text-body-md text-slate-200 m-0 leading-relaxed">
                  {report.aiOpinionNote || (lang === "uk" ? "Модель перевірила стилістику та структуру речень." : "Model verified style and phrasing.")}
                </p>
                {onRetryOpinion && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={onRetryOpinion}
                      className="text-xs text-slate-400 hover:text-emerald-glow flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">refresh</span>
                      <span>{lang === "uk" ? "Оновити оцінку AI-думки" : "Refresh AI opinion"}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : llmBusy ? (
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center gap-3 text-purple-200">
                <span className="material-symbols-outlined animate-spin text-[20px] text-purple-400">progress_activity</span>
                <span className="text-body-sm">
                  {lang === "uk"
                    ? "ШІ-модель формує незалежний вердикт щодо стилю та синтаксису тексту..."
                    : "AI model is assessing authorial style and syntactic patterns..."}
                </span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-surface-container-high/50 border border-white/5">
                <span className="text-body-sm text-slate-300">
                  {lang === "uk" ? "AI-думка ще не була отримана для цього документа." : "AI opinion has not been fetched yet for this document."}
                </span>
                {onRetryOpinion && (
                  <button
                    type="button"
                    onClick={onRetryOpinion}
                    className="px-4 py-2 rounded-xl bg-emerald-glow/20 border border-emerald-glow text-emerald-glow text-xs font-semibold hover:bg-emerald-glow/30 transition-all cursor-pointer shrink-0"
                  >
                    {lang === "uk" ? "Запитати AI-думку" : "Request AI Opinion"}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* AI Suspicious Segments */}
          <div>
            {report.aiSuspiciousSegments.length > 0 ? (
              <SuspiciousSegments segments={report.aiSuspiciousSegments} />
            ) : (
              <section className="segment-panel p-6 rounded-2xl border border-slate-700/80 bg-surface-container/90" aria-labelledby="ai-clean-status">
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                  <h3 id="ai-clean-status" className="text-body-lg font-bold text-white m-0">
                    {lang === "uk" ? "Підозрілі фрагменти ШІ" : "AI Suspicious Segments"}
                  </h3>
                  <span className="text-xs text-emerald-400 font-semibold">{lang === "uk" ? "0 фрагментів" : "0 segments"}</span>
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
      )}

      {/* TAB 3: Technical Details & Diagnostics */}
      {activeTab === "technical" && (
        <div className="p-6 md:p-8 rounded-2xl border border-slate-800 bg-surface-container/85 flex flex-col gap-6 shadow-inner animate-in fade-in duration-200">
          {/* 1. Search Providers Health (Unified, NOT duplicated!) */}
          {report.searchDiagnostics && (
            <div>
              <h4 className="text-label-lg font-bold text-slate-300 uppercase tracking-wider mb-2">
                {lang === "uk" ? "Стан пошукових індексів" : "Search Provider Status"}
              </h4>
              <ProviderDiagnostics diagnostics={report.searchDiagnostics} />
            </div>
          )}

          {/* 2. Processing Notes (Filtered to avoid provider duplication) */}
          {filteredNotes.length > 0 && (
            <div>
              <h4 className="text-label-lg font-bold text-slate-300 uppercase tracking-wider mb-2">
                {lang === "uk" ? "Примітки обробки тексту" : "Processing Notes"}
              </h4>
              <div className="flex flex-wrap gap-2">
                {filteredNotes.map((note) => (
                  <span key={note} className="px-3 py-1.5 rounded-lg border border-slate-700/60 bg-surface-container text-body-sm text-slate-300">
                    {translateScanNote(note, lang)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 3. Comprehensive NLP Stylometry */}
          <div>
            <h4 className="text-label-lg font-bold text-slate-300 uppercase tracking-wider mb-3">
              {lang === "uk" ? "Повний стилометричний аналіз" : "Comprehensive Stylometric Analysis"}
            </h4>
            <AiAnalysisPanel report={report} llmBusy={llmBusy} primarySignals={primaryAiSignals} onRetryOpinion={onRetryOpinion} />
          </div>

          {/* 4. Secondary Stylometric Factors */}
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

          {/* 5. File Details */}
          {report.fileEvidence && (
            <div className="text-label-sm text-slate-400 border-t border-slate-800 pt-3 flex flex-wrap gap-4">
              <span><strong>{lang === "uk" ? "Файл:" : "File:"}</strong> {report.fileEvidence.fileName}</span>
              <span><strong>{lang === "uk" ? "Розмір:" : "Size:"}</strong> {Math.round(report.fileEvidence.sizeBytes / 1024)} KB</span>
              <span><strong>{lang === "uk" ? "Метод:" : "Method:"}</strong> {report.fileEvidence.extractionMethod}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
