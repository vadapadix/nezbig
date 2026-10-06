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
            <span className="font-label-sm text-label-sm text-emerald-glow tracking-wider uppercase">
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
            <span className="material-symbols-outlined text-emerald-glow text-xl">arrow_forward</span>
            <div className="flex flex-col items-center">
              <span className="text-label-sm text-on-surface-variant">{lang === "uk" ? "ШІ після" : "AI After"}</span>
              <span className="text-headline-sm font-bold text-emerald-glow">{humanized.aiScoreAfter}%</span>
            </div>
            {aiDrop !== null && aiDrop > 0 && (
              <span className="ml-2 px-2 py-1 rounded-md bg-emerald-glow/20 text-emerald-glow text-label-sm font-bold">
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
          <span className="material-symbols-outlined text-lg">check_circle</span>
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
          <span className="material-symbols-outlined text-lg">
            {copied ? "check" : "content_copy"}
          </span>
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
          <span className="material-symbols-outlined text-lg">download</span>
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
            <span className="material-symbols-outlined text-emerald-glow text-xl">auto_fix</span>
            <span>{lang === "uk" ? `Застосовані покращення (${humanized.changes.length})` : `Applied Enhancements (${humanized.changes.length})`}</span>
          </h3>
          {humanized.changes.length === 0 ? (
            <p className="text-body-md text-on-surface-variant/80 italic">
              {lang === "uk" ? "Помітних AI-шаблонів не виявлено, текст зберіг авторський вигляд." : "No significant AI patterns detected; original style preserved."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {humanized.changes.map((change) => (
                <li key={change.label} className="p-3.5 rounded-xl bg-surface-container-high/60 border border-white/5 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-white font-medium text-body-md">{change.label}</strong>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-glow/10 text-emerald-glow text-label-sm font-mono font-bold">
                      {change.count}x
                    </span>
                  </div>
                  <span className="text-label-sm text-on-surface-variant leading-normal">{change.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-headline-sm text-body-lg text-white font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-glow text-xl">info</span>
            <span>{lang === "uk" ? "Примітки та рекомендації" : "Notes & Recommendations"}</span>
          </h3>
          <ul className="flex flex-col gap-2.5">
            {humanized.notes.map((note, index) => (
              <li key={index} className="p-3.5 rounded-xl bg-surface-container-high/60 border border-white/5 text-body-md text-on-surface-variant flex items-start gap-2.5">
                <span className="material-symbols-outlined text-emerald-glow text-lg shrink-0 mt-0.5">check</span>
                <span className="leading-normal">{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
