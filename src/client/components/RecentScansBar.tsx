import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import type { ScanReport } from "../../shared/types";

export interface StoredScanItem {
  id: string;
  fileName: string;
  checkedAt: string;
  plagiarismScore: number;
  wordCount?: number;
  aiProbability?: number;
  fullReport?: ScanReport;
}

interface RecentScansBarProps {
  currentReportId?: string | null;
  onSelectReport: (report: ScanReport) => void;
}

export function RecentScansBar({ currentReportId, onSelectReport }: RecentScansBarProps) {
  const { lang } = useLanguage();
  const [items, setItems] = useState<StoredScanItem[]>([]);

  const loadItems = useCallback(() => {
    try {
      const raw = localStorage.getItem("nezbig_local_history");
      if (raw) {
        const parsed = JSON.parse(raw) as StoredScanItem[];
        setItems(Array.isArray(parsed) ? parsed : []);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    loadItems();
    // Listen to storage events from other tabs or scans
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "nezbig_local_history") loadItems();
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [loadItems]);

  const handleClearAll = () => {
    if (window.confirm(lang === "uk" ? "Очистити історію всіх попередніх сканів?" : "Clear all previous scans history?")) {
      localStorage.removeItem("nezbig_local_history");
      setItems([]);
    }
  };

  const handleRemoveOne = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const filtered = items.filter((item) => item.id !== id);
      localStorage.setItem("nezbig_local_history", JSON.stringify(filtered));
      setItems(filtered);
    } catch {
      // ignore
    }
  };

  const handleItemClick = async (item: StoredScanItem) => {
    if (item.fullReport) {
      onSelectReport(item.fullReport);
      return;
    }
    // Try fetching if fullReport isn't cached locally
    try {
      const token = localStorage.getItem("nezbig_auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/history/${item.id}`, { headers, credentials: "include" });
      if (res.ok) {
        const report = (await res.json()) as ScanReport;
        onSelectReport(report);
      }
    } catch {
      // ignore
    }
  };

  if (items.length === 0) return null;

  return (
    <section className="w-full bg-surface-container-high/70 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-lg transition-all animate-fadeIn" aria-label="Recent scans">
      <div className="flex items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-2 text-white">
          <span className="material-symbols-outlined text-emerald-glow text-xl">history</span>
          <h3 className="font-headline-sm text-sm font-semibold tracking-wide uppercase text-white/90">
            {lang === "uk" ? "Попередні скани" : "Recent Scans"}
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-mono text-on-surface-variant">
            {items.length}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link
            to="/history"
            className="text-emerald-glow hover:underline flex items-center gap-1 font-medium transition-colors"
          >
            <span>{lang === "uk" ? "Вся історія" : "View All"}</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
          <span className="text-white/20">|</span>
          <button
            type="button"
            onClick={handleClearAll}
            className="text-on-surface-variant hover:text-rose-400 transition-colors cursor-pointer"
            title={lang === "uk" ? "Очистити історію" : "Clear all"}
          >
            {lang === "uk" ? "Очистити" : "Clear"}
          </button>
        </div>
      </div>

      {/* Horizontal scrollable cards */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1 custom-scrollbar scroll-smooth">
        {items.map((item) => {
          const isActive = currentReportId === item.id;
          const plagColor =
            item.plagiarismScore > 40
              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
              : item.plagiarismScore > 15
                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";

          const aiColor =
            item.aiProbability !== undefined && item.aiProbability > 50
              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
              : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";

          return (
            <button
              type="button"
              key={item.id}
              onClick={() => void handleItemClick(item)}
              className={`shrink-0 flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all group cursor-pointer ${
                isActive
                  ? "bg-emerald-glow/15 border-emerald-glow text-white shadow-md ring-1 ring-emerald-glow/40"
                  : "bg-surface-container/80 hover:bg-surface-container border-white/10 hover:border-emerald-glow/40 text-white/90"
              }`}
            >
              <span className="material-symbols-outlined text-xl text-emerald-glow/80 shrink-0">
                description
              </span>

              <div className="flex flex-col min-w-0 max-w-[180px] sm:max-w-[220px]">
                <span className="text-xs font-medium text-white truncate group-hover:text-emerald-glow transition-colors">
                  {item.fileName}
                </span>
                <span className="text-[10px] text-on-surface-variant font-mono truncate">
                  {new Intl.DateTimeFormat(lang === "uk" ? "uk-UA" : "en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(item.checkedAt))}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 pl-1">
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold border ${plagColor}`}
                  title={lang === "uk" ? "Плагіат" : "Plagiarism"}
                >
                  {item.plagiarismScore}%
                </span>

                {item.aiProbability !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold border ${aiColor}`}
                    title={lang === "uk" ? "ШІ-ризик" : "AI Risk"}
                  >
                    {item.aiProbability}%
                  </span>
                )}
              </div>

              <span
                role="button"
                tabIndex={0}
                onClick={(e) => handleRemoveOne(e, item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleRemoveOne(e as unknown as React.MouseEvent, item.id);
                  }
                }}
                className="ml-1 text-white/30 hover:text-rose-400 p-0.5 rounded hover:bg-white/5 transition-colors"
                title={lang === "uk" ? "Видалити зі списку" : "Remove from list"}
                aria-label="Remove item"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
