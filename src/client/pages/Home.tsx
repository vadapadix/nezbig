import { useMemo, useState, useRef, useEffect, useCallback, Suspense, lazy } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { useScan } from "../hooks/useScan";
import { useAiOpinion } from "../hooks/useAiOpinion";
import { useDragDrop } from "../hooks/useDragDrop";
import { useDraft } from "../hooks/useDraft";
import { useFaviconProgress } from "../hooks/useFaviconProgress";
import { useDocumentEditor } from "../hooks/useDocumentEditor";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../context/LanguageContext";
import { recommendSettings, estimateScanSeconds, formatDuration, defaultSettings } from "../utils/scanSettings";
import { htmlFromPlainText } from "../richText";
import type { ScanReport } from "../../shared/types";
import { parseNezbigReport } from "../utils/nezbigFile";
import { LoadingPanel } from "../components/LoadingPanel";
import { RecentScansBar } from "../components/RecentScansBar";
import { GoogleDrivePickerModal } from "../components/GoogleDrivePickerModal";
import { BrandLogo } from "../components/BrandLogo";

import { AdsterraBanner } from "../components/AdsterraBanner";

const ReportView = lazy(() => import("../components/ReportView").then(m => ({ default: m.ReportView })));

export default function Home({ showToast }: { showToast: (msg: string, type?: "success" | "error" | "info") => void }) {
  const { t, lang } = useLanguage();
  const { isLoggedIn, syncHistory } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [settings, setSettings] = useState(defaultSettings);
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const reportRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useDocumentEditor((msg) => showToast(msg, "info"));
  const { report, setReport, busy, progress, scan, cancel } = useScan();
  const { llmBusy, loadLlmOpinion } = useAiOpinion(setReport);
  const [lastScanInput, setLastScanInput] = useState<{ text: string; file: File | null } | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  const handleFileSelection = useCallback(async (file: File) => {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".nezbig") || lowerName.endsWith(".json")) {
      try {
        const text = await file.text();
        const parsed = parseNezbigReport(text);
        if (parsed) {
          setReport(parsed);
          showToast(
            lang === "uk"
              ? `Звіт «${parsed.fileName}» успішно завантажено!`
              : `Report '${parsed.fileName}' loaded successfully!`,
            "success"
          );
          return;
        }
      } catch {
        // fallback
      }
    }
    setReport(null);
    void editor.handleFile(file);
  }, [editor, lang, showToast, setReport]);

  const isDragging = useDragDrop(mainRef, (file) => {
    void handleFileSelection(file);
  });

  const { clearDraft } = useDraft(editor.text, editor.sourceHtml, editor.fileName, (draft) => {
    editor.setEditorContent(draft.html, draft.text);
    editor.setFileName(draft.fileName);
  });

  // Handle incoming text from Humanizer or URL query
  useEffect(() => {
    const state = location.state as { text?: string; html?: string } | null;
    const queryText = searchParams.get("text");
    const incomingText = state?.text || queryText;

    if (incomingText && incomingText.trim()) {
      const html = state?.html || htmlFromPlainText(incomingText);
      editor.setEditorContent(html, incomingText);
      editor.setFileName(lang === "uk" ? "Олюднений текст" : "Humanized Text");
      editor.setSelectedFile(null);
      setReport(null);
      showToast(lang === "uk" ? "Текст перенесено до перевірки на плагіат." : "Text transferred to plagiarism checker.", "success");

      if (queryText) {
        setSearchParams({}, { replace: true });
      }
      if (state) {
        window.history.replaceState({}, "");
      }
    }
  }, [searchParams, setSearchParams, location.state, lang, showToast]);

  useFaviconProgress(progress);

  const wordCount = useMemo(() => editor.text.trim().split(/\s+/).filter(Boolean).length, [editor.text]);
  const canScan = editor.text.length >= 120 && !busy;
  const estimatedSeconds = useMemo(() => estimateScanSeconds(settings, wordCount), [settings, wordCount]);

  useEffect(() => {
    setSettings((current) => {
      const recommended = recommendSettings(wordCount, current.sensitivity);
      if (current.chunkWords === recommended.chunkWords && current.overlapWords === recommended.overlapWords) return current;
      return recommended;
    });
  }, [wordCount, settings.sensitivity]);

  useEffect(() => {
    if (!report) return;
    try {
      const stored = JSON.parse(localStorage.getItem("nezbig_local_history") || "[]");
      const filtered = stored.filter((item: any) => item.id !== report.id);
      filtered.unshift({
        id: report.id,
        fileName: report.fileName,
        checkedAt: report.checkedAt,
        plagiarismScore: report.plagiarismScore,
        wordCount: report.wordCount,
        aiProbability: report.aiProbability,
        fullReport: report
      });
      localStorage.setItem("nezbig_local_history", JSON.stringify(filtered.slice(0, 50)));
      window.dispatchEvent(new Event("nezbig_history_updated"));
      if (isLoggedIn) {
        void syncHistory();
      }
    } catch {
      // ignore
    }
    window.requestAnimationFrame(() => {
      reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [report, isLoggedIn, syncHistory]);

  function requestAiOpinion(target: ScanReport, input: { text: string; file: File | null }) {
    loadLlmOpinion(target, input.text, input.file).catch(() => {
      showToast(lang === "uk" ? "AI-думка зараз недоступна — можна спробувати ще раз у звіті." : "AI opinion currently unavailable — you can retry in the report.", "error");
    });
  }

  const handleRetryOpinion = useCallback(() => {
    if (!report) return;
    const input =
      lastScanInput ||
      (report.sourceText ? { text: report.sourceText, file: null } : null) ||
      (editor.text.trim().length >= 25 ? { text: editor.text, file: editor.selectedFile } : null);

    if (input) {
      requestAiOpinion(report, input);
    } else {
      showToast(lang === "uk" ? "Текст документа недоступний для повторного запиту." : "Document text is unavailable for retry.", "error");
    }
  }, [report, lastScanInput, editor.text, editor.selectedFile, lang, showToast]);

  async function handleSubmit() {
    if (!canScan) {
      showToast(lang === "uk" ? "Додайте файл або щонайменше 120 символів тексту." : "Please add a file or at least 120 characters of text.", "error");
      return;
    }

    // Trigger popunder ad while user waits for scan results
    try {
      const popScript = document.createElement("script");
      popScript.src = "https://pl30923795.effectivecpmnetwork.com/75/56/41/755641c675fce2ce16353c0d40e0be47.js";
      popScript.async = true;
      document.body.appendChild(popScript);
    } catch {
      // ignore
    }

    const scanSettings = recommendSettings(wordCount, settings.sensitivity);
    try {
      const result = await scan(editor.text, editor.fileName, editor.selectedFile, scanSettings);
      const input = { text: editor.text, file: editor.selectedFile };
      setLastScanInput(input);
      clearDraft();
      showToast(lang === "uk" ? "Базовий звіт готовий." : "Base report is ready.", "success");
      requestAiOpinion(result, input);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        showToast(lang === "uk" ? "Перевірку скасовано." : "Scan cancelled.", "error");
      } else {
        showToast(error instanceof Error ? error.message : (lang === "uk" ? "Перевірка не вдалася." : "Scan failed."), "error");
      }
    }
  }

  const handleBackToEditor = () => {
    setReport(null);
    cancel();
    editor.setSelectedFile(null);
    editor.setFileName(lang === "uk" ? "Вставлений текст" : "Pasted Text");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (busy || report) {
    return (
      <div className="max-w-container-max mx-auto px-gutter py-8 md:py-12 relative z-10 fade-in flex flex-col gap-6">
        {/* Previous scans above results */}
        <RecentScansBar currentReportId={report?.id} onSelectReport={(r) => { setReport(r); window.scrollTo({ top: 0, behavior: "smooth" }); }} />

        {busy && (
          <LoadingPanel busy={busy} llmBusy={llmBusy} progress={progress} estimatedSeconds={formatDuration(estimatedSeconds, lang)} onCancel={cancel} />
        )}
        {report && (
          <Suspense fallback={<div className="loading-skeleton">{lang === "uk" ? "Завантаження звіту…" : "Loading report…"}</div>}>
            <ReportView
              report={report}
              llmBusy={llmBusy}
              reportRef={reportRef}
              onRetryOpinion={handleRetryOpinion}
              onBackToEditor={handleBackToEditor}
              onMessage={showToast}
            />
            <GoogleDrivePickerModal
              isOpen={isDrivePickerOpen}
              onClose={() => setIsDrivePickerOpen(false)}
              onSelectReport={(r) => {
                setReport(r);
                showToast(lang === "uk" ? `Звіт «${r.fileName}» завантажено з Google Диску!` : `Report '${r.fileName}' loaded from Google Drive!`, "success");
              }}
            />
            <div className="flex justify-center mt-8">
              <button 
                type="button"
                onClick={handleBackToEditor} 
                className="bg-surface-variant hover:bg-surface-bright text-white px-8 py-3 rounded-xl border border-outline-variant hover:border-emerald-glow transition-all font-medium flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                <span>{lang === "uk" ? "Повернутись до редактора" : "Back to Editor"}</span>
              </button>
            </div>
          </Suspense>
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center items-start gap-4 px-2">
      {/* Left Sidebar Ad (desktop >= 1536px) */}
      <aside id="ad-left-sidebar" className="hidden 2xl:flex w-[160px] shrink-0 sticky top-24 justify-center items-center py-4 text-center">
        {/* Left skyscraper unit can be added here */}
      </aside>

      <div ref={mainRef} className="max-w-container-max flex-grow py-6 md:py-8 flex flex-col gap-6 relative z-10 fade-in w-full">
        {/* Previous scans above editor */}
        <RecentScansBar currentReportId={null} onSelectReport={(r) => { setReport(r); window.scrollTo({ top: 0, behavior: "smooth" }); }} />

        {isDragging && (
          <div className="absolute inset-0 z-50 bg-emerald-glow/10 backdrop-blur-sm border-2 border-dashed border-emerald-glow rounded-xl flex items-center justify-center">
            <p className="text-headline-lg text-emerald-glow font-bold">
              {lang === "uk" ? "Відпустіть файл для завантаження" : "Drop file to upload"}
            </p>
          </div>
        )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 flex flex-col min-h-[600px] h-[calc(100vh-240px)] rise-in d-1">
          <div className="glass-panel rounded-xl flex flex-col h-full border hover:border-emerald-glow/40 transition-colors duration-300 overflow-hidden relative group">
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
                    lang === "uk" ? "Вставте текст або завантажте файл" : "Paste text or upload document"
                  )}
                </h2>
                <span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                  {editor.formattedPreviewBusy
                    ? (lang === "uk" ? "Зчитування документа та витяг тексту…" : "Extracting document text and formatting…")
                    : (editor.selectedFile ? t("fileReady") : t("fileFormats"))}
                </span>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsDrivePickerOpen(true)}
                  className="bg-surface-variant/80 hover:bg-surface-bright text-white px-3.5 py-2 rounded-full font-label-sm text-label-sm border border-outline-variant hover:border-[#4285F4] transition-all flex items-center gap-2 cursor-pointer"
                  title={lang === "uk" ? "Відкрити збережений звіт з Google Диску" : "Open saved report from Google Drive"}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-[#4285F4] shrink-0">
                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/>
                  </svg>
                  <span className="hidden sm:inline">Google Диск</span>
                </button>

                <label className={`upload-chip ${editor.formattedPreviewBusy ? "opacity-60 cursor-wait pointer-events-none" : "hover:bg-surface-bright cursor-pointer"} bg-surface-variant/80 text-white px-4 py-2 rounded-full font-label-sm text-label-sm border border-outline-variant hover:border-emerald-glow transition-all flex items-center gap-2`}>
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
                    accept=".docx,.pdf,.nezbig,.json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void handleFileSelection(file);
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="editor-shell flex-grow p-6 relative overflow-hidden flex flex-col">
              <div
                ref={editor.editorRef}
                className="w-full h-full bg-transparent !border-0 !outline-none !shadow-none focus:!outline-none focus:!ring-0 text-body-lg text-white placeholder:text-on-surface-variant/60 custom-scrollbar !p-0 overflow-y-auto [&_*]:!text-inherit [&_*]:!bg-transparent"
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
                        ? "Витягуємо текст, структуру та готуємо до перевірки"
                        : "Extracting text, formatting, and preparing for scan"}
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

                    {/* Progress indicator bar */}
                    <div className="w-52 h-1.5 bg-white/10 rounded-full loading-bar-indeterminate" />
                  </div>
                </div>
              ) : (
                !editor.text && (
                  <div className="editor-empty pointer-events-none select-none" aria-hidden="true">
                    <span className="editor-empty-icon">
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="8" y="2" width="8" height="4" rx="1" />
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                        <path d="M9 12h6M9 16h4" />
                      </svg>
                    </span>
                    <p className="text-body-lg">{lang === "uk" ? "Вставте текст з Word або скопіюйте сюди текст..." : "Paste text from Word or type your content here..."}</p>
                    <span className="kbd-hint"><kbd>Ctrl</kbd> + <kbd>V</kbd></span>
                  </div>
                )
              )}
            </div>
            <div className="px-6 py-3 border-t border-white/10 flex justify-between items-center bg-surface-container/60 shrink-0">
              <span className="word-counter font-label-sm text-label-sm text-on-surface-variant">
                {editor.formattedPreviewBusy
                  ? (lang === "uk" ? "Завантаження документа…" : "Loading document…")
                  : `${wordCount} ${t("wordsCount")}`}
              </span>
              <button
                type="button"
                aria-label="Clear text"
                title={t("clearText")}
                disabled={editor.formattedPreviewBusy}
                className={`clear-button p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-all flex items-center justify-center ${editor.formattedPreviewBusy ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                onClick={() => {
                  editor.setEditorContent("", "");
                  editor.setSelectedFile(null);
                  editor.setFileName(lang === "uk" ? "Вставлений текст" : "Pasted Text");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  setReport(null);
                  clearDraft();
                }}
              >
                <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6 min-h-[600px] h-[calc(100vh-240px)] rise-in d-2">
          <div className="glass-panel rounded-xl p-8 flex flex-col border flex-grow overflow-y-auto custom-scrollbar">
            <h3 className="panel-eyebrow font-headline-md text-headline-md text-white mb-4">{lang === "uk" ? "Параметри" : "Scan Settings"}</h3>
            <div className="flex flex-col gap-4">
              <h4 className="font-body-lg text-body-lg text-white font-medium">{lang === "uk" ? "Режим перевірки" : "Sensitivity Mode"}</h4>
              <div className="flex flex-col gap-4">
                <label className="mode-card flex items-start gap-4 p-4 rounded-lg bg-surface-container-high/60 hover:bg-surface-bright/80 backdrop-blur-sm transition-colors cursor-pointer border border-transparent hover:border-white/20 has-[:checked]:border-emerald-glow/50 has-[:checked]:bg-emerald-glow/20">
                  <input type="radio" name="check_mode" className="mt-1" checked={settings.sensitivity === "quick"} onChange={() => setSettings(s => ({...s, sensitivity: "quick"}))} />
                  <div className="flex flex-col">
                    <span className="font-body-md text-body-md text-white font-medium">{lang === "uk" ? "Швидко" : "Standard Fast"}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">{lang === "uk" ? "Короткий огляд, менше запитів" : "Quick overview and fast report"}</span>
                  </div>
                </label>
                <label className="mode-card flex items-start gap-4 p-4 rounded-lg bg-surface-container-high/60 hover:bg-surface-bright/80 backdrop-blur-sm transition-colors cursor-pointer border border-transparent hover:border-white/20 has-[:checked]:border-emerald-glow/50 has-[:checked]:bg-emerald-glow/20">
                  <input type="radio" name="check_mode" className="mt-1" checked={settings.sensitivity === "balanced"} onChange={() => setSettings(s => ({...s, sensitivity: "balanced"}))} />
                  <div className="flex flex-col">
                    <span className="font-body-md text-body-md text-white font-medium">{lang === "uk" ? "Глибоко" : "Deep Analysis"}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">{lang === "uk" ? "Детальний аналіз, вища точність" : "Full coverage with academic indexing"}</span>
                  </div>
                </label>
                <label className="mode-card flex items-start gap-4 p-4 rounded-lg bg-surface-container-high/60 hover:bg-surface-bright/80 backdrop-blur-sm transition-colors cursor-pointer border border-transparent hover:border-white/20 has-[:checked]:border-emerald-glow/50 has-[:checked]:bg-emerald-glow/20">
                  <input type="radio" name="check_mode" className="mt-1" checked={settings.sensitivity === "deep"} onChange={() => setSettings(s => ({...s, sensitivity: "deep"}))} />
                  <div className="flex flex-col">
                    <span className="font-body-md text-body-md text-white font-medium">{lang === "uk" ? "Експертно" : "Expert Scan"}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">{lang === "uk" ? "Максимальна перевірка з науковими базами" : "Max sensitivity, Crossref & OpenAlex"}</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="stats-strip glass-panel rounded-xl p-6 border border-emerald-glow/30 relative overflow-hidden shrink-0 rise-in d-3">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-glow/20 to-transparent pointer-events-none"></div>
            <div className="flex justify-between items-center relative z-10">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant">{lang === "uk" ? "Розмір фрагмента" : "Chunk Size"}</span>
                <span className="stat-value font-body-lg text-body-lg text-white font-medium mt-1">{settings.chunkWords} {t("wordsCount")}</span>
              </div>
              <div className="flex flex-col text-center">
                <span className="font-label-sm text-label-sm text-on-surface-variant">{lang === "uk" ? "Орієнтовно" : "Est. Time"}</span>
                <span className="stat-value font-body-lg text-body-lg text-white font-medium mt-1">{estimatedSeconds <= 0 ? (lang === "uk" ? "після додавання тексту" : "add text first") : formatDuration(estimatedSeconds, lang)}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="font-label-sm text-label-sm text-on-surface-variant">{lang === "uk" ? "Перекриття" : "Overlap"}</span>
                <span className="stat-value font-body-lg text-body-lg text-white font-medium mt-1">{settings.overlapWords} {t("wordsCount")}</span>
              </div>
            </div>
          </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy || editor.formattedPreviewBusy || !canScan}
              className="cta-main group relative z-10 bg-gradient-to-br from-emerald-glow to-primary-container hover:from-primary hover:to-emerald-glow text-on-primary font-headline-md text-body-lg font-medium py-4 px-6 rounded-xl transition-all duration-300 transform hover:-translate-y-1 flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:translate-y-0 w-full shrink-0 rise-in d-4 cursor-pointer disabled:cursor-not-allowed"
            >
              {editor.formattedPreviewBusy ? (
                <>
                  <span className="material-symbols-outlined text-2xl animate-spin">progress_activity</span>
                  <span>{lang === "uk" ? "Зчитування файлу…" : "Reading file…"}</span>
                </>
              ) : (
                <>
                  <span className="relative z-10">{t("runScan")}</span>
                  <span className="relative z-10 material-symbols-outlined text-3xl transition-transform group-hover:translate-x-1">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bottom Adsterra Banner */}
        <AdsterraBanner
          containerId="container-0acae988e7ace003a0345a1c382bef41"
          scriptSrc="https://pl30923793.effectivecpmnetwork.com/0acae988e7ace003a0345a1c382bef41/invoke.js"
          className="w-full max-w-container-max mx-auto mt-2 rounded-xl border border-white/5 bg-white/[0.01] p-2 min-h-[90px]"
        />
      </div>

      {/* Right Sidebar Ad (desktop >= 1536px) */}
      <aside className="hidden 2xl:flex w-[160px] shrink-0 sticky top-24 justify-center items-center py-4 text-center">
        {/* Right skyscraper unit can be added here */}
      </aside>

      <GoogleDrivePickerModal
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        onSelectReport={(r) => {
          setReport(r);
          showToast(lang === "uk" ? `Звіт «${r.fileName}» завантажено з Google Диску!` : `Report '${r.fileName}' loaded from Google Drive!`, "success");
        }}
      />
    </div>
  );
}
