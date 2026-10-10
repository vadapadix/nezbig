import { useState, useEffect } from "react";
import type { ScanReport } from "../../shared/types";
import { listReportsFromGoogleDrive, loadReportFromGoogleDrive, type DriveReportFile } from "../utils/googleDrive";
import { useLanguage } from "../context/LanguageContext";

interface GoogleDrivePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectReport: (report: ScanReport) => void;
}

export function GoogleDrivePickerModal({ isOpen, onClose, onSelectReport }: GoogleDrivePickerModalProps) {
  const { lang } = useLanguage();
  const [files, setFiles] = useState<DriveReportFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setFiles([]);
      setError(null);
      setLoading(false);
      setLoadingFileId(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    listReportsFromGoogleDrive()
      .then((items) => {
        if (isMounted) setFiles(items);
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : (lang === "uk" ? "Не вдалося отримати файли з Google Диску" : "Failed to load files from Google Drive"));
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, lang]);

  if (!isOpen) return null;

  const handleOpenReport = async (file: DriveReportFile) => {
    setLoadingFileId(file.id);
    setError(null);
    try {
      const report = await loadReportFromGoogleDrive(file.id);
      onSelectReport(report);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : (lang === "uk" ? "Помилка при завантаженні звіту" : "Failed to open report"));
    } finally {
      setLoadingFileId(null);
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return "";
    try {
      return new Intl.DateTimeFormat(lang === "uk" ? "uk-UA" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(isoStr));
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl bg-surface-container border border-outline-variant rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drive-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-surface-container-high/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#4285F4]/10 text-[#4285F4] flex items-center justify-center shrink-0 border border-[#4285F4]/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/>
              </svg>
            </div>
            <div>
              <h3 id="drive-modal-title" className="text-base font-semibold text-white">
                {lang === "uk" ? "Звіти з Google Диску" : "Google Drive Reports"}
              </h3>
              <p className="text-xs text-on-surface-variant">
                {lang === "uk"
                  ? "Збережені файли у форматі .nezbig з вашого хмарного сховища"
                  : "Saved .nezbig files from your personal cloud storage"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-base shrink-0">error</span>
              <span className="flex-1">{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-3xl animate-spin text-emerald-glow">progress_activity</span>
              <p className="text-sm">
                {lang === "uk" ? "Завантаження списку звітів з Google Диску…" : "Fetching reports from Google Drive…"}
              </p>
            </div>
          ) : files.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-on-surface-variant/40">
                <span className="material-symbols-outlined text-3xl">folder_off</span>
              </div>
              <h4 className="text-sm font-semibold text-white">
                {lang === "uk" ? "Звітів не знайдено" : "No saved reports found"}
              </h4>
              <p className="text-xs text-on-surface-variant max-w-md">
                {lang === "uk"
                  ? "На вашому Google Диску поки немає збережених звітів Незбіг. Перевірте будь-який документ і натисніть «Google Диск» у верхньому меню звіту, щоб зберегти його туди."
                  : "No Nezbig reports found in your Google Drive yet. Run a check and click 'Google Drive' on the report toolbar to save it directly to your Drive."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {files.map((file) => {
                const isLoadingThis = loadingFileId === file.id;
                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container-high/40 hover:bg-surface-container-high border border-white/5 hover:border-emerald-glow/30 transition-all gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                        <span className="material-symbols-outlined text-lg">description</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-white truncate" title={file.name}>
                          {file.name}
                        </div>
                        <div className="text-[11px] text-on-surface-variant flex items-center gap-2 mt-0.5">
                          {file.modifiedTime && <span>{formatDate(file.modifiedTime)}</span>}
                          <span>•</span>
                          <span className="text-emerald-400/90 font-mono">.nezbig</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 text-on-surface-variant hover:text-white hover:bg-white/5 rounded-lg transition-colors text-xs"
                          title={lang === "uk" ? "Відкрити на Google Диску" : "View on Drive"}
                        >
                          <span className="material-symbols-outlined text-base">open_in_new</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleOpenReport(file)}
                        disabled={loadingFileId !== null}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoadingThis ? (
                          <>
                            <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                            <span>{lang === "uk" ? "Відкриття…" : "Opening…"}</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-xs">visibility</span>
                            <span>{lang === "uk" ? "Відкрити звіт" : "Open Report"}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-surface-container-high/40 flex justify-between items-center text-xs text-on-surface-variant">
          <span>{lang === "uk" ? "Захищено дозволом drive.file" : "Protected by drive.file permission"}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-white/10 hover:bg-white/5 text-white transition-colors cursor-pointer"
          >
            {lang === "uk" ? "Закрити" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
