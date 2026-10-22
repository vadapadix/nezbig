import { Router } from "express";
import * as diff from "diff";
import { HumanizeRequestSchema } from "../../../../shared/validation/schemas.js";
import { humanizeText } from "../../../application/humanization/humanizer.js";
import { mergeRevisedTextIntoHtml } from "../../../infrastructure/documents/formattedDocument.js";
import { mergeRevisedTextIntoDocx } from "../../../infrastructure/documents/formattedDocx.js";
import { decodeUploadFileName, extractTextFromUpload } from "../../../infrastructure/documents/textExtraction.js";
import { fileLimiter, scanLimiter, upload } from "../middleware/requestLimits.js";
export const humanizationRouter = Router();
humanizationRouter.post("/api/humanize", scanLimiter, async (request, response) => {
  try {
    const body = HumanizeRequestSchema.parse(request.body);
    const result = humanizeText(body.text, body.mode);
    response.json({
      ...result,
      revisedHtml: body.html?.trim() ? mergeRevisedTextIntoHtml(body.html, result.revisedText) : undefined
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося олюднити текст." });
  }
});

humanizationRouter.post("/api/humanize-file", fileLimiter, upload.single("file"), async (request, response) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: "Додайте файл для олюднення." });
      return;
    }

    const mode = request.body?.mode === "natural" || request.body?.mode === "concise" ? request.body.mode : "academic";
    const extracted = await extractTextFromUpload(request.file);
    const result = humanizeText(extracted.text, mode);
    response.json({
      ...result,
      revisedHtml: extracted.html ? mergeRevisedTextIntoHtml(extracted.html, result.revisedText) : undefined,
      notes: [
        `Файл прочитано напряму: ${extracted.fileName}.`,
        extracted.html ? "Абзаци, списки, таблиці та інлайн-форматування Word збережено у відредагованій версії." : "Для цього формату доступне лише текстове представлення.",
        ...result.notes
      ]
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося олюднити файл." });
  }
});

humanizationRouter.post("/api/diff", scanLimiter, async (request, response) => {
  try {
    const { original, modified } = request.body;
    if (typeof original !== "string" || typeof modified !== "string") {
      response.status(400).json({ error: "Очікуються рядки original та modified." });
      return;
    }
    
    // Захист від надто великих текстів, що можуть повісити diff (до ~50k символів)
    if (original.length > 50000 || modified.length > 50000) {
      response.status(400).json({ error: "Текст занадто великий для швидкого порівняння (ліміт 50 000 символів)." });
      return;
    }

    const diffResult = diff.diffWordsWithSpace(original, modified);
    response.json(diffResult);
  } catch {
    response.status(500).json({ error: "Помилка при порівнянні текстів." });
  }
});

humanizationRouter.post("/api/export-docx", fileLimiter, upload.single("file"), async (request, response) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: "Додайте вихідний DOCX-файл." });
      return;
    }

    const fileName = decodeUploadFileName(request.file.originalname);
    if (!/\.docx$/i.test(fileName)) {
      response.status(400).json({ error: "Точне збереження форматування доступне для DOCX-файлів." });
      return;
    }

    const revisedText = typeof request.body.revisedText === "string" ? request.body.revisedText : "";
    if (!revisedText.trim()) {
      response.status(400).json({ error: "Відредагований текст порожній." });
      return;
    }

    const output = await mergeRevisedTextIntoDocx(request.file.buffer, revisedText);
    const baseName = fileName.replace(/\.docx$/i, "").trim() || "nezbig-document";
    const outputName = `${baseName}-edited.docx`;
    response.type("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    response.setHeader("Content-Disposition", `attachment; filename="nezbig-edited.docx"; filename*=UTF-8''${encodeURIComponent(outputName)}`);
    response.send(output);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося зібрати відредагований DOCX." });
  }
});

