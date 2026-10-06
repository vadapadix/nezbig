import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

export interface DiffPart {
  count?: number;
  value: string;
  added?: boolean;
  removed?: boolean;
}

export function DiffPanel() {
  const { lang } = useLanguage();
  const [original, setOriginal] = useState("");
  const [modified, setModified] = useState("");
  const [diffResult, setDiffResult] = useState<DiffPart[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!original.trim() || !modified.trim()) {
      setError(lang === "uk" ? "Вставте обидва тексти для порівняння." : "Paste both texts to compare.");
      return;
    }
    
    setBusy(true);
    setError(null);
    setDiffResult(null);
    
    try {
      const res = await fetch("/api/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ original, modified })
      });
      
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || (lang === "uk" ? "Помилка при порівнянні" : "Diff comparison failed"));
      
      setDiffResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleClear = () => {
    setOriginal("");
    setModified("");
    setDiffResult(null);
    setError(null);
  };

  return (
    <section className="diff-panel workspace">
      <div className="diff-inputs">
        <div className="diff-input-group">
          <label htmlFor="diff-original">{lang === "uk" ? "Оригінальний текст" : "Original Text"}</label>
          <textarea
            id="diff-original"
            className="diff-textarea"
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
            placeholder={lang === "uk" ? "Вставте початковий варіант тексту сюди..." : "Paste original text version here..."}
          />
        </div>
        <div className="diff-input-group">
          <label htmlFor="diff-modified">{lang === "uk" ? "Редагований варіант" : "Revised Text"}</label>
          <textarea
            id="diff-modified"
            className="diff-textarea"
            value={modified}
            onChange={(e) => setModified(e.target.value)}
            placeholder={lang === "uk" ? "Вставте змінений текст сюди..." : "Paste modified text version here..."}
          />
        </div>
      </div>
      
      <div className="diff-actions">
        <button 
          className="primary-button cursor-pointer disabled:cursor-not-allowed" 
          onClick={handleCompare} 
          disabled={busy || (!original.trim() || !modified.trim())}
        >
          {busy ? (lang === "uk" ? "Аналіз..." : "Comparing...") : (lang === "uk" ? "Порівняти" : "Compare")}
        </button>
        <button 
          className="secondary-button cursor-pointer disabled:cursor-not-allowed" 
          onClick={handleClear} 
          disabled={busy || (!original && !modified && !diffResult)}
        >
          {lang === "uk" ? "Очистити" : "Clear"}
        </button>
      </div>

      {error && <div className="panel-banner panel-banner-error">{error}</div>}

      {diffResult && (
        <div className="diff-result">
          <h3 className="diff-result-title">{lang === "uk" ? "Результат порівняння (Inline Diff)" : "Comparison Result (Inline Diff)"}</h3>
          <div className="diff-content">
            {diffResult.map((part, index) => {
              if (part.added) {
                return <ins key={index}>{part.value}</ins>;
              }
              if (part.removed) {
                return <del key={index}>{part.value}</del>;
              }
              return <span key={index}>{part.value}</span>;
            })}
          </div>
        </div>
      )}
    </section>
  );
}
