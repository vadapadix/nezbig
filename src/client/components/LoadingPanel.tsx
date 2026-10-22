import type { LoadingPanelProps } from "../types/LoadingPanel.types";
export type { LoadingPanelProps } from "../types/LoadingPanel.types";
import { BrandLogo } from "./BrandLogo";
import { useLanguage } from "../context/LanguageContext";

export function LoadingPanel({ busy, llmBusy, estimatedSeconds, progress, onCancel }: LoadingPanelProps) {
  const { lang } = useLanguage();

  return (
    <section className="loading-panel" aria-live="polite" aria-label={lang === "uk" ? "Стан перевірки" : "Scanning state"}>
      <div className="flex justify-center mb-6">
        <BrandLogo spinning={true} className="w-20 h-20" />
      </div>
      <div>
        <h2>{busy ? (lang === "uk" ? "Готуємо звіт" : "Generating Report") : lang === "uk" ? "AI-думка аналізує текст" : "AI model analyzing text"}</h2>
        <p className="loading-estimate">
          {busy
            ? lang === "uk"
              ? `Орієнтовний час: ${estimatedSeconds}`
              : `Estimated time: ${estimatedSeconds}`
            : lang === "uk"
              ? "AI-думка може відповідати довше за локальний звіт."
              : "AI opinion may take a moment to formulate."}
        </p>
        <ol>
          <li className={busy ? "step-active" : "step-done"}>{lang === "uk" ? "Нарізаємо текст на фрагменти" : "Tokenizing and segmenting document"}</li>
          <li className={busy ? "step-active" : llmBusy ? "step-done" : ""}>{lang === "uk" ? "Шукаємо збіги у відкритих джерелах" : "Searching scholarly and web indexes"}</li>
          <li className={llmBusy ? "step-active" : ""}>{lang === "uk" ? "Додаємо окрему AI-думку" : "Synthesizing AI stylometry analysis"}</li>
        </ol>
        {progress && progress.total > 0 ? (
          <div className="progress-track" style={{ marginTop: "1.5rem", background: "#f1f3f5", borderRadius: "8px", overflow: "hidden" }}>
            <div
              className="progress-fill"
              style={{ width: `${Math.round((progress.checked / progress.total) * 100)}%`, background: "#2EC4B6", height: "8px", transition: "width 0.3s ease" }}
            />
            <p className="progress-label" style={{ fontSize: "13px", color: "#868e96", marginTop: "8px" }}>
              {lang === "uk" ? `Перевірено ${progress.checked} з ${progress.total} фрагментів` : `Scanned ${progress.checked} of ${progress.total} chunks`}
            </p>
          </div>
        ) : null}
        {onCancel && busy ? (
          <button type="button" className="secondary-button" onClick={onCancel} style={{ marginTop: "1rem" }}>
            {lang === "uk" ? "Скасувати" : "Cancel"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
