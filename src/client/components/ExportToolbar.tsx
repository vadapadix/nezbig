import { useState } from "react";
import type { ScanReport } from "../../shared/types";
import { downloadReportPdf, downloadReportPng } from "../utils/reportExport";
import { saveReportToGoogleDrive } from "../utils/googleDrive";
import { useLanguage } from "../context/LanguageContext";

interface ExportToolbarProps {
  report: ScanReport;
  onMessage?: (msg: string, type?: "success" | "error" | "info") => void;
}

export function ExportToolbar({ report, onMessage }: ExportToolbarProps) {
  const { lang } = useLanguage();
  const [exportingType, setExportingType] = useState<"pdf" | "png" | "json" | "drive" | null>(null);
  const [driveSaved, setDriveSaved] = useState(false);

  const downloadIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  );

  const googleDriveIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-[#4285F4]">
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/>
    </svg>
  );

  const handleFileClick = async (type: "pdf" | "png") => {
    setExportingType(type);
    try {
      if (type === "pdf") await downloadReportPdf(report, lang);
      else await downloadReportPng(report, lang);
    } catch {
      onMessage?.(lang === "uk" ? "Не вдалося створити звіт. Повторіть завантаження." : "Could not create the report. Retry the download.", "error");
    } finally { setExportingType(null); }
  };

  const handleJsonClick = () => {
    setExportingType("json");
    try {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = report.fileName.replace(/[^a-z0-9а-яіїєґ]/gi, "_");
      a.download = `${safeName}_report.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingType(null);
    }
  };

  const handleDriveClick = async () => {
    setExportingType("drive");
    setDriveSaved(false);
    try {
      await saveReportToGoogleDrive(report);
      setDriveSaved(true);
      onMessage?.(
        lang === "uk"
          ? "Звіт збережено на Google Диск"
          : "Report saved to Google Drive",
        "success"
      );
      setTimeout(() => setDriveSaved(false), 3000);
    } catch (error) {
      onMessage?.(
        error instanceof Error
          ? error.message
          : (lang === "uk" ? "Помилка при збереженні на Google Диск" : "Failed to save to Google Drive"),
        "error"
      );
    } finally {
      setExportingType(null);
    }
  };

  const btnClass = "px-3 py-2 rounded-xl border border-white/10 hover:border-emerald-glow/40 bg-surface-container/60 hover:bg-surface-bright text-xs font-semibold text-white/90 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={exportingType !== null}>
      {/* Save to Google Drive */}
      <button
        className={btnClass}
        type="button"
        disabled={exportingType !== null}
        onClick={handleDriveClick}
        title={lang === "uk" ? "Зберегти копію звіту на Google Диск" : "Save report copy to Google Drive"}
      >
        {exportingType === "drive" ? (
          <span className="material-symbols-outlined text-sm animate-spin text-[#4285F4]">progress_activity</span>
        ) : driveSaved ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-glow shrink-0">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          googleDriveIcon
        )}
        <span>
          {exportingType === "drive"
            ? (lang === "uk" ? "Збереження…" : "Saving…")
            : driveSaved
              ? (lang === "uk" ? "Збережено!" : "Saved!")
              : "Google Диск"}
        </span>
      </button>

      {/* PDF */}
      <button
        className={btnClass}
        type="button"
        disabled={exportingType !== null}
        onClick={() => void handleFileClick("pdf")}
        title={lang === "uk" ? "Завантажити PDF-звіт" : "Download PDF Report"}
      >
        {downloadIcon}
        <span>{exportingType === "pdf" ? "PDF…" : "PDF"}</span>
      </button>

      {/* PNG */}
      <button
        className={btnClass}
        type="button"
        disabled={exportingType !== null}
        onClick={() => void handleFileClick("png")}
        title={lang === "uk" ? "Завантажити зображення звіту" : "Download PNG Image"}
      >
        {downloadIcon}
        <span>{exportingType === "png" ? "PNG…" : "PNG"}</span>
      </button>

      {/* JSON */}
      <button
        className={btnClass}
        type="button"
        disabled={exportingType !== null}
        onClick={handleJsonClick}
        title={lang === "uk" ? "Завантажити вихідні дані JSON" : "Download Raw JSON"}
      >
        {downloadIcon}
        <span>JSON</span>
      </button>
    </div>
  );
}
