import { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../context/LanguageContext";
import { AuthModal } from "../components/AuthModal";
import { useAiOpinion } from "../hooks/useAiOpinion";
import type { ScanReport } from "../../shared/types";

const ReportView = lazy(() => import("../components/ReportView").then(m => ({ default: m.ReportView })));

interface HistoryItem {
  id: string;
  fileName: string;
  checkedAt: string;
  plagiarismScore: number;
  wordCount?: number;
  aiProbability?: number;
}

export default function HistoryPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const { lang, t } = useLanguage();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ScanReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const reportRef = useRef<HTMLElement | null>(null);
  const { llmBusy, loadLlmOpinion } = useAiOpinion(setSelectedReport);

  const handleRetryOpinion = useCallback(() => {
    if (!selectedReport) return;
    const text = selectedReport.sourceText;
    if (text) {
      loadLlmOpinion(selectedReport, text, null).catch(() => {});
    }
  }, [selectedReport, loadLlmOpinion]);

  useEffect(() => {
    async function loadHistory() {
      try {
        let serverItems: HistoryItem[] = [];
        if (isLoggedIn) {
          try {
            const token = localStorage.getItem("nezbig_auth_token");
            const headers: Record<string, string> = {};
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch("/api/history", { headers, credentials: "include" });
            const data = await res.json();
            if (Array.isArray(data)) serverItems = data;
          } catch {
            // ignore server error
          }
        }
        
        let localItems: HistoryItem[] = [];
        try {
          localItems = JSON.parse(localStorage.getItem("nezbig_local_history") || "[]");
        } catch {}

        // Merge unique by ID, maintaining newest first
        const seen = new Set<string>();
        const merged: HistoryItem[] = [];
        for (const item of [...serverItems, ...localItems]) {
          if (item?.id && !seen.has(item.id)) {
            seen.add(item.id);
            merged.push(item);
          }
        }
        setItems(merged);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
    void loadHistory();

    const handleHistoryUpdated = () => {
      void loadHistory();
    };
    window.addEventListener("nezbig_history_updated", handleHistoryUpdated);
    window.addEventListener("storage", handleHistoryUpdated);
    return () => {
      window.removeEventListener("nezbig_history_updated", handleHistoryUpdated);
      window.removeEventListener("storage", handleHistoryUpdated);
    };
  }, [isLoggedIn]);

  const handleSelectReport = useCallback(async (reportId: string) => {
    setLoadingReport(true);
    setReportError(null);
    try {
      // 1. Try server fetch
      const token = localStorage.getItem("nezbig_auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/history/${reportId}`, { headers, credentials: "include" });
      if (res.ok) {
        const report = await res.json();
        setSelectedReport(report);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      
      // 2. Fallback to localStorage
      const localItems = JSON.parse(localStorage.getItem("nezbig_local_history") || "[]");
      const found = localItems.find((i: any) => i.id === reportId);
      if (found?.fullReport) {
        setSelectedReport(found.fullReport);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      throw new Error("Report not found");
    } catch {
      setReportError(lang === "uk" ? "Не вдалося завантажити детальний звіт." : "Failed to load scan report.");
    } finally {
      setLoadingReport(false);
    }
  }, [lang]);

  useEffect(() => {
    if (id) {
      void handleSelectReport(id);
    } else {
      setSelectedReport(null);
    }
  }, [id, handleSelectReport]);

  if (!isLoggedIn && items.length === 0) {
    return (
      <div className="max-w-container-max mx-auto px-gutter py-12 flex flex-col items-center gap-8 relative z-10 fade-in">
        <span className="material-symbols-outlined text-7xl text-on-surface-variant/40">lock</span>
        <h1 className="font-display-lg text-display-lg font-bold text-white text-center">
          {lang === "uk" ? "Історія перевірок" : "Scan History"}
        </h1>
        <p className="text-body-lg text-on-surface-variant text-center max-w-md">
          {lang === "uk"
            ? "Увійдіть в акаунт, щоб бачити історію ваших перевірок. Усі звіти зберігаються автоматично."
            : "Sign in to view your scan history across devices. Reports are saved automatically."}
        </p>
        <button
          onClick={() => setShowAuth(true)}
          className="px-8 py-3 bg-gradient-to-br from-emerald-glow to-primary-container text-on-primary rounded-xl font-medium shadow-[0_8px_32px_rgba(42,187,167,0.3)] hover:-translate-y-1 transition-all cursor-pointer"
        >
          {lang === "uk" ? "Увійти в акаунт" : "Sign In to Account"}
        </button>
        <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-container-max mx-auto px-gutter py-12 flex flex-col items-center gap-6 relative z-10 fade-in">
        <h1 className="font-display-lg text-display-lg font-bold text-white">
          {lang === "uk" ? "Історія перевірок" : "Scan History"}
        </h1>
        <div className="text-on-surface-variant">{lang === "uk" ? "Завантаження..." : "Loading history..."}</div>
      </div>
    );
  }

  if (selectedReport) {
    return (
      <div className="max-w-container-max mx-auto px-gutter py-8 relative z-10 fade-in flex flex-col gap-6">
        <button
          onClick={() => {
            setSelectedReport(null);
            navigate("/history", { replace: true });
          }}
          className="self-start flex items-center gap-2 text-emerald-glow hover:text-emerald-glow/80 font-medium transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-emerald-glow/10"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span>{lang === "uk" ? "Назад до списку перевірок" : "Back to History"}</span>
        </button>
        <Suspense fallback={<div className="text-center py-12 text-on-surface-variant">{lang === "uk" ? "Завантаження звіту..." : "Loading report..."}</div>}>
          <ReportView
            report={selectedReport}
            llmBusy={llmBusy}
            reportRef={reportRef}
            onRetryOpinion={selectedReport.sourceText ? handleRetryOpinion : undefined}
          />
        </Suspense>
      </div>
    );
  }

  async function handleDeleteItem(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const updated = items.filter((item) => item.id !== id);
    setItems(updated);
    try {
      localStorage.setItem("nezbig_local_history", JSON.stringify(updated));
    } catch {
      // ignore
    }

    if (isLoggedIn) {
      try {
        const token = localStorage.getItem("nezbig_auth_token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        await fetch(`/api/history/${id}`, { method: "DELETE", headers, credentials: "include" });
      } catch {
        // ignore
      }
    }
  }

  async function handleClearAll() {
    const confirmMsg = isLoggedIn
      ? (lang === "uk" ? "Ви дійсно бажаєте очистити всю історію перевірок у вашому акаунті та браузері?" : "Are you sure you want to clear your entire scan history from your account and browser?")
      : (lang === "uk" ? "Ви дійсно бажаєте очистити всю локальну історію перевірок?" : "Are you sure you want to clear your local scan history?");

    if (window.confirm(confirmMsg)) {
      setItems([]);
      try {
        localStorage.removeItem("nezbig_local_history");
      } catch {
        // ignore
      }

      if (isLoggedIn) {
        try {
          const token = localStorage.getItem("nezbig_auth_token");
          const headers: Record<string, string> = {};
          if (token) headers["Authorization"] = `Bearer ${token}`;
          await fetch("/api/history", { method: "DELETE", headers, credentials: "include" });
        } catch {
          // ignore
        }
      }
    }
  }

  return (
    <div className="max-w-container-max mx-auto px-gutter py-8 md:py-12 flex flex-col gap-6 relative z-10 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-white">
            {lang === "uk" ? "Історія перевірок" : "Scan History"}
          </h1>
          <p className="text-label-sm text-on-surface-variant mt-1">
            {isLoggedIn
              ? (lang === "uk" ? "Синхронізовано з вашим акаунтом у хмарі" : "Synced with your account in the cloud")
              : (lang === "uk" ? "Зберігається локально у вашому браузері" : "Saved locally in your browser storage")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-label-sm text-on-surface-variant hidden sm:inline">
            {items.length} {lang === "uk" ? (items.length === 1 ? "перевірка" : items.length < 5 ? "перевірки" : "перевірок") : (items.length === 1 ? "scan" : "scans")}
          </span>
          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-label-sm text-on-surface-variant hover:text-error transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-error/30 cursor-pointer"
            >
              {lang === "uk" ? "Очистити все" : "Clear All"}
            </button>
          )}
        </div>
      </div>

      {isLoggedIn ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-glow/10 border border-emerald-glow/30 text-white">
          <span className="material-symbols-outlined text-emerald-glow text-2xl shrink-0">cloud_done</span>
          <div className="flex flex-col min-w-0">
            <p className="text-sm font-medium text-emerald-glow">
              {lang === "uk" ? "Хмарне збереження активне" : "Cloud Storage Active"}
            </p>
            <p className="text-xs text-on-surface-variant truncate">
              {lang === "uk"
                ? `Звіти надійно прив'язані до вашого акаунта (${user?.email}) та доступні з будь-якого пристрою.`
                : `Scans are linked to your account (${user?.email}) and accessible on any device.`}
            </p>
          </div>
        </div>
      ) : (
        items.length > 0 && (
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-surface-container-high/60 border border-white/10 text-white">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-amber-400 text-2xl shrink-0">cloud_off</span>
              <div className="flex flex-col">
                <p className="text-sm font-medium text-white">
                  {lang === "uk" ? "Локальне збереження" : "Local Browser Storage"}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {lang === "uk"
                    ? "Увійдіть в акаунт Google або створіть профіль Незбігу, щоб скани не губилися при очищенні браузера."
                    : "Sign in with Google or create an account to back up scans to cloud."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAuth(true)}
              className="px-4 py-2 bg-emerald-glow/15 hover:bg-emerald-glow/25 text-emerald-glow border border-emerald-glow/30 rounded-xl text-xs font-medium cursor-pointer transition-all shrink-0"
            >
              {lang === "uk" ? "Увійти в акаунт" : "Sign In"}
            </button>
          </div>
        )
      )}

      {reportError && (
        <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl">error</span>
            <span>{reportError}</span>
          </div>
          <button
            type="button"
            onClick={() => setReportError(null)}
            className="text-error/70 hover:text-error cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      {loadingReport && (
        <div className="text-emerald-glow text-center py-4 flex items-center justify-center gap-2">
          <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
          <span>{lang === "uk" ? "Завантаження детального звіту..." : "Loading detailed report..."}</span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 border flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/40">description</span>
          <p className="text-body-lg text-on-surface-variant text-center">
            {lang === "uk" ? (
              <>Ви ще не проводили перевірок. Перейдіть на <Link to="/" className="text-emerald-glow hover:underline">головну</Link> і запустіть першу!</>
            ) : (
              <>No scans yet. Go to <Link to="/" className="text-emerald-glow hover:underline">home</Link> to run your first check!</>
            )}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const date = new Date(item.checkedAt);
            const scoreColor = item.plagiarismScore > 50 ? "text-error" : item.plagiarismScore > 20 ? "text-yellow-400" : "text-emerald-glow";
            
            return (
              <div
                key={item.id}
                onClick={() => handleSelectReport(item.id)}
                className="glass-panel rounded-xl p-5 border hover:border-emerald-glow/40 transition-all duration-300 cursor-pointer group text-left w-full flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="material-symbols-outlined text-emerald-glow/60 group-hover:text-emerald-glow transition-colors shrink-0">description</span>
                  <div className="min-w-0">
                    <p className="text-body-md text-white font-medium truncate">{item.fileName}</p>
                    <p className="text-label-sm text-on-surface-variant mt-1">
                      {date.toLocaleDateString(lang === "uk" ? "uk-UA" : "en-US", { day: "2-digit", month: "short", year: "numeric" })}
                      {" · "}
                      {date.toLocaleTimeString(lang === "uk" ? "uk-UA" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                      {item.wordCount ? ` · ${item.wordCount} ${t("wordsCount")}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                  <div className="text-right">
                    <p className="text-label-sm text-on-surface-variant">{t("plagiarism")}</p>
                    <p className={`text-body-lg font-bold ${scoreColor}`}>{item.plagiarismScore}%</p>
                  </div>
                  {item.aiProbability !== undefined && (
                    <div className="text-right hidden sm:block">
                      <p className="text-label-sm text-on-surface-variant">AI</p>
                      <p className="text-body-lg font-bold text-white">{item.aiProbability}%</p>
                    </div>
                  )}
                  <button
                    onClick={(e) => handleDeleteItem(e, item.id)}
                    className="p-1.5 text-on-surface-variant/40 hover:text-error hover:bg-error/10 rounded-lg transition-all cursor-pointer"
                    title={lang === "uk" ? "Видалити з історії" : "Delete from history"}
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                  <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-emerald-glow transition-colors">chevron_right</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
