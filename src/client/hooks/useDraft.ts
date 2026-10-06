import { useEffect, useRef, useState, useCallback } from "react";

const DRAFT_KEY = "nezbig:draft";

interface Draft {
  text: string;
  html: string;
  fileName: string;
  savedAt: string;
}

export function useDraft(text: string, html: string, fileName: string, onRestore: (d: Draft) => void) {
  const [draftSaved, setDraftSaved] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!text.trim()) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ text, html, fileName, savedAt: new Date().toISOString() }));
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    }, 3000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [text, html, fileName]);

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as Draft;
      if (Date.now() - new Date(draft.savedAt).getTime() > 48 * 3600000) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      const lang = (localStorage.getItem("nezbig_lang") as "uk" | "en") || "en";
      const dateStr = new Date(draft.savedAt).toLocaleString(lang === "uk" ? "uk-UA" : "en-US");
      const confirmPrompt = lang === "uk"
        ? `Відновити чернетку «${draft.fileName}» від ${dateStr}?`
        : `Restore draft "${draft.fileName}" from ${dateStr}?`;
      if (draft.text.length > 120 && window.confirm(confirmPrompt)) {
        onRestore(draft);
      }
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  const clearDraft = useCallback(() => localStorage.removeItem(DRAFT_KEY), []);

  return { clearDraft, draftSaved };
}
