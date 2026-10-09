import { useState } from "react";
import type { HumanizeResult } from "../../shared/types";
import { htmlFromPlainText, sanitizeRichHtml } from "../richText";
import { formatNumber } from "../utils/reportLabels";
import { useLanguage } from "../context/LanguageContext";

interface HumanizePanelProps {
  humanized: HumanizeResult;
  wordDownloadBusy: boolean;
  selectedFile: File | null;
  onMoveToChecker: () => void;
  onCopyFormatted: () => void;
  onDownloadForWord: () => void;
}

function getCategoryBadge(category?: string, lang?: string) {
  switch (category) {
    case "pacing":
      return { label: lang === "uk" ? "Темпоритм" : "Burstiness", color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" };
    case "syntax":
      return { label: lang === "uk" ? "Синтаксис" : "Syntax", color: "bg-purple-500/15 text-purple-300 border-purple-500/30" };
    case "vocabulary":
      return { label: lang === "uk" ? "Лексика" : "Vocabulary", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
    case "style":
      return { label: lang === "uk" ? "Стиль" : "Style", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" };
    default:
      return { label: lang === "uk" ? "Анти-кліше" : "Anti-cliché", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
  }
}

export function HumanizePanel({
  humanized,
  wordDownloadBusy,
  selectedFile,
  onMoveToChecker,
  onCopyFormatted,
  onDownloadForWord
}: HumanizePanelProps) {
  const { lang, t } = useLanguage();
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    onCopyFormatted();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const modeLabel =
    lang === "uk"
      ? humanized.mode === "natural" ? "Природний стиль" : humanized.mode === "concise" ? "Лаконічний стиль" : "Академічний стиль"
      : humanized.mode === "natural" ? "Natural Style" : humanized.mode === "concise" ? "Concise Style" : "Academic Style";

  const aiDrop =
    humanized.aiScoreBefore !== undefined && humanized.aiScoreAfter !== undefined
      ? humanized.aiScoreBefore - humanized.aiScoreAfter
      : null;

  return (
    <section className="glass-panel rounded-2xl p-6 md:p-8 border border-white/10 flex flex-col gap-8 fade-in relative overflow-hidden" aria-labelledby="humanizer-title">
      {/* Header with AI score delta */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className="font-label-sm text-label-sm text-emerald-glow tracking-wider uppercase font-semibold">
              {lang === "uk" ? "Олюднений текст" : "Humanized Output"}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-glow/10 border border-emerald-glow/30 text-emerald-glow text-label-sm font-medium">
              {modeLabel}
            </span>
          </div>
          <h2 id="humanizer-title" className="font-headline-md text-headline-md text-white font-bold">
            {lang === "uk" ? "Результат стильового редагування" : "Stylistic Humanization Results"}
          </h2>
          <p className="text-body-md text-on-surface-variant">
            {lang === "uk" ? "Обсяг:" : "Length:"} {formatNumber(humanized.originalWordCount, lang)} → {formatNumber(humanized.revisedWordCount, lang)} {t("wordsCount")}
          </p>
        </div>

        {/* AI Probability Comparison Meter */}
        {humanized.aiScoreBefore !== undefined && humanized.aiScoreAfter !== undefined && (
          <div className="flex items-center gap-4 bg-surface-container-high/80 border border-emerald-glow/30 rounded-xl p-4 shrink-0 shadow-lg">
            <div className="flex flex-col items-center">
              <span className="text-label-sm text-on-surface-variant">{lang === "uk" ? "ШІ до" : "AI Before"}</span>
              <span className="text-body-lg font-bold text-rose-400">{humanized.aiScoreBefore}%</span>
            </div>
            <svg className="w-5 h-5 text-emerald-glow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
            <div className="flex flex-col items-center">
              <span className="text-label-sm text-on-surface-variant">{lang === "uk" ? "ШІ після" : "AI After"}</span>
              <span className="text-headline-sm font-bold text-emerald-glow">{humanized.aiScoreAfter}%</span>
            </div>
            {aiDrop !== null && aiDrop > 0 && (
              <span className="ml-2 px-2.5 py-1 rounded-md bg-emerald-glow/20 border border-emerald-glow/40 text-emerald-glow text-label-sm font-bold">
                -{aiDrop}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Output Content */}
      <div className="bg-surface-container-low/80 border border-white/5 rounded-xl p-6 md:p-8 text-body-lg text-white leading-relaxed max-h-[500px] overflow-y-auto custom-scrollbar">
        <div
          className="rich-output [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-bold"
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(humanized.revisedHtml ?? htmlFromPlainText(humanized.revisedText)) }}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-4 pt-2">
        <button
          type="button"
          className="bg-gradient-to-br from-emerald-glow to-primary-container hover:from-primary hover:to-emerald-glow text-on-primary font-headline-md text-body-md font-medium py-3 px-6 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          onClick={onMoveToChecker}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{lang === "uk" ? "Перенести в перевірку" : "Run Plagiarism Scan"}</span>
        </button>

        <button
          type="button"
          className={`border px-5 py-3 rounded-xl text-body-md font-medium transition-all flex items-center gap-2 cursor-pointer ${
            copied
              ? "bg-emerald-glow/20 border-emerald-glow text-emerald-glow"
              : "bg-surface-variant hover:bg-surface-bright text-white border-white/10 hover:border-emerald-glow"
          }`}
          onClick={handleCopy}
        >
          {copied ? (
            <svg className="w-5 h-5 text-emerald-glow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25" />
            </svg>
          )}
          <span>
            {copied
              ? (lang === "uk" ? "Скопійовано!" : "Copied!")
              : (lang === "uk" ? "Копіювати текст" : "Copy Output")}
          </span>
        </button>

        <button
          type="button"
          disabled={wordDownloadBusy}
          className="bg-surface-variant hover:bg-surface-bright text-white border border-white/10 hover:border-emerald-glow px-5 py-3 rounded-xl text-body-md font-medium transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          onClick={onDownloadForWord}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          <span>
            {wordDownloadBusy
              ? (lang === "uk" ? "Збираю DOCX…" : "Building DOCX…")
              : selectedFile && /\.docx$/i.test(selectedFile.name)
                ? (lang === "uk" ? "Завантажити DOCX" : "Download DOCX")
                : (lang === "uk" ? "Завантажити для Word" : "Download for Word")}
          </span>
        </button>

        <span className="text-label-sm text-on-surface-variant ml-auto">
          {lang === "uk" ? "Збережіть файл або перенесіть у перевірку для детального аналізу." : "Save the output or transfer to scan for originality."}
        </span>
      </div>

      {/* Changes & Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/10">
        <div className="flex flex-col gap-3">
          <h3 className="font-headline-sm text-body-lg text-white font-bold flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-glow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
            <span>{lang === "uk" ? `Застосовані покращення (${humanized.changes.length})` : `Applied Enhancements (${humanized.changes.length})`}</span>
          </h3>
          {humanized.changes.length === 0 ? (
            <p className="text-body-md text-on-surface-variant/80 italic">
              {lang === "uk" ? "Помітних AI-шаблонів не виявлено, текст зберіг авторський вигляд." : "No significant AI patterns detected; original style preserved."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {humanized.changes.map((change) => {
                const badge = getCategoryBadge(change.category, lang);
                return (
                  <li key={change.label} className="p-3.5 rounded-xl bg-surface-container-high/60 border border-white/5 flex flex-col gap-1.5 transition-colors hover:border-white/10">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <strong className="text-white font-medium text-body-md">{change.label}</strong>
                        <span className={`px-2 py-0.5 rounded-md border text-[11px] font-medium uppercase tracking-wider ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-glow/10 text-emerald-glow text-label-sm font-mono font-bold">
                        {change.count}x
                      </span>
                    </div>
                    <span className="text-label-sm text-on-surface-variant leading-normal">{change.detail}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-headline-sm text-body-lg text-white font-bold flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-glow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <span>{lang === "uk" ? "Примітки та рекомендації" : "Notes & Recommendations"}</span>
          </h3>
          <ul className="flex flex-col gap-2.5">
            {humanized.notes.map((note, index) => (
              <li key={index} className="p-3.5 rounded-xl bg-surface-container-high/60 border border-white/5 text-body-md text-on-surface-variant flex items-start gap-2.5">
                <svg className="w-4 h-4 text-emerald-glow shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span className="leading-normal">{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
