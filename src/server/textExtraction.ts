import mammoth from "mammoth";
import { countWords, normalizeWhitespace } from "./chunking.js";
import type { UploadedText } from "../shared/types.js";

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".csv", ".json", ".rtf"]);

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
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

async function loadPdfParser() {
  const globals = globalThis as Record<string, unknown>;

  if (!globals.DOMMatrix || !globals.DOMPoint || !globals.ImageData || !globals.Path2D) {
    const canvas = await import("@napi-rs/canvas");
    globals.DOMMatrix ??= canvas.DOMMatrix;
    globals.DOMPoint ??= canvas.DOMPoint;
    globals.ImageData ??= canvas.ImageData;
    globals.Path2D ??= canvas.Path2D;
  }

  return import("pdf-parse");
}

export async function extractTextFromUpload(file: Express.Multer.File): Promise<UploadedText> {
  const fileName = decodeUploadFileName(file.originalname);
  const ext = extensionOf(fileName);
  let text = "";

  if (TEXT_EXTENSIONS.has(ext) || file.mimetype.startsWith("text/")) {
    text = file.buffer.toString("utf8");
  } else if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    text = result.value;
  } else if (ext === ".pdf") {
    const { PDFParse } = await loadPdfParser();
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      text = result.text;
    } finally {
      await parser.destroy();
    }
  } else {
    throw new Error("Підтримуються TXT, MD, CSV, JSON, DOCX та PDF файли.");
  }

  const cleaned = normalizeWhitespace(text);
  if (!cleaned) {
    throw new Error("Файл не містить тексту, який можна перевірити.");
  }

  return {
    text: cleaned,
    fileName,
    wordCount: countWords(cleaned)
  };
}
