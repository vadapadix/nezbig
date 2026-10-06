import type { ScanReport } from "../../shared/types";
import { SignalCard } from "./SignalCard";
import { useLanguage } from "../context/LanguageContext";
import { reliabilityLabel, languageLabel, formatNumber, isDuplicateOpinionSignal } from "../utils/reportLabels";
import { translateReliabilityReason } from "../utils/reportI18n";
import { stripHtml } from "../utils/sanitizeHtml";

interface AiAnalysisPanelProps {
  report: ScanReport;
  llmBusy: boolean;
  primarySignals: ScanReport["aiSignals"];
  onRetryOpinion?: () => void;
}

export function AiAnalysisPanel({ report, llmBusy, primarySignals, onRetryOpinion }: AiAnalysisPanelProps) {
  const { lang, t } = useLanguage();

  return (
    <section aria-labelledby="ai-title">
      <h3 id="ai-title">{lang === "uk" ? "Розширений AI-аналіз" : "Comprehensive AI Detection"}</h3>
      <p className="model-badge">
        {llmBusy
          ? (lang === "uk" ? "AI-думка: очікування відповіді…" : "AI Opinion: querying model…")
          : (lang === "uk" ? "Локальний AI-відсоток незалежний від LLM" : "Multi-factor NLP stylometry independent of LLM")}
      </p>
      <div className={`reliability-line reliability-${report.aiReliability.level}`}>
        <strong>
          {lang === "uk" ? "Надійність оцінки:" : "Confidence Score:"} {reliabilityLabel(report.aiReliability.level, lang)} ({report.aiReliability.score}/100)
        </strong>
        <span>
          {report.aiReliability.segmentCount} {lang === "uk" ? "сегм. · розкид" : "segm. · variance"} {report.aiReliability.segmentSpread} {lang === "uk" ? "п.п." : "pts"}
        </span>
        <p>{translateReliabilityReason(report.aiReliability.reason, lang)}</p>
      </div>
      <div className="ai-context-strip" aria-label={lang === "uk" ? "Контекст локального AI-аналізу" : "Local AI context"}>
        <span>
          <strong>{lang === "uk" ? "Мова" : "Language"}</strong>
          {languageLabel(report.aiLanguage.code, lang)} · {report.aiLanguage.supportedPercent}% {lang === "uk" ? "покриття" : "coverage"}
        </span>
        <span>
          <strong>{lang === "uk" ? "Проаналізовано" : "Analyzed"}</strong>
          {formatNumber(report.aiExclusions.analyzedWords, lang)} {t("wordsCount")}
        </span>
        {report.aiExclusions.codeWords > 0 ? (
          <span>
            <strong>{lang === "uk" ? "Код вилучено" : "Code excluded"}</strong>
            {formatNumber(report.aiExclusions.codeWords, lang)} {t("wordsCount")}
          </span>
        ) : null}
        {report.aiExclusions.quotedWords + report.aiExclusions.referenceWords > 0 ? (
          <span>
            <strong>{lang === "uk" ? "Цитати й джерела" : "Quotes & Citations"}</strong>
            {formatNumber(report.aiExclusions.quotedWords + report.aiExclusions.referenceWords, lang)} {t("wordsCount")}
          </span>
        ) : null}
      </div>
      {report.aiNote ? <p className="provider-note">{stripHtml(report.aiNote)}</p> : null}
      {report.aiOpinionError && !llmBusy ? (
        <p className="provider-note" role="status">
          {stripHtml(report.aiOpinionError)}{" "}
          {onRetryOpinion ? (
            <button type="button" className="retry-opinion-button cursor-pointer" onClick={onRetryOpinion}>
              {lang === "uk" ? "Повторити AI-думку" : "Retry AI Opinion"}
            </button>
          ) : null}
        </p>
      ) : null}
      {report.aiOpinionProbability !== undefined ? (
        <div className="opinion-panel">
          <strong>{lang === "uk" ? "AI-думка:" : "AI Opinion:"} {report.aiOpinionProbability}%</strong>
          <span>{report.aiOpinionModel}</span>
          {report.aiOpinionNote ? <p>{stripHtml(report.aiOpinionNote)}</p> : null}
        </div>
      ) : null}
      <p className="section-note">
        {lang === "uk"
          ? "Локальний ансамбль перевіряє авторський текст повністю й окремими сегментами. Відсоток є евристичним індикатором ризику, а не каліброваною ймовірністю чи доказом авторства."
          : "The NLP ensemble analyzes the entire submission as well as individual segments. The percentage represents an empirical stylometric risk indicator rather than definitive proof of authorship."}
      </p>
      <div className="signal-list">
        {primarySignals.map((signal) => (
          <SignalCard signal={signal} key={signal.label} />
        ))}
        {report.aiOpinionSignals
          ?.filter((signal) => !isDuplicateOpinionSignal(signal, report.aiSignals))
          .map((signal) => (
            <SignalCard signal={signal} className="opinion-signal" key={`opinion-${signal.label}`} />
          ))}
      </div>
    </section>
  );
}
