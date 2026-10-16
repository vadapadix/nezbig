import { useState, type ReactNode } from "react";
import type { PlagiarismMatch, ScanReport } from "../../shared/types";
import { stripHtml } from "../utils/sanitizeHtml";
import { useLanguage } from "../context/LanguageContext";
import { formatNumber } from "../utils/reportLabels";

interface PlagiarismMatchesProps {
  matches: ScanReport["matches"];
  confirmedMatchCount: number;
  leadMatchCount: number;
  allSearchProvidersFailed: boolean;
  diagnosticsNode?: ReactNode;
}

function MatchCardItem({ match }: { match: PlagiarismMatch }) {
  const { lang } = useLanguage();
  const isConfirmed = match.confidence === "page";
  let href: string | undefined;
  let host = lang === "uk" ? "Джерело" : "Source";
  try {
    const url = new URL(match.url);
    if (["http:", "https:"].includes(url.protocol)) { href = url.href; host = url.hostname.replace(/^www\./, ""); }
  } catch { /* Imported reports may contain invalid source URLs. */ }
  return <article className="source-entry">
    <div className="source-entry-header">
      <div className="source-entry-title">
        <div className="source-host"><span>{host}</span><span className="source-status" data-verified={isConfirmed}>{isConfirmed ? (lang === "uk" ? "Сторінку підтверджено" : "Page verified") : (lang === "uk" ? "Лише пошукова підказка" : "Search lead only")}</span></div>
        <h3>{href ? <a href={href} target="_blank" rel="noreferrer">{stripHtml(match.title) || host}<span aria-hidden="true">↗</span><span className="sr-only">{lang === "uk" ? " (відкриється в новій вкладці)" : " (opens in a new tab)"}</span></a> : stripHtml(match.title) || host}</h3>
      </div>
      <div className="source-strength"><strong>{match.score}/100</strong><small>{lang === "uk" ? "сила збігу" : "match strength"}</small></div>
    </div>
    {match.snippet && <p className="source-description">{stripHtml(match.snippet)}</p>}
    {isConfirmed && match.submittedEvidence && <div className="source-evidence">
      <p>{lang === "uk" ? "Спільний фрагмент вашого тексту та джерела" : "Passage shared by your text and the source"}</p>
      <blockquote>“{match.submittedEvidence}”</blockquote>
      {match.sourceEvidence && match.sourceEvidence !== match.submittedEvidence && <p className="source-original">{lang === "uk" ? "У першоджерелі: " : "In the source: "}“{match.sourceEvidence}”</p>}
    </div>}
    {!isConfirmed && <p className="results-notice">{lang === "uk" ? "Повний текст сторінки не підтверджено. Ця підказка не входить до дослівного покриття чи підтвердженої сили збігів." : "The full page text has not been verified. This lead does not contribute to verbatim coverage or verified match strength."}</p>}
    <details className="source-metrics"><summary>{lang === "uk" ? "Деталі порівняння" : "Comparison details"}</summary>
      <dl>
        <div><dt>{lang === "uk" ? "Спільна послідовність" : "Shared sequence"}</dt><dd>{formatNumber(match.longestRun, lang)} {lang === "uk" ? "слів" : "words"}</dd></div>
        <div><dt>{lang === "uk" ? "Фрагмент документа" : "Document chunk"}</dt><dd>{formatNumber(match.chunkIndex + 1, lang)}</dd></div>
        <div><dt>{lang === "uk" ? "Пошуковий провайдер" : "Search provider"}</dt><dd>{match.provider || "Web"}</dd></div>
        <div><dt>{lang === "uk" ? "Перетин слів фрагмента" : "Chunk word overlap"}</dt><dd>{formatNumber(match.overlapPercent, lang)}%</dd></div>
        <div><dt>{lang === "uk" ? "Збіг послідовностей" : "N-gram overlap"}</dt><dd>{formatNumber(match.ngramOverlapPercent, lang)}%</dd></div>
        <div><dt>{lang === "uk" ? "Текстові відбитки" : "Fingerprint overlap"}</dt><dd>{formatNumber(match.hashOverlapPercent, lang)}%</dd></div>
      </dl>
    </details>
  </article>;
}

export function PlagiarismMatches({ matches, confirmedMatchCount, leadMatchCount, allSearchProvidersFailed, diagnosticsNode }: PlagiarismMatchesProps) {
  const { lang } = useLanguage();
  const [filter, setFilter] = useState<"all" | "verified" | "leads">("all");
  const visible = matches.filter(match => filter === "all" || (filter === "verified" ? match.confidence === "page" : match.confidence !== "page"));
  const ordered = [...visible].sort((a, b) => Number(b.confidence === "page") - Number(a.confidence === "page"));
  return <section className="source-panel" aria-labelledby="matches-title">
    <div className="source-heading"><div><h2 id="matches-title">{lang === "uk" ? "Звідки взялися збіги" : "Where the matches come from"}</h2><p className="results-caption">{lang === "uk" ? "Почніть зі спільних фрагментів. Відкрийте джерело, щоб перевірити контекст і цитування." : "Start with the shared passages. Open a source to check context and citations."}</p></div><span className="source-count">{formatNumber(confirmedMatchCount, lang)} {lang === "uk" ? "підтвердж. збігів" : "verified matches"} · {formatNumber(leadMatchCount, lang)} {lang === "uk" ? "підказок" : "leads"}</span></div>
    {diagnosticsNode}
    {confirmedMatchCount > 0 && leadMatchCount > 0 && <div className="source-filters" role="group" aria-label={lang === "uk" ? "Фільтр джерел" : "Source filter"}>{([
      { key: "all", label: lang === "uk" ? "Усі" : "All" },
      { key: "verified", label: lang === "uk" ? "Підтверджені" : "Verified" },
      { key: "leads", label: lang === "uk" ? "Пошукові підказки" : "Search leads" }
    ] as const).map(item => <button type="button" key={item.key} aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{item.label}</button>)}</div>}
    {matches.length === 0 ? <div className="source-empty"><h3>{allSearchProvidersFailed ? (lang === "uk" ? "Джерела не вдалося перевірити" : "Sources could not be checked") : (lang === "uk" ? "У перевірених джерелах збігів не знайдено" : "No matches found in checked sources")}</h3><p className="results-caption">{allSearchProvidersFailed ? (lang === "uk" ? "Пошукові провайдери не відповіли. Повторіть перевірку пізніше; відсутність збігів зараз не підтверджена." : "Search providers did not respond. Retry later; the absence of matches is not confirmed.") : (lang === "uk" ? "Цей результат обмежений доступними вебджерелами й не підтверджує унікальність усього тексту." : "This result is limited to accessible web sources and does not establish the uniqueness of the entire text.")}</p></div> : <div className="source-list">{ordered.map(match => <MatchCardItem key={`${match.url}-${match.chunkIndex}`} match={match} />)}</div>}
  </section>;
}
