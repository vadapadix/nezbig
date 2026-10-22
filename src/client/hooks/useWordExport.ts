import { apiFetch } from "../utils/apiClient";
import { useState, useCallback } from "react";
import { copyRichTextForWord } from "../wordClipboard";
import { downloadWordDocument, revisedDocxFileName } from "../wordDocument";
import { htmlFromPlainText, sanitizeRichHtml } from "../richText";
import type { HumanizeResult } from "../../shared/types/index";

export function useWordExport(onMessage: (msg: string) => void) {
  const [wordDownloadBusy, setWordDownloadBusy] = useState(false);

  const copyFormattedForWord = useCallback(
    async (html: string, plainText: string) => {
      try {
        const mode = await copyRichTextForWord(html, plainText);
        onMessage(mode === "rich" ? "Текст скопійовано разом із форматуванням для Word." : "Браузер дозволив скопіювати лише звичайний текст.");
      } catch {
        onMessage("Не вдалося скопіювати документ. Дозвольте сайту доступ до буфера обміну або завантажте файл для Word.");
      }
    },
    [onMessage]
  );

  const downloadFormattedForWord = useCallback(
    (html: string, sourceName: string) => {
      downloadWordDocument(sanitizeRichHtml(html), sourceName);
      onMessage("Форматований документ підготовлено для відкриття у Word.");
    },
    [onMessage]
  );

  const downloadOriginalFile = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      onMessage(`Оригінальний файл ${file.name} завантажено без перетворення, тому його форматування не змінено.`);
    },
    [onMessage]
  );

  const downloadHumanizedForWord = useCallback(
    async (humanized: HumanizeResult, selectedFile: File | null, fileName: string) => {
      if (!selectedFile || !/\.docx$/i.test(selectedFile.name)) {
        downloadFormattedForWord(humanized.revisedHtml ?? htmlFromPlainText(humanized.revisedText), fileName);
        return;
      }

      setWordDownloadBusy(true);
      onMessage("Збираю відредагований DOCX зі стилями оригінального файла…");
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("revisedText", humanized.revisedText);
        const response = await apiFetch("/api/export-docx", { method: "POST", body: formData });
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Не вдалося зібрати DOCX.");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = revisedDocxFileName(selectedFile.name);
        link.click();
        URL.revokeObjectURL(url);
        onMessage("DOCX готовий: форматування, таблиці, зображення та стилі оригіналу збережено.");
      } catch (error) {
        onMessage(error instanceof Error ? error.message : "Не вдалося завантажити відредагований DOCX.");
      } finally {
        setWordDownloadBusy(false);
      }
    },
    [downloadFormattedForWord, onMessage]
  );

  const copyHumanizedFormatted = useCallback(
    async (humanized: HumanizeResult) => {
      const html = sanitizeRichHtml(humanized.revisedHtml ?? htmlFromPlainText(humanized.revisedText));
      await copyFormattedForWord(html, humanized.revisedText);
    },
    [copyFormattedForWord]
  );

  return {
    wordDownloadBusy,
    copyFormattedForWord,
    downloadFormattedForWord,
    downloadOriginalFile,
    downloadHumanizedForWord,
    copyHumanizedFormatted
  };
}
