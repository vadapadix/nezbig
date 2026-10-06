import { useState, useRef } from "react";
import { useHumanize } from "../hooks/useHumanize";
import { useDocumentEditor } from "../hooks/useDocumentEditor";
import { useWordExport } from "../hooks/useWordExport";
import { useDragDrop } from "../hooks/useDragDrop";
import { useLanguage } from "../context/LanguageContext";
import { HumanizePanel } from "../components/HumanizePanel";
import { BrandLogo } from "../components/BrandLogo";
import { useNavigate } from "react-router-dom";
import type { HumanizeMode } from "../../shared/types";

export default function HumanizePage({ showToast }: { showToast: (msg: string, type?: "success" | "error" | "info") => void }) {
  const { t, lang } = useLanguage();
  const [mode, setMode] = useState<HumanizeMode>("academic");
  const editor = useDocumentEditor((msg) => showToast(msg, "info"));
  const { humanized, setHumanized, humanizerBusy, handleHumanize } = useHumanize();
  const wordExport = useWordExport((msg) => showToast(msg, "info"));
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDragging = useDragDrop(containerRef, (file: File) => {
    if (editor.formattedPreviewBusy) return;
    setHumanized(null);
    void editor.handleFile(file);
  });

  const wordCount = editor.text.trim().split(/\s+/).filter(Boolean).length;
  const canHumanize = (editor.selectedFile !== null || wordCount >= 20) && !humanizerBusy;

  async function onHumanize() {
    if (!canHumanize) {
      showToast(lang === "uk" ? "Для редагування додайте файл або щонайменше 20 слів." : "Please add a file or at least 20 words to humanize.", "error");
      return;
    }
    showToast(lang === "uk" ? "Редагую стиль тексту згідно обраного режиму..." : "Rewriting text style according to selected mode...", "info");
    try {
      const result = await handleHumanize(editor.text, editor.sourceHtml, editor.selectedFile, mode);
      showToast(lang === "uk" ? `Редагування готове: ${result.changes.length} груп змін.` : `Humanizing complete: ${result.changes.length} groups of changes.`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : (lang === "uk" ? "Редагування не вдалося." : "Humanization failed."), "error");
    }
  }

  return (
    <div className="max-w-container-max mx-auto px-gutter py-8 md:py-12 flex flex-col gap-8 relative z-10 fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="font-headline-lg text-headline-lg font-bold text-white tracking-tight">{t("humanizeTitle")}</h1>
        <p className="text-body-lg text-on-surface-variant max-w-3xl leading-relaxed">
          {lang === "uk"
            ? "Науковий інструмент переписування тексту: усуває штучні LLM-шаблони, нормалізує темпоритм (Burstiness), перетворює пасивні форми на активні та зберігає структуру документа."
            : "Scientific text humanization engine: removes artificial LLM patterns, modulates burstiness sentence pacing, resolves passive voice, and preserves document structure."}
        </p>
      </div>

      {/* Mode Selector */}
      <div className="flex flex-col sm:flex-row gap-3 p-1.5 bg-surface-container-high/70 backdrop-blur-md rounded-2xl border border-white/10 w-full max-w-2xl">
        <button
          type="button"
          onClick={() => setMode("academic")}
          className={`flex-1 py-3 px-4 rounded-xl font-body-md font-medium transition-all flex items-center justify-center gap-2 ${
            mode === "academic"
              ? "bg-emerald-glow/20 text-emerald-glow border border-emerald-glow/40 shadow-sm"
              : "text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent"
          }`}
        >
          <span className="material-symbols-outlined text-lg">school</span>
          <span>{t("modeAcademic")}</span>
        </button>

        <button
          type="button"
          onClick={() => setMode("natural")}
          className={`flex-1 py-3 px-4 rounded-xl font-body-md font-medium transition-all flex items-center justify-center gap-2 ${
            mode === "natural"
              ? "bg-emerald-glow/20 text-emerald-glow border border-emerald-glow/40 shadow-sm"
              : "text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent"
          }`}
        >
          <span className="material-symbols-outlined text-lg">eco</span>
          <span>{t("modeNatural")}</span>
        </button>

        <button
          type="button"
          onClick={() => setMode("concise")}
          className={`flex-1 py-3 px-4 rounded-xl font-body-md font-medium transition-all flex items-center justify-center gap-2 ${
            mode === "concise"
              ? "bg-emerald-glow/20 text-emerald-glow border border-emerald-glow/40 shadow-sm"
              : "text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent"
          }`}
        >
          <span className="material-symbols-outlined text-lg">bolt</span>
          <span>{t("modeConcise")}</span>
        </button>
      </div>

      <div 
        ref={containerRef}
        className="glass-panel rounded-2xl flex flex-col h-full border border-white/10 hover:border-emerald-glow/40 transition-colors duration-300 overflow-hidden relative group min-h-[420px]"
      >
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-emerald-glow/10 backdrop-blur-sm border-2 border-dashed border-emerald-glow rounded-2xl flex items-center justify-center">
            <p className="text-headline-lg text-emerald-glow font-bold">
              {lang === "uk" ? "Відпустіть файл для олюднення" : "Drop file to humanize"}
            </p>
          </div>
        )}

        <div className="flex justify-between items-center px-6 py-4 border-b border-white/10 bg-surface-container-high/60 gap-4">
          <div className="flex flex-col min-w-0 pr-2">
            <h2 className="font-headline-sm text-headline-sm text-white font-medium truncate">
              {editor.selectedFile ? (
                <span className="flex items-center gap-2 text-emerald-glow">
                  {editor.formattedPreviewBusy ? (
                    <span className="material-symbols-outlined text-xl shrink-0 animate-spin text-emerald-glow">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-xl shrink-0">description</span>
                  )}
                  <span className="truncate max-w-[200px] sm:max-w-[340px]">{editor.selectedFile.name}</span>
                  {!editor.formattedPreviewBusy && (
                    <button
                      type="button"
                      onClick={() => {
                        editor.detachFile();
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="ml-1 text-on-surface-variant hover:text-rose-400 p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                      title={lang === "uk" ? "Відкріпити файл" : "Detach file"}
                      aria-label="Detach attached file"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  )}
                </span>
              ) : (
                lang === "uk" ? "Вставте текст або завантажте файл" : "Paste text or upload file"
              )}
            </h2>
            <span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
              {editor.formattedPreviewBusy
                ? (lang === "uk" ? "Зчитування документа та витяг тексту…" : "Extracting document text and formatting…")
                : (editor.selectedFile ? (lang === "uk" ? "Файл завантажено для стильового редагування" : "File loaded for style humanization") : t("fileFormats"))}
            </span>
          </div>

          <label className={`upload-chip ${editor.formattedPreviewBusy ? "opacity-60 cursor-wait pointer-events-none" : "hover:bg-surface-bright cursor-pointer"} bg-surface-variant/80 text-white px-4 py-2 rounded-full font-label-sm text-label-sm border border-outline-variant hover:border-emerald-glow transition-all flex items-center gap-2 shrink-0`}>
            <span className={`material-symbols-outlined text-[18px] ${editor.formattedPreviewBusy ? "animate-spin text-emerald-glow" : ""}`}>
              {editor.formattedPreviewBusy ? "progress_activity" : "upload_file"}
            </span>
            {editor.formattedPreviewBusy
              ? (lang === "uk" ? "Обробка…" : "Processing…")
              : (editor.selectedFile ? (lang === "uk" ? "Замінити файл" : "Replace file") : (lang === "uk" ? "Вибрати файл" : "Choose file"))}
            <input
              ref={fileInputRef}
              type="file"
              disabled={editor.formattedPreviewBusy}
              className="hidden"
              accept=".docx,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setHumanized(null);
                  void editor.handleFile(file);
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <div className="flex-grow p-6 relative flex flex-col">
          <div
            ref={editor.editorRef}
            className="w-full h-full min-h-[260px] bg-transparent !border-0 !outline-none !shadow-none focus:!outline-none focus:!ring-0 text-body-lg text-white placeholder:text-on-surface-variant/60 custom-scrollbar !p-0 overflow-y-auto [&_*]:!text-inherit [&_*]:!bg-transparent"
            contentEditable={!editor.formattedPreviewBusy}
            onPaste={editor.handleRichPaste}
            onInput={() => editor.syncEditorFromDom(true)}
            suppressContentEditableWarning
          />

          {editor.formattedPreviewBusy ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-surface/92 backdrop-blur-md transition-all fade-in">
              <div className="relative mb-6 flex items-center justify-center">
                <div className="w-20 h-20 rounded-2xl bg-surface-container-high/90 border border-emerald-glow/40 flex items-center justify-center shadow-xl shadow-emerald-glow/10">
                  <BrandLogo spinning={true} className="w-14 h-14" />
                </div>
                <div className="absolute -inset-1.5 rounded-2xl border border-emerald-glow/40 border-t-transparent animate-spin pointer-events-none" />
              </div>

              <div className="text-center max-w-md px-4 flex flex-col items-center">
                <h3 className="text-white font-medium text-lg md:text-xl mb-1.5 flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-emerald-glow animate-spin text-xl">progress_activity</span>
                  <span>{lang === "uk" ? "Зчитування документа…" : "Reading document…"}</span>
                </h3>
                <p className="text-on-surface-variant text-sm md:text-base leading-relaxed mb-4 text-center">
                  {lang === "uk"
                    ? "Витягуємо текст, структуру та готуємо до олюднення"
                    : "Extracting text, formatting, and preparing for humanization"}
                </p>

                {editor.selectedFile && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/90 mb-5">
                    <span className="material-symbols-outlined text-sm text-emerald-glow">description</span>
                    <span className="truncate max-w-[220px] sm:max-w-[300px]">{editor.selectedFile.name}</span>
                    <span className="text-on-surface-variant">
                      • {editor.selectedFile.size < 1024 * 1024
                          ? `${Math.round(editor.selectedFile.size / 1024)} KB`
                          : `${(editor.selectedFile.size / (1024 * 1024)).toFixed(1)} MB`}
                    </span>
                  </div>
                )}

                <div className="w-52 h-1.5 bg-white/10 rounded-full loading-bar-indeterminate" />
              </div>
            </div>
          ) : (
            !editor.text && (
              <div className="absolute top-6 left-6 text-body-lg text-on-surface-variant/50 pointer-events-none select-none">
                {lang === "uk" ? "Вставте текст сюди або завантажте документ..." : "Paste text here or upload document..."}
              </div>
            )
          )}
        </div>
      </div>

      <div className="flex justify-center mt-2 relative">
        <button
          onClick={onHumanize}
          disabled={!canHumanize || humanizerBusy}
          className="bg-emerald-glow hover:bg-emerald-glow/90 disabled:opacity-40 text-on-primary font-headline-md text-headline-sm px-8 py-4 rounded-xl shadow-lg shadow-emerald-glow/20 transition-all flex items-center gap-3 cursor-pointer disabled:cursor-not-allowed group"
        >
          {humanizerBusy ? (
            <>
              <span className="material-symbols-outlined animate-spin">refresh</span>
              <span>{t("humanizing")}</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined group-hover:rotate-12 transition-transform">auto_fix_high</span>
              <span>{t("humanizeBtn")}</span>
            </>
          )}
        </button>
      </div>

      {humanized && (
        <HumanizePanel
          humanized={humanized}
          wordDownloadBusy={wordExport.wordDownloadBusy}
          selectedFile={editor.selectedFile}
          onMoveToChecker={() => {
            navigate("/", {
              state: {
                text: humanized.revisedText,
                html: humanized.revisedHtml || ""
              }
            });
          }}
          onCopyFormatted={() => {
            void wordExport.copyFormattedForWord(humanized.revisedHtml || "", humanized.revisedText);
          }}
          onDownloadForWord={() => {
            void wordExport.downloadHumanizedForWord(humanized, editor.selectedFile, editor.fileName);
          }}
        />
      )}
    </div>
  );
}
