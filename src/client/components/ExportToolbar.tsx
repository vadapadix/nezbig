import { useState } from "react";
import type { ScanReport } from "../../shared/types";
import { downloadReportPdf, downloadReportPng } from "../utils/reportExport";
import { downloadNezbigFile } from "../utils/nezbigFile";
import { saveReportToGoogleDrive } from "../utils/googleDrive";
import { useLanguage } from "../context/LanguageContext";

interface ExportToolbarProps {
  report: ScanReport;
  onMessage?: (msg: string, type?: "success" | "error" | "info") => void;
}

export function ExportToolbar({ report, onMessage }: ExportToolbarProps) {
  const { lang } = useLanguage();
  const [exportingType, setExportingType] = useState<"pdf" | "png" | "json" | "nezbig" | "drive" | null>(null);
  const [driveSavedUrl, setDriveSavedUrl] = useState<string | null>(null);

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

  const handlePdfClick = () => {
    setExportingType("pdf");
    setTimeout(() => {
      try {
        downloadReportPdf(report, lang);
      } finally {
        setExportingType(null);
      }
    }, 20);
  };

  const handlePngClick = () => {
    setExportingType("png");
    setTimeout(() => {
      try {
        downloadReportPng(report, lang);
      } finally {
        setExportingType(null);
      }
    }, 20);
  };

  const handleNezbigClick = () => {
    setExportingType("nezbig");
    try {
      downloadNezbigFile(report);
      onMessage?.(
        lang === "uk"
          ? "Звіт збережено у форматі .nezbig. Ви можете відкрити його в застосунку в будь-який момент!"
          : "Report saved in .nezbig format. You can reopen it in the app anytime!",
        "success"
      );
    } finally {
      setExportingType(null);
    }
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
    setDriveSavedUrl(null);
    try {
      const result = await saveReportToGoogleDrive(report);
      setDriveSavedUrl(result.webViewLink || null);
      onMessage?.(
        lang === "uk"
          ? `Звіт успішно збережено на Google Диск у папку «Незбіг»!`
          : `Report successfully saved to Google Drive in folder 'Незбіг'!`,
        "success"
      );
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

  const btnClass = "px-3 py-2 rounded-xl border border-white/10 hover:border-emerald-glow/40 bg-surface-container/60 hover:bg-surface-bright text-xs font-semibold text-white/90 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";
  const driveBtnClass = "px-3 py-2 rounded-xl border border-[#4285F4]/30 hover:border-[#4285F4] bg-[#4285F4]/10 hover:bg-[#4285F4]/20 text-xs font-semibold text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Save to Google Drive */}
      <button
        className={driveBtnClass}
        type="button"
        disabled={exportingType !== null}
        onClick={handleDriveClick}
        title={lang === "uk" ? "Зберегти звіт у Google Диск (.nezbig з можливістю відкриття)" : "Save report to Google Drive (.nezbig readable by Nezbig)"}
      >
        {exportingType === "drive" ? (
          <span className="material-symbols-outlined text-sm animate-spin text-[#4285F4]">progress_activity</span>
        ) : (
          googleDriveIcon
        )}
        <span>
          {exportingType === "drive"
            ? (lang === "uk" ? "Збереження…" : "Saving…")
            : driveSavedUrl
              ? (lang === "uk" ? "Збережено на Диск!" : "Saved to Drive!")
              : "Google Диск"}
        </span>
      </button>

      {driveSavedUrl && (
        <a
          href={driveSavedUrl}
          target="_blank"
          rel="noreferrer"
          className="px-2.5 py-2 rounded-xl bg-surface-container/80 hover:bg-surface-bright border border-white/10 hover:border-[#4285F4] text-xs font-medium text-[#4285F4] transition-all flex items-center gap-1"
          title={lang === "uk" ? "Переглянути файл на Google Диску" : "View file on Google Drive"}
        >
          <span className="material-symbols-outlined text-sm">open_in_new</span>
          <span>{lang === "uk" ? "Відкрити на Диску" : "View"}</span>
        </a>
      )}

      {/* Save .nezbig file */}
      <button
        className={btnClass}
        type="button"
        disabled={exportingType !== null}
        onClick={handleNezbigClick}
        title={lang === "uk" ? "Завантажити файл звіту .nezbig (для повторного відкриття)" : "Download .nezbig report file (to reopen in Nezbig)"}
      >
        <span className="material-symbols-outlined text-sm text-emerald-400">save</span>
        <span className="text-emerald-300 font-mono">.nezbig</span>
      </button>

      {/* PDF */}
      <button
        className={btnClass}
        type="button"
        disabled={exportingType !== null}
        onClick={handlePdfClick}
        title={lang === "uk" ? "Завантажити PDF-звіт" : "Download PDF Report"}
      >
        {downloadIcon}
        <span>{exportingType === "pdf" ? "PDF..." : "PDF"}</span>
      </button>

      {/* PNG */}
      <button
        className={btnClass}
        type="button"
        disabled={exportingType !== null}
        onClick={handlePngClick}
        title={lang === "uk" ? "Завантажити зображення звіту" : "Download PNG Image"}
      >
        {downloadIcon}
        <span>{exportingType === "png" ? "PNG..." : "PNG"}</span>
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
