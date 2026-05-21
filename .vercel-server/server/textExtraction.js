import mammoth from "mammoth";
import { countWords, normalizeWhitespace } from "./chunking.js";
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".csv", ".json", ".rtf"]);
function extensionOf(fileName) {
    const dot = fileName.lastIndexOf(".");
    return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}
export async function extractTextFromUpload(file) {
    const ext = extensionOf(file.originalname);
    let text = "";
    if (TEXT_EXTENSIONS.has(ext) || file.mimetype.startsWith("text/")) {
        text = file.buffer.toString("utf8");
    }
    else if (ext === ".docx") {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        text = result.value;
    }
    else if (ext === ".pdf") {
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: file.buffer });
        try {
            const result = await parser.getText();
            text = result.text;
        }
        finally {
            await parser.destroy();
        }
    }
    else {
        throw new Error("Підтримуються TXT, MD, CSV, JSON, DOCX та PDF файли.");
    }
    const cleaned = normalizeWhitespace(text);
    if (!cleaned) {
        throw new Error("Файл не містить тексту, який можна перевірити.");
    }
    return {
        text: cleaned,
        fileName: file.originalname,
        wordCount: countWords(cleaned)
    };
}
