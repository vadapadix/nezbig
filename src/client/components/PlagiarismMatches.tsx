import type { ScanReport } from "../../shared/types";
import { ProviderIcon } from "./ProviderIcon";
import { stripHtml } from "../utils/sanitizeHtml";
import { useLanguage } from "../context/LanguageContext";
import { formatNumber } from "../utils/reportLabels";
import type { ReactNode } from "react";

interface PlagiarismMatchesProps {
  matches: ScanReport["matches"];
  confirmedMatchCount: number;
  leadMatchCount: number;
  allSearchProvidersFailed: boolean;
  diagnosticsNode?: ReactNode;
}

export function PlagiarismMatches({
  matches,
  confirmedMatchCount,
  leadMatchCount,
  allSearchProvidersFailed,
  diagnosticsNode
}: PlagiarismMatchesProps) {
  const { lang, t } = useLanguage();

  function confidenceLabel(value: "snippet" | "page"): string {
    if (lang === "uk") {
      return value === "page" ? "сторінку прочитано" : "лише уривок пошуку";
    }
    return value === "page" ? "full page verified" : "search snippet only";
  }

  return (
    <section className="source-panel" aria-labelledby="matches-title">
      <div className="section-heading-row">
        <h3 id="matches-title">{t("foundSources")}</h3>
        <span>
          {matches.length
            ? lang === "uk"
              ? `${formatNumber(confirmedMatchCount, lang)} підтвердж. · ${formatNumber(leadMatchCount, lang)} підказ.`
              : `${formatNumber(confirmedMatchCount, lang)} verified · ${formatNumber(leadMatchCount, lang)} leads`
            : lang === "uk" ? "0 збігів" : "0 matches"}
        </span>
      </div>
      {diagnosticsNode}
      {matches.length === 0 ? (
        <div className={`p-5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 flex items-start gap-3.5${allSearchProvidersFailed ? " search-failed-state border-risk/40 bg-risk/10" : ""}`}>
          <span className="material-symbols-outlined text-[24px] text-emerald-400 shrink-0 mt-0.5">
            {allSearchProvidersFailed ? "error_outline" : "verified"}
          </span>
          <div>
            <strong className="block text-slate-100 font-semibold mb-1">
              {allSearchProvidersFailed
                ? (lang === "uk" ? "Пошук не завершено" : "Search incomplete")
                : (lang === "uk" ? "Плагіату не виявлено" : "No plagiarism detected")}
            </strong>
            <p className="text-body-sm text-slate-300 m-0 leading-relaxed">
              {allSearchProvidersFailed
                ? (lang === "uk"
                  ? "Доступні пошукові індекси не відповіли. Відсутність збігів не підтверджена."
                  : "Search indexes did not respond. Zero matches not confirmed.")
                : (lang === "uk"
                  ? "Перевірка по відкритих вебіндексах та наукових базах не знайшла збігів чи запозичень. Текст є унікальним."
                  : "Search across open web indexes and academic repositories found no matches or borrowings. The submission appears unique.")}
            </p>
          </div>
        </div>
      ) : (
        <div className="match-list">
          {matches.map((match) => (
            <article className="match-card" key={`${match.url}-${match.chunkIndex}`}>
              <div className="match-score">
                <strong>{match.score}%</strong>
                <span>{lang === "uk" ? "Фрагмент" : "Chunk"} {match.chunkIndex + 1}</span>
              </div>
              <h4>
                <a href={match.url} target="_blank" rel="noreferrer">
                  {stripHtml(match.title)}
                </a>
              </h4>
              <p>{stripHtml(match.snippet)}</p>
              {match.confidence === "page" && match.submittedEvidence ? (
                <div className="match-evidence">
                  <strong>{lang === "uk" ? "Підтверджений спільний уривок" : "Verified Matching Excerpt"}</strong>
                  <blockquote>{match.submittedEvidence}</blockquote>
                  {match.sourceEvidence && match.sourceEvidence !== match.submittedEvidence ? <blockquote>{match.sourceEvidence}</blockquote> : null}
                </div>
              ) : (
                <p className="match-lead-note">
                  {lang === "uk"
                    ? "Пошукова підказка: сторінку ще не підтверджено, тому цей результат не впливає на загальний відсоток плагіату."
                    : "Search lead: page content not fully verified yet; does not inflate overall plagiarism score."}
                </p>
              )}
              <dl>
                <div>
                  <dt>{lang === "uk" ? "Слова" : "Words"}</dt>
                  <dd>{match.overlapPercent}%</dd>
                </div>
                <div>
                  <dt>{lang === "uk" ? "N-грам" : "N-grams"}</dt>
                  <dd>{match.ngramOverlapPercent}%</dd>
                </div>
                <div>
                  <dt>{lang === "uk" ? "Довгий збіг" : "Longest Run"}</dt>
                  <dd>{match.longestRun} {t("wordsCount")}</dd>
                </div>
                <div>
                  <dt>Winnowing</dt>
                  <dd>{match.hashOverlapPercent}%</dd>
                </div>
                <div>
                  <dt>Full-text</dt>
                  <dd>{match.fullTextRank}%</dd>
                </div>
                <div>
                  <dt>{lang === "uk" ? "Доказ" : "Evidence"}</dt>
                  <dd>{confidenceLabel(match.confidence)}</dd>
                </div>
                <div>
                  <dt>{lang === "uk" ? "Джерело:" : "Source:"}</dt>
                  <dd>
                    <ProviderIcon provider={match.provider ?? ""} /> {match.provider ?? "Web"}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
