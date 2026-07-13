import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import mammoth from "mammoth";
import { countWords } from "./chunking.js";
import type { AiSignal, FileEvidence, UploadedText } from "../shared/types.js";

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".csv", ".json", ".rtf"]);
const require = createRequire(import.meta.url);
const pdfWorkerUrl = pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).href;

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

function extractionMethodFor(fileName: string, mimeType: string): FileEvidence["extractionMethod"] {
  const ext = extensionOf(fileName);
  if (ext === ".docx") return "docx";
  if (ext === ".pdf") return "pdf";
  if (TEXT_EXTENSIONS.has(ext) || mimeType.startsWith("text/")) return "plain-text";
  throw new Error("Підтримуються TXT, MD, CSV, JSON, DOCX та PDF файли.");
}

function fileSignals(fileName: string, file: Express.Multer.File, wordCount: number, charCount: number, extractionMethod: FileEvidence["extractionMethod"]): AiSignal[] {
  const sizeKb = Math.max(1, Math.round(file.size / 1024));
  const density = Math.round((wordCount / sizeKb) * 10) / 10;
  const signals: AiSignal[] = [
    {
      label: "Файлова перевірка",
      score: 100,
      category: "safeguard",
      detail: `Документ перевірено як файл: ${fileName}, ${sizeKb} KB, метод читання ${extractionMethod}.`,
      evidence: [`${wordCount} слів`, `${charCount} символів`, `${density} слів/KB`]
    }
  ];

  if (extractionMethod === "docx" || extractionMethod === "pdf") {
    signals.push({
      label: "Формат документа",
      score: extractionMethod === "docx" ? 18 : 12,
      category: "structure",
      detail: "Формат файлу сам по собі не доводить використання ШІ, але зберігається як контекст для звіту.",
      evidence: [file.mimetype || "невідомий MIME-тип"]
    });
  }

  return signals;
}

export function decodeUploadFileName(fileName: string): string {
  const hasMojibake = /[ÐÑÒÃÂ][\u0080-\u00ff]?|�/.test(fileName);
  if (!hasMojibake) return fileName;

  try {
    return Buffer.from(fileName, "latin1").toString("utf8");
  } catch {
    return fileName;
  }
}

export function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function loadPdfParser() {
  const globals = globalThis as Record<string, unknown>;

  if (!globals.DOMMatrix || !globals.DOMPoint || !globals.ImageData || !globals.Path2D) {
    const canvas = await import("@napi-rs/canvas");
    globals.DOMMatrix ??= canvas.DOMMatrix;
    globals.DOMPoint ??= canvas.DOMPoint;
    globals.ImageData ??= canvas.ImageData;
    globals.Path2D ??= canvas.Path2D;
  }

  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const pdfParse = await import("pdf-parse");
  pdfParse.PDFParse.setWorker(pdfWorkerUrl);
  return pdfParse;
}

export async function extractTextFromUpload(file: Express.Multer.File): Promise<UploadedText> {
  const fileName = decodeUploadFileName(file.originalname);
  const ext = extensionOf(fileName);
  const extractionMethod = extractionMethodFor(fileName, file.mimetype);
  let text = "";
  let html: string | undefined;

  if (extractionMethod === "plain-text") {
    text = file.buffer.toString("utf8");
  } else if (extractionMethod === "docx") {
    const [textResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ buffer: file.buffer }),
      mammoth.convertToHtml({ buffer: file.buffer })
    ]);
    text = textResult.value;
    html = htmlResult.value || undefined;
  } else if (extractionMethod === "pdf") {
    const { PDFParse } = await loadPdfParser();
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      text = result.text;
    } finally {
      await parser.destroy();
    }
  }

  const cleaned = normalizeExtractedText(text);
  if (!cleaned) {
    throw new Error("Файл не містить тексту, який можна перевірити.");
  }

  const wordCount = countWords(cleaned);

  return {
    text: cleaned,
    html,
    fileName,
    wordCount,
    fileEvidence: {
      fileName,
      mimeType: file.mimetype || "application/octet-stream",
      sizeBytes: file.size,
      extension: ext,
      extractionMethod,
      extractedWordCount: wordCount,
      extractedCharCount: cleaned.length,
      signals: fileSignals(fileName, file, wordCount, cleaned.length, extractionMethod)
    }
  };
}
