import { useState, useRef, useCallback, type ClipboardEvent } from "react";
import { insertRichHtmlAtSelection } from "../richPaste";
import { htmlFromPlainText, plainTextFromRichHtml, sanitizeRichHtml } from "../richText";
import type { UploadedText } from "../../shared/types";

function getLang(): "uk" | "en" {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem("nezbig_lang");
    if (saved === "uk" || saved === "en") return saved;
  }
  return "en";
}

export function useDocumentEditor(onMessage?: (msg: string) => void) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState(() => (getLang() === "uk" ? "Вставлений текст" : "Pasted Text"));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceHtml, setSourceHtml] = useState("");
  const [formattedPreviewBusy, setFormattedPreviewBusy] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const setEditorContent = useCallback((html: string, plainText: string) => {
    setSourceHtml(html);
    setText(plainText);
    window.requestAnimationFrame(() => {
      if (editorRef.current) editorRef.current.innerHTML = html;
    });
  }, []);

  const syncEditorFromDom = useCallback((clearFile = true) => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = sanitizeRichHtml(editor.innerHTML);
    setText(plainTextFromRichHtml(html));
    setSourceHtml(html);
    if (clearFile) {
      setFileName(getLang() === "uk" ? "Вставлений текст" : "Pasted Text");
      setSelectedFile(null);
    }
  }, []);

  const handleRichPaste = useCallback((event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const lang = getLang();
    const clipboardHtml = event.clipboardData.getData("text/html");
    const clipboardText = event.clipboardData.getData("text/plain");
    const hasRichHtml = clipboardHtml.trim().length > 0;
    const html = hasRichHtml ? sanitizeRichHtml(clipboardHtml) : htmlFromPlainText(clipboardText);
    insertRichHtmlAtSelection(event.currentTarget, html);
    syncEditorFromDom(true);
    if (hasRichHtml) {
      onMessage?.(lang === "uk" ? "Текст вставлено разом із форматуванням Word." : "Text inserted with rich formatting.");
    } else {
      onMessage?.(lang === "uk" ? "Текст вставлено без форматування." : "Plain text inserted.");
    }
  }, [syncEditorFromDom, onMessage]);

  const loadFormattedPreview = useCallback(async (file: File) => {
    setFormattedPreviewBusy(true);
    const lang = getLang();
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/extract", { method: "POST", body: formData });
      const payload = (await response.json()) as UploadedText | { error: string };
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : (lang === "uk" ? "Не вдалося прочитати форматування." : "Failed to parse document."));
      }

      const html = payload.html ? sanitizeRichHtml(payload.html) : htmlFromPlainText(payload.text);
      setEditorContent(html, payload.text);
      if (payload.html) {
        onMessage?.(
          lang === "uk"
            ? `Файл прикріплено: ${payload.fileName}. Форматування Word показано в preview; перевірка піде файлом.`
            : `File attached: ${payload.fileName}. Word preview displayed; direct file will be scanned.`
        );
      } else {
        onMessage?.(
          lang === "uk"
            ? `Файл прикріплено: ${payload.fileName}. Форматованого preview немає, показано текст.`
            : `File attached: ${payload.fileName}. Text extracted for scan.`
        );
      }
    } catch (error) {
      setEditorContent("", "");
      onMessage?.(
        error instanceof Error
          ? error.message
          : (lang === "uk" ? `Файл прикріплено: ${file.name}. Форматоване preview недоступне.` : `File attached: ${file.name}. Preview unavailable.`)
      );
    } finally {
      setFormattedPreviewBusy(false);
    }
  }, [setEditorContent, onMessage]);

  const handleFile = useCallback(async (file: File | null) => {
    if (!file) return;
    const lang = getLang();
    setSelectedFile(file);
    setFileName(file.name);
    setEditorContent("", "");
    setFormattedPreviewBusy(true);
    onMessage?.(
      lang === "uk"
        ? `Файл прикріплено: ${file.name}. Читаю форматування для preview; перевірка піде файлом.`
        : `File attached: ${file.name}. Extracting preview; file will be scanned.`
    );
    void loadFormattedPreview(file);
  }, [setEditorContent, loadFormattedPreview, onMessage]);

  const clearFile = useCallback(() => {
    const lang = getLang();
    setSelectedFile(null);
    setFileName(lang === "uk" ? "Вставлений текст" : "Pasted Text");
    setEditorContent("", "");
    onMessage?.(lang === "uk" ? "Файл прибрано. Можна вставити текст вручну." : "File removed. You can type or paste text manually.");
  }, [setEditorContent, onMessage]);

  return {
    text, fileName, selectedFile, sourceHtml, formattedPreviewBusy,
    editorRef, setEditorContent, syncEditorFromDom, handleRichPaste,
    handleFile, clearFile, setText, setFileName, setSelectedFile, setSourceHtml
  };
}
