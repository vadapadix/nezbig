import { useId } from "react";
import type { ScanReport } from "../../shared/types/index";
import { SignalCard } from "./SignalCard";
import { useLanguage } from "../context/LanguageContext";
import { reliabilityLabel, languageLabel, formatNumber, aiVerdictLabel } from "../utils/reportLabels";
import { translateReliabilityReason } from "../utils/reportI18n";
import { stripHtml } from "../utils/sanitizeHtml";

export function AiAnalysisPanel({ report }: { report: ScanReport }) {
  const { lang } = useLanguage();
  const titleId = useId();
  return (
    <section className="results-ai-explanation" aria-labelledby={titleId}>
      <header className="results-section-heading">
        <div>
          <p className="results-eyebrow">{lang === "uk" ? "Що вплинуло на оцінку" : "What informed the assessment"}</p>
          <h2 id={titleId}>{lang === "uk" ? "Розширений ШІ-аналіз" : "Detailed AI analysis"}</h2>
          <p className="results-caption">{aiVerdictLabel(report.aiVerdict, lang)}</p>
        </div>
      </header>
      <div className="results-ai-context">
        <section>
          <h3>{lang === "uk" ? "Наскільки надійна оцінка" : "How reliable is the assessment?"}</h3>
          <p className="results-reliability">
            {reliabilityLabel(report.aiReliability.level, lang)} · {report.aiReliability.score}/100
          </p>
          <p className="results-caption">{translateReliabilityReason(report.aiReliability.reason, lang)}</p>
        </section>
        <section>
          <h3>{lang === "uk" ? "Який текст перевірено" : "What was analyzed?"}</h3>
          <dl className="results-facts">
            <div>
              <dt>{lang === "uk" ? "Мова" : "Language"}</dt>
              <dd>{languageLabel(report.aiLanguage.code, lang)}</dd>
            </div>
            <div>
              <dt>{lang === "uk" ? "Слів для аналізу" : "Words analyzed"}</dt>
              <dd>{formatNumber(report.aiExclusions.analyzedWords, lang)}</dd>
            </div>
            <div>
              <dt>{lang === "uk" ? "Окремих фрагментів" : "Individual segments"}</dt>
              <dd>{report.aiReliability.segmentCount}</dd>
            </div>
            <div>
              <dt>{lang === "uk" ? "Зміст і структуровані таблиці виключено" : "Contents and structured table words excluded"}</dt>
              <dd>{formatNumber(report.aiExclusions.structuralWords ?? 0, lang)}</dd>
            </div>
            <div>
              <dt>{lang === "uk" ? "Цитати, джерела й код виключено" : "Quoted, reference and code words excluded"}</dt>
              <dd>{formatNumber(report.aiExclusions.quotedWords + report.aiExclusions.referenceWords + report.aiExclusions.codeWords, lang)}</dd>
            </div>
          </dl>
        </section>
      </div>
      <p className="results-notice">
        {lang === "uk"
          ? "Ознаки нижче пояснюють стиль тексту. Високий бал окремої ознаки не означає, що текст написав ШІ. Академічний стиль, короткий обсяг і мова можуть впливати на результат."
          : "These signals describe writing style. A high individual score does not establish AI authorship. Academic style, short texts and language can affect the result."}
      </p>
      {report.aiNote && <p className="results-caption">{stripHtml(report.aiNote)}</p>}
      {report.aiSignals.length ? (
        <div className="results-signal-list">
          {report.aiSignals.map((signal, index) => (
            <SignalCard key={`${signal.label}-${index}`} signal={signal} />
          ))}
        </div>
      ) : (
        <p className="results-caption">{lang === "uk" ? "Для цього звіту деталізація ознак недоступна." : "Signal details are unavailable for this report."}</p>
      )}
    </section>
  );
}
