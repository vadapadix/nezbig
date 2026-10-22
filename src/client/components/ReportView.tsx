import type { ReportViewProps, ReportTab } from "../types/ReportView.types";
export type { ReportViewProps, ReportTab } from "../types/ReportView.types";
import { useId, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { ExportToolbar } from "./ExportToolbar";
import { AiAnalysisPanel } from "./AiAnalysisPanel";
import { SuspiciousSegments } from "./SuspiciousSegments";
import { PlagiarismMatches } from "./PlagiarismMatches";
import { ProviderDiagnostics } from "./ProviderDiagnostics";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../hooks/useAuth";
import { formatNumber, formatAiOpinionVerdict } from "../utils/reportLabels";
import { translateScanNote, translateSignalLabel, translateSignalDetail, translateEvidenceItem } from "../utils/reportI18n";
import "../styles/report.css";

export const tabKeys = ["sources", "ai", "technical"] as const;

export function ReportView({ report, llmBusy, reportRef, onRetryOpinion, onBackToEditor, onMessage }: ReportViewProps) {
  const { lang, t } = useLanguage();
  const { isLoggedIn } = useAuth();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("reportTab");
  const activeTab: ReportTab = tabKeys.includes(requestedTab as ReportTab) ? (requestedTab as ReportTab) : "sources";
  const tabId = useId();
  const [copiedReportId, setCopiedReportId] = useState<string | null>(null);
  const confirmed = report.matches.filter((match) => match.confidence === "page");
  const leads = report.matches.length - confirmed.length;
  const providers = report.searchDiagnostics?.providers ?? [];
  const attempts = providers.reduce((sum, provider) => sum + provider.attempted, 0);
  const succeeded = providers.reduce((sum, provider) => sum + provider.succeeded, 0);
  const failed = providers.reduce((sum, provider) => sum + provider.failed, 0);
  const circuitOpen = providers.some((provider) => /повторних помилок/i.test(provider.skippedReason ?? ""));
  const searchUnavailable = succeeded === 0 && (attempts > 0 || circuitOpen);
  const partialSearch = succeeded > 0 && failed > 0;
  const coverageAvailable = !searchUnavailable && report.matchedTextPercent !== undefined;
  const percent = coverageAvailable ? new Intl.NumberFormat(lang === "uk" ? "uk-UA" : "en-US", { maximumFractionDigits: 1 }).format(report.matchedTextPercent!) : "—";
  const sourceCount = report.verifiedSourcesTotal ?? new Set(confirmed.map((match) => match.url.replace(/#.*$/, "").replace(/\/$/, ""))).size;
  const aiUnavailable = report.aiVerdict === "insufficient";
  const notes = (report.scanNotes ?? []).filter((note) => note && !/^Вебіндекси:|^Web indexes:|^Перевірка сторінок:|^Page verification:/i.test(note));
  const tabs: Array<{ key: ReportTab; label: string; meta?: string }> = [
    { key: "sources", label: lang === "uk" ? "Джерела та збіги" : "Sources & matches", meta: formatNumber(report.matches.length, lang) },
    { key: "ai", label: lang === "uk" ? "Фрагменти з ознаками ШІ" : "AI signal excerpts" },
    { key: "technical", label: lang === "uk" ? "Методика й деталі" : "Method & details" }
  ];

  function selectTab(key: ReportTab) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("reportTab", key);
        return next;
      },
      { replace: true, preventScrollReset: true }
    );
  }

  function handleTabKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index + tabs.length - 1) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    selectTab(tabs[next]!.key);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  async function copyPrivateLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/history/${report.id}`);
      setCopiedReportId(report.id);
      onMessage?.(
        lang === "uk" ? "Приватне посилання скопійовано. Воно доступне лише у вашому обліковому записі." : "Private link copied. Only your account can open it.",
        "success"
      );
    } catch {
      onMessage?.(
        lang === "uk" ? "Не вдалося скопіювати посилання. Дозвольте доступ до буфера обміну та повторіть." : "Could not copy the link. Allow clipboard access and retry.",
        "error"
      );
    }
  }

  return (
    <section ref={reportRef} className="report results-report" aria-labelledby="report-title">
      <header className="results-header">
        <div className="results-heading">
          <div className="results-topline">
            {onBackToEditor && (
              <button type="button" className="results-back" onClick={onBackToEditor}>
                <span aria-hidden="true">←</span> {lang === "uk" ? "До редактора" : "Back to editor"}
              </button>
            )}
            <span className="results-eyebrow">{lang === "uk" ? "Результат перевірки" : "Text analysis report"}</span>
          </div>
          <h1 id="report-title">{report.fileName}</h1>
          <p className="results-meta">
            <time dateTime={report.checkedAt}>
              {new Intl.DateTimeFormat(lang === "uk" ? "uk-UA" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.checkedAt))}
            </time>
            <span aria-hidden="true">·</span>
            <span>
              {formatNumber(report.wordCount, lang)} {t("wordsCount")}
            </span>
          </p>
        </div>
        <div className="results-actions">
          <ExportToolbar report={report} onMessage={onMessage} />
          {isLoggedIn && (
            <button type="button" className="results-link" onClick={() => void copyPrivateLink()}>
              {copiedReportId === report.id ? (lang === "uk" ? "Посилання скопійовано" : "Link copied") : lang === "uk" ? "Копіювати приватне посилання" : "Copy private link"}
            </button>
          )}
        </div>
      </header>

      <div className="results-overview" aria-label={lang === "uk" ? "Короткий огляд результату" : "Result overview"}>
        <div className="results-coverage">
          <p className="results-eyebrow">{lang === "uk" ? "ШІ-аналіз" : "AI analysis"}</p>
          <div className="results-percentage">
            {aiUnavailable ? "—" : report.aiProbability}
            {!aiUnavailable && <span>%</span>}
          </div>
          <p className="results-caption">
            {lang === "uk"
              ? "Індикатор ознак ШІ у стилі тексту. Це не доказ авторства; пояснення оцінки наведені нижче."
              : "Indicator of AI-like writing patterns. This is not proof of authorship; see the explanation below."}
          </p>
          <section className="results-section" aria-labelledby={`${tabId}-opinion`} aria-busy={llmBusy}>
            <div className="results-section-heading">
              <div>
                <p className="results-eyebrow">{lang === "uk" ? "Додаткова оцінка" : "Additional assessment"}</p>
                <h2 id={`${tabId}-opinion`}>{lang === "uk" ? "ШІ-думка" : "AI opinion"}</h2>
              </div>
              {report.aiOpinionProbability !== undefined && <span className="results-indicator">{report.aiOpinionProbability}%</span>}
            </div>
            <div role="status" aria-live="polite">
              {llmBusy ? (
                <p className="results-pending">
                  <span aria-hidden="true" className="results-spinner" />
                  {lang === "uk" ? "Модель аналізує текст… Основний звіт уже доступний." : "The model is analyzing the text… Your main report is already available."}
                </p>
              ) : report.aiOpinionProbability !== undefined ? (
                <p className="results-opinion">{formatAiOpinionVerdict(report, lang)}</p>
              ) : (
                <p className="results-caption">
                  {report.aiOpinionError ||
                    (lang === "uk"
                      ? "Відповідь моделі поки недоступна. Локальний аналіз і перевірка джерел працюють окремо."
                      : "The model response is unavailable. Local analysis and source verification work separately.")}
                </p>
              )}
            </div>
            {onRetryOpinion && (
              <button className="results-button" type="button" disabled={llmBusy} onClick={onRetryOpinion}>
                {llmBusy
                  ? lang === "uk"
                    ? "Очікування відповіді…"
                    : "Waiting for response…"
                  : report.aiOpinionProbability !== undefined
                    ? lang === "uk"
                      ? "Оновити AI-думку"
                      : "Refresh AI opinion"
                    : lang === "uk"
                      ? "Повторити запит до моделі"
                      : "Retry model request"}
              </button>
            )}
          </section>
        </div>
        <div className="results-reading">
          <p className="results-eyebrow">{lang === "uk" ? "Плагіат · знайдені збіги" : "Plagiarism · discovered matches"}</p>
          <div className="results-percentage results-plagiarism-percentage">
            {percent}
            {coverageAvailable && <span>%</span>}
          </div>
          <p className="results-coverage-caption">
            {coverageAvailable
              ? lang === "uk"
                ? `${formatNumber(report.matchedWords ?? 0, lang)} із ${formatNumber(report.wordCount, lang)} слів збігаються з джерелами`
                : `${formatNumber(report.matchedWords ?? 0, lang)} of ${formatNumber(report.wordCount, lang)} words match sources`
              : searchUnavailable
                ? lang === "uk"
                  ? "Вебпошук не завершено"
                  : "Web search did not complete"
                : lang === "uk"
                  ? "Для цього звіту покриття не обчислено"
                  : "Coverage is unavailable for this report"}
          </p>
          <p className="results-caption">
            {lang === "uk"
              ? "Частка підтверджених дослівних збігів, включно з цитатами. Перефразування та невідомі джерела сюди не входять. Наявність плагіату визначають після перевірки контексту й посилань."
              : "Verified verbatim coverage, including quotations. Paraphrases and undiscovered sources are excluded. Plagiarism requires reviewing context and citations."}
          </p>
          <h2 className="results-context-heading">
            {searchUnavailable
              ? lang === "uk"
                ? "Пошук потребує повторної перевірки"
                : "Search needs another attempt"
              : confirmed.length
                ? lang === "uk"
                  ? "Перегляньте збіги в контексті"
                  : "Review matches in context"
                : leads
                  ? lang === "uk"
                    ? "Джерела ще потребують підтвердження"
                    : "Sources still need verification"
                  : lang === "uk"
                    ? "Підтверджених джерел не знайдено"
                    : "No verified sources found"}
          </h2>
          <p className="results-caption">
            {searchUnavailable
              ? lang === "uk"
                ? "Провайдери не повернули успішних відповідей. Нуль збігів у цьому стані не підтверджує оригінальність."
                : "No provider returned a successful response. Zero matches in this state does not establish originality."
              : confirmed.length
                ? lang === "uk"
                  ? "Спільний текст може бути цитатою або запозиченням. Зіставте фрагменти з першоджерелами й перевірте посилання."
                  : "Shared text may be a quotation or borrowing. Compare excerpts with their sources and check citations."
                : lang === "uk"
                  ? "Висновок стосується лише доступних перевірених джерел. Він не є сертифікатом оригінальності."
                  : "This finding concerns only accessible verified sources. It is not a certificate of originality."}
          </p>
          <dl className="results-facts">
            <div>
              <dt>{lang === "uk" ? "Підтверджені джерела" : "Verified sources"}</dt>
              <dd>{formatNumber(sourceCount, lang)}</dd>
            </div>
            <div>
              <dt>{lang === "uk" ? "Найсильніший збіг" : "Strongest match"}</dt>
              <dd>{searchUnavailable ? "—" : `${report.plagiarismScore}/100`}</dd>
            </div>
          </dl>
          {partialSearch && (
            <p className="results-notice">
              {lang === "uk"
                ? "Частина пошукових запитів завершилася помилкою. Знайдені збіги доступні нижче; покриття пошуку обмежене."
                : "Some search requests failed. Discovered matches are shown below; search coverage is limited."}
            </p>
          )}
        </div>
      </div>

      <nav className="results-jump" aria-label={lang === "uk" ? "Швидкий перехід у звіті" : "Report shortcuts"}>
        <a href={`#${tabId}-sources-section`} onClick={() => selectTab("sources")}>
          {lang === "uk" ? "Джерела та збіги ↓" : "Sources & matches ↓"}
        </a>
        <a href={`#${tabId}-ai-explanation`}>{lang === "uk" ? "Розширений ШІ-аналіз ↓" : "Detailed AI analysis ↓"}</a>
      </nav>
      <div id={`${tabId}-sources-section`} className="results-tabs" role="tablist" aria-label={lang === "uk" ? "Розділи звіту" : "Report sections"}>
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`${tabId}-${tab.key}`}
            aria-selected={activeTab === tab.key}
            aria-controls={`${tabId}-${tab.key}-panel`}
            tabIndex={activeTab === tab.key ? 0 : -1}
            onClick={() => selectTab(tab.key)}
            onKeyDown={(event) => handleTabKeys(event, index)}
          >
            {tab.label}
            {tab.meta && <span>{tab.meta}</span>}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.key}
          id={`${tabId}-${tab.key}-panel`}
          role="tabpanel"
          aria-labelledby={`${tabId}-${tab.key}`}
          tabIndex={0}
          className="results-panel"
          hidden={activeTab !== tab.key}
        >
          {activeTab === "sources" && tab.key === "sources" && (
            <PlagiarismMatches
              key={report.id}
              matchesTotal={report.matchesTotal}
              matches={report.matches}
              confirmedMatchCount={confirmed.length}
              leadMatchCount={leads}
              allSearchProvidersFailed={searchUnavailable}
            />
          )}
          {activeTab === "ai" && tab.key === "ai" && (
            <div className="results-ai">
              {report.aiSuspiciousSegments.length ? (
                <SuspiciousSegments segments={report.aiSuspiciousSegments} />
              ) : (
                <section className="results-section">
                  <h2>{lang === "uk" ? "Підозрілих сегментів не виділено" : "No suspicious segments highlighted"}</h2>
                  <p className="results-caption">
                    {lang === "uk"
                      ? "Це не підтверджує людське авторство. Врахуйте надійність оцінки та обмеження аналізу."
                      : "This does not establish human authorship. Consider assessment reliability and analysis limitations."}
                  </p>
                </section>
              )}
            </div>
          )}
          {activeTab === "technical" && tab.key === "technical" && (
            <div className="results-method">
              {report.searchDiagnostics && (
                <details className="results-details">
                  <summary>{lang === "uk" ? "Стан пошукових провайдерів" : "Search provider status"}</summary>
                  <ProviderDiagnostics diagnostics={report.searchDiagnostics} />
                </details>
              )}
              {notes.length > 0 && (
                <details className="results-details">
                  <summary>{lang === "uk" ? "Обробка документа" : "Document processing"}</summary>
                  <ul className="results-notes">
                    {notes.map((note, index) => (
                      <li key={index}>{translateScanNote(note, lang)}</li>
                    ))}
                  </ul>
                  {report.fileEvidence && (
                    <p className="results-caption">
                      {report.fileEvidence.fileName} · {formatNumber(Math.round(report.fileEvidence.sizeBytes / 1024), lang)} KB · {report.fileEvidence.extractionMethod}
                    </p>
                  )}
                </details>
              )}
              {report.aiOpinionModel && (
                <details className="results-details">
                  <summary>{lang === "uk" ? "Відомості про мовну модель" : "Language model details"}</summary>
                  <p className="results-caption">{report.aiOpinionModel}</p>
                  {report.aiOpinionNote && <p className="results-caption">{report.aiOpinionNote}</p>}
                </details>
              )}
            </div>
          )}
        </div>
      ))}
      {report.aiOpinionSignals?.length ? (
        <section className="opinion-evidence" aria-labelledby={`${tabId}-opinion-evidence`}>
          <header>
            <p className="results-eyebrow">{lang === "uk" ? "Пояснення ШІ-думки" : "AI opinion explained"}</p>
            <h2 id={`${tabId}-opinion-evidence`}>{lang === "uk" ? "На що звернула увагу модель" : "What the model noticed"}</h2>
            <p className="results-caption">
              {lang === "uk"
                ? "Оцінки окремих ознак пояснюють відповідь моделі та не є відсотком ШІ у всьому документі."
                : "Individual signal scores explain the model response; they are not the AI percentage of the whole document."}
            </p>
          </header>
          <div className="opinion-evidence-list">
            {report.aiOpinionSignals.map((signal, index) => (
              <article className="opinion-evidence-row" key={`${signal.label}-${index}`}>
                <div className="opinion-evidence-label">
                  <h3>{translateSignalLabel(signal.label, lang)}</h3>
                  <span aria-label={lang === "uk" ? `Оцінка ознаки: ${signal.score} зі 100` : `Signal score: ${signal.score} out of 100`}>
                    {signal.score}
                    <small>/100</small>
                  </span>
                </div>
                <div className="opinion-evidence-content">
                  <p>{translateSignalDetail(signal.detail, lang)}</p>
                  {signal.evidence?.length ? (
                    <ul aria-label={lang === "uk" ? "Приклади з аналізу" : "Analysis examples"}>
                      {signal.evidence.map((item, itemIndex) => (
                        <li key={itemIndex}>{translateEvidenceItem(item, lang)}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div id={`${tabId}-ai-explanation`} className="results-ai-anchor">
        <AiAnalysisPanel report={report} />
      </div>

      <p className="results-footnote">
        {lang === "uk"
          ? "Звіт допомагає перевірити текст і джерела. Остаточний висновок потребує перегляду людиною."
          : "This report supports reviewing text and sources. A final conclusion requires human review."}
      </p>
    </section>
  );
}
