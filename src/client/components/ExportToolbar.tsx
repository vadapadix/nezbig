import { useState } from "react";
import type { ScanReport } from "../../shared/types";
import { downloadReportPdf, downloadReportPng } from "../utils/reportExport";
import { useLanguage } from "../context/LanguageContext";

interface ExportToolbarProps {
  report: ScanReport;
}

export function ExportToolbar({ report }: ExportToolbarProps) {
  const { lang } = useLanguage();
  const [exportingType, setExportingType] = useState<"pdf" | "png" | "json" | null>(null);

  const downloadIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
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

  const btnClass = "px-3 py-2 rounded-xl border border-white/10 hover:border-emerald-glow/40 bg-surface-container/60 hover:bg-surface-bright text-xs font-semibold text-white/90 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="flex items-center gap-2">
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
      <button
        className={btnClass}
        type="button"
        disabled={exportingType !== null}
        onClick={handleJsonClick}
        title={lang === "uk" ? "Завантажити дані JSON" : "Download Raw JSON"}
      >
        {downloadIcon}
        <span>JSON</span>
      </button>
    </div>
  );
}
