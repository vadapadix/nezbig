import { useState, type ReactNode } from "react";
import type { PlagiarismMatch, ScanReport } from "../../shared/types";
import { ProviderIcon } from "./ProviderIcon";
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
  const { lang, t } = useLanguage();
  const [showMetrics, setShowMetrics] = useState(false);

  const isConfirmed = match.confidence === "page";
  const isHighMatch = match.score >= 35;

  return (
    <article className="p-5 rounded-2xl border border-slate-700/70 bg-surface-container/85 hover:border-slate-500 hover:bg-surface-container transition-all flex flex-col gap-3 shadow-sm">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-xl text-label-md font-bold flex items-center gap-1.5 ${
              isHighMatch
                ? "bg-rose-500/20 border border-rose-500/40 text-rose-300"
                : match.score >= 20
                  ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                  : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
            }`}
          >
            {match.score}% {lang === "uk" ? "збіг" : "match"}
          </span>

          <span
            className={`px-2.5 py-1 rounded-xl text-xs font-medium flex items-center gap-1.5 ${
              isConfirmed
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                : "bg-slate-700/40 border border-slate-600/40 text-slate-300"
            }`}
          >
            {isConfirmed ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-emerald-400">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            )}
            {isConfirmed
              ? lang === "uk" ? "Підтверджена сторінка" : "Verified page"
              : lang === "uk" ? "Пошуковий уривок" : "Search snippet"}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-container-high border border-white/5">
            <ProviderIcon provider={match.provider ?? ""} />
            <span>{match.provider ?? "Web"}</span>
          </span>
          <span>{lang === "uk" ? "Фрагмент" : "Chunk"} {match.chunkIndex + 1}</span>
        </div>
      </div>

      {/* Title with External Link */}
      <h4 className="text-body-lg font-bold text-white m-0 leading-snug">
        <a
          href={match.url}
          target="_blank"
          rel="noreferrer"
          className="text-slate-100 hover:text-emerald-glow transition-colors inline-flex items-center gap-1.5 group break-words"
        >
          <span className="group-hover:underline">{stripHtml(match.title)}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-emerald-glow transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </h4>

      {/* Snippet / Description */}
      {match.snippet && (
        <p className="text-body-sm text-slate-300 m-0 leading-relaxed line-clamp-3">
          {stripHtml(match.snippet)}
        </p>
      )}

      {/* Verified Quote / Evidence Excerpt */}
      {isConfirmed && match.submittedEvidence && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border-l-4 border-emerald-400 flex flex-col gap-1.5 my-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 uppercase tracking-wider">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-emerald-400">
              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h4c0 3-1.5 5-5 5v3zm14 0c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h4c0 3-1.5 5-5 5v3z" />
            </svg>
            <span>{lang === "uk" ? "Підтверджений спільний фрагмент" : "Verified common excerpt"}</span>
          </div>
          <blockquote className="text-body-sm text-slate-100 italic m-0 leading-relaxed font-sans">
            "{match.submittedEvidence}"
          </blockquote>
          {match.sourceEvidence && match.sourceEvidence !== match.submittedEvidence && (
            <div className="text-xs text-slate-400 pt-1 border-t border-emerald-500/20">
              <span className="font-semibold text-slate-300">{lang === "uk" ? "У першоджерелі:" : "In source:"}</span> "{match.sourceEvidence}"
            </div>
          )}
        </div>
      )}

      {/* Quick Summary Badges & Toggle for Deep Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-700/50 mt-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="px-2 py-0.5 rounded-md bg-surface-container-high border border-white/5">
            {lang === "uk" ? "Слова:" : "Words:"} <strong className="text-slate-200">{match.overlapPercent}%</strong>
          </span>
          <span className="px-2 py-0.5 rounded-md bg-surface-container-high border border-white/5">
            {lang === "uk" ? "Спільний блок:" : "Run:"} <strong className="text-slate-200">{match.longestRun} {t("wordsCount")}</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowMetrics(!showMetrics)}
          className="text-xs text-emerald-glow hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition-colors font-medium ml-auto"
        >
          <span>{showMetrics ? (lang === "uk" ? "Сховати метрики" : "Hide metrics") : (lang === "uk" ? "Детальні метрики" : "Forensic metrics")}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform shrink-0 ${showMetrics ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Collapsible Deep Metrics */}
      {showMetrics && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-surface-container-low/90 border border-slate-700/60 text-xs m-0 animate-in fade-in duration-150">
          <div>
            <dt className="text-slate-400">{lang === "uk" ? "N-грами" : "N-grams"}</dt>
            <dd className="text-slate-200 font-mono font-bold mt-0.5">{match.ngramOverlapPercent}%</dd>
          </div>
          <div>
            <dt className="text-slate-400">Winnowing</dt>
            <dd className="text-slate-200 font-mono font-bold mt-0.5">{match.hashOverlapPercent}%</dd>
          </div>
          <div>
            <dt className="text-slate-400">Full-text Rank</dt>
            <dd className="text-slate-200 font-mono font-bold mt-0.5">{match.fullTextRank}%</dd>
          </div>
          <div>
            <dt className="text-slate-400">{lang === "uk" ? "Статус доказу" : "Evidence State"}</dt>
            <dd className="text-slate-200 font-mono font-bold mt-0.5">
              {isConfirmed ? (lang === "uk" ? "Підтверджено" : "Verified") : (lang === "uk" ? "Уривок" : "Snippet")}
            </dd>
          </div>
        </dl>
      )}
    </article>
  );
}

export function PlagiarismMatches({
  matches,
  confirmedMatchCount,
  leadMatchCount,
  allSearchProvidersFailed,
  diagnosticsNode
}: PlagiarismMatchesProps) {
  const { lang, t } = useLanguage();

  return (
    <section className="source-panel flex flex-col gap-4" aria-labelledby="matches-title">
      <div className="section-heading-row flex items-center justify-between">
        <h3 id="matches-title" className="text-headline-sm font-bold text-white m-0">
          {t("foundSources")}
        </h3>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-surface-container-high border border-white/10 text-slate-300">
          {matches.length
            ? lang === "uk"
              ? `${formatNumber(confirmedMatchCount, lang)} підтвердж. · ${formatNumber(leadMatchCount, lang)} підказ.`
              : `${formatNumber(confirmedMatchCount, lang)} verified · ${formatNumber(leadMatchCount, lang)} leads`
            : lang === "uk" ? "0 збігів" : "0 matches"}
        </span>
      </div>
      {diagnosticsNode}
      {matches.length === 0 ? (
        <div className={`p-6 rounded-2xl border flex items-start gap-4 ${
          allSearchProvidersFailed 
            ? "border-rose-500/40 bg-rose-500/10 text-rose-200" 
            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
        }`}>
          <div className="shrink-0 mt-0.5">
            {allSearchProvidersFailed ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-400">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            )}
          </div>
          <div>
            <strong className="block text-white font-bold text-body-lg mb-1">
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
        <div className="flex flex-col gap-3.5">
          {matches.map((match) => (
            <MatchCardItem key={`${match.url}-${match.chunkIndex}`} match={match} />
          ))}
        </div>
      )}
    </section>
  );
}

