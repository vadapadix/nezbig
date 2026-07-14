import "dotenv/config";
import cors from "cors";
import express from "express";
import multer from "multer";
import { chunkText, countWords } from "./chunking.js";
import { prepareDocumentText } from "./documentPreprocess.js";
import { mergeRevisedTextIntoHtml } from "./formattedDocument.js";
import { mergeRevisedTextIntoDocx } from "./formattedDocx.js";
import { humanizeText } from "./humanizer.js";
import { analyzeWithLlmProviders } from "./llmOpinion.js";
import { emptySearchDiagnostics, mergeSearchDiagnostics, searchDiagnosticsNotes } from "./searchDiagnostics.js";
import { calculateConfirmedPlagiarismScore, scoreCandidate, detectAiSignals, summarizeReport } from "./scoring.js";
import { decodeUploadFileName, extractTextFromUpload } from "./textExtraction.js";
import { hydrateSearchCandidatesDetailed, searchWebCandidatesDetailed } from "./webSearch.js";
export const app = express();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
});
const defaultSettings = {
    maxChunks: 14,
    chunkWords: 120,
    overlapWords: 32,
    sensitivity: "balanced"
};
function sanitizeSettings(settings) {
    const sensitivity = settings?.sensitivity ?? defaultSettings.sensitivity;
    const maxBySensitivity = sensitivity === "deep" ? 48 : sensitivity === "quick" ? 8 : 14;
    return {
        maxChunks: Math.min(Math.max(Number(settings?.maxChunks ?? maxBySensitivity), 1), 2000),
        chunkWords: Math.min(Math.max(Number(settings?.chunkWords ?? defaultSettings.chunkWords), 70), 520),
        overlapWords: Math.min(Math.max(Number(settings?.overlapWords ?? defaultSettings.overlapWords), 0), 180),
        sensitivity
    };
}
function fullCoverageSettings(settings, wordCount) {
    const chunkWords = wordCount > 20000
        ? 520
        : wordCount > 10000
            ? 460
            : wordCount > 5000
                ? 380
                : wordCount > 2000
                    ? Math.max(settings.chunkWords, 240)
                    : settings.chunkWords;
    const overlapWords = Math.min(Math.floor(chunkWords * 0.18), Math.max(settings.overlapWords, wordCount > 5000 ? 56 : 32));
    const step = Math.max(60, chunkWords - overlapWords);
    const chunksNeeded = Math.max(1, Math.ceil(Math.max(1, wordCount - overlapWords) / step));
    return {
        ...settings,
        chunkWords,
        overlapWords,
        maxChunks: chunksNeeded
    };
}
function thresholdFor(settings) {
    if (settings.sensitivity === "quick")
        return 38;
    if (settings.sensitivity === "deep")
        return 24;
    return 32;
}
async function mapWithConcurrency(items, concurrency, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    async function runWorker() {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await worker(items[index]);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
    return results;
}
function uniqueMatches(matches) {
    const bestByUrl = new Map();
    for (const match of matches) {
        const key = `${match.url.replace(/#.*$/, "").replace(/\/$/, "")}:${match.chunkIndex}`;
        const current = bestByUrl.get(key);
        if (!current || match.score > current.score)
            bestByUrl.set(key, match);
    }
    return [...bestByUrl.values()];
}
async function runScan(request, fileEvidence) {
    const prepared = prepareDocumentText(request.text);
    const text = prepared.text;
    if (text.length < 120) {
        throw new Error("Додайте щонайменше 120 символів тексту для надійної перевірки.");
    }
    const wordCount = countWords(text);
    const settings = fullCoverageSettings(sanitizeSettings(request.settings), wordCount);
    const chunks = chunkText(text, settings.chunkWords, settings.overlapWords, settings.maxChunks);
    const longDocumentMode = wordCount > 2000 || chunks.length > 18;
    const veryLongDocumentMode = wordCount > 8000 || chunks.length > 45;
    const searchLimit = settings.sensitivity === "deep" ? (veryLongDocumentMode ? 5 : longDocumentMode ? 7 : 12) : veryLongDocumentMode ? 3 : longDocumentMode ? 4 : 8;
    const concurrency = veryLongDocumentMode ? 8 : settings.sensitivity === "deep" ? 4 : 5;
    const matchedByChunk = await mapWithConcurrency(chunks, concurrency, async (chunk) => {
        try {
            const search = await searchWebCandidatesDetailed(chunk.text, searchLimit, settings.sensitivity === "deep", {
                hydrateLimit: longDocumentMode ? 0 : undefined,
                includeAcademic: settings.sensitivity === "deep" && !veryLongDocumentMode,
                queryLimit: veryLongDocumentMode ? 1 : longDocumentMode ? 2 : undefined
            });
            return {
                matches: search.candidates.map((candidate) => ({ chunkText: chunk.text, match: scoreCandidate(chunk.text, candidate, chunk.index) })),
                diagnostics: search.diagnostics
            };
        }
        catch (error) {
            console.warn(error);
            const diagnostics = emptySearchDiagnostics();
            diagnostics.providers.push({ provider: "Пошуковий pipeline", attempted: 1, succeeded: 0, failed: 1, timedOut: 0, results: 0 });
            return { matches: [], diagnostics };
        }
    });
    const preliminaryMatches = matchedByChunk.flatMap((result) => result.matches);
    let searchDiagnostics = mergeSearchDiagnostics(...matchedByChunk.map((result) => result.diagnostics));
    const hydrationTargets = preliminaryMatches
        .filter(({ match }) => match.confidence === "snippet" && (match.score >= thresholdFor(settings) - 10 || match.longestRun >= 7))
        .sort((a, b) => b.match.score - a.match.score || b.match.longestRun - a.match.longestRun)
        .slice(0, veryLongDocumentMode ? 32 : longDocumentMode ? 48 : 80);
    const hydration = await hydrateSearchCandidatesDetailed(hydrationTargets.map(({ match }) => match), hydrationTargets.length);
    searchDiagnostics = mergeSearchDiagnostics(searchDiagnostics, hydration.diagnostics);
    const hydratedMatches = hydration.candidates.map((candidate, index) => scoreCandidate(hydrationTargets[index].chunkText, candidate, hydrationTargets[index].match.chunkIndex));
    const allMatches = [...preliminaryMatches.map(({ match }) => match), ...hydratedMatches];
    const matches = uniqueMatches(allMatches)
        .filter((match) => match.score >= thresholdFor(settings) || match.longestRun >= 10)
        .sort((a, b) => b.score - a.score || b.longestRun - a.longestRun)
        .slice(0, 24);
    const plagiarismScore = calculateConfirmedPlagiarismScore(matches);
    const localAi = detectAiSignals(text);
    const scanNotes = [...prepared.notes];
    scanNotes.push(...searchDiagnosticsNotes(searchDiagnostics));
    if (fileEvidence) {
        const sizeKb = Math.max(1, Math.round(fileEvidence.sizeBytes / 1024));
        scanNotes.push(`Файл перевірено напряму: ${fileEvidence.fileName}, ${sizeKb} KB, метод ${fileEvidence.extractionMethod}, витягнуто ${fileEvidence.extractedWordCount} слів.`);
    }
    if (longDocumentMode) {
        scanNotes.push(`Повне покриття: перевірено ${chunks.length} фрагментів, включно з кінцем документа.`);
        scanNotes.push("Для довгого тексту застосовано двофазний пошук: швидкий прохід по всіх фрагментах і точне дочитування найсильніших збігів.");
    }
    return {
        id: crypto.randomUUID(),
        fileName: request.fileName || "Вставлений текст",
        checkedAt: new Date().toISOString(),
        wordCount,
        chunksChecked: chunks.length,
        plagiarismScore,
        aiProbability: localAi.probability,
        aiVerdict: localAi.verdict,
        aiReliability: localAi.reliability,
        aiLanguage: localAi.language,
        aiExclusions: localAi.exclusions,
        aiSuspiciousSegments: localAi.suspiciousSegments,
        aiProvider: "local",
        aiModel: undefined,
        aiNote: "Базовий звіт згенеровано локально. AI-думка підвантажується окремо після звіту.",
        scanNotes,
        searchDiagnostics,
        skippedTitleWords: prepared.skippedTitleWords,
        fileEvidence,
        matches,
        aiSignals: fileEvidence ? [...fileEvidence.signals, ...localAi.signals] : localAi.signals,
        summary: summarizeReport(plagiarismScore, localAi.probability, matches, searchDiagnostics, localAi.verdict)
    };
}
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.get("/api/health", (_request, response) => {
    response.json({ ok: true, app: "nezbig" });
});
app.post("/api/extract", upload.single("file"), async (request, response) => {
    try {
        if (!request.file) {
            response.status(400).json({ error: "Додайте файл для обробки." });
            return;
        }
        response.json(await extractTextFromUpload(request.file));
    }
    catch (error) {
        response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося прочитати файл." });
    }
});
app.post("/api/scan", async (request, response) => {
    try {
        response.json(await runScan(request.body));
    }
    catch (error) {
        response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося виконати перевірку." });
    }
});
app.post("/api/scan-file", upload.single("file"), async (request, response) => {
    try {
        if (!request.file) {
            response.status(400).json({ error: "Додайте файл для перевірки." });
            return;
        }
        const extracted = await extractTextFromUpload(request.file);
        const settings = typeof request.body.settings === "string" ? JSON.parse(request.body.settings) : request.body.settings;
        response.json(await runScan({ text: extracted.text, fileName: extracted.fileName, settings }, extracted.fileEvidence));
    }
    catch (error) {
        response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося виконати файлову перевірку." });
    }
});
app.post("/api/ai-opinion", async (request, response) => {
    try {
        const body = request.body;
        const text = prepareDocumentText(body.text).text;
        if (text.length < 120) {
            response.status(400).json({ error: "Додайте щонайменше 120 символів тексту для AI-думки." });
            return;
        }
        const opinion = await analyzeWithLlmProviders(text, {
            probability: Number(body.localProbability) || 0,
            signals: Array.isArray(body.localSignals) ? body.localSignals : []
        });
        if (!opinion) {
            response.status(400).json({ error: "API-ключ або список AI-моделей не налаштовано." });
            return;
        }
        response.json(opinion);
    }
    catch (error) {
        response.status(502).json({ error: error instanceof Error ? error.message : "AI-думка недоступна." });
    }
});
app.post("/api/ai-opinion-file", upload.single("file"), async (request, response) => {
    try {
        if (!request.file) {
            response.status(400).json({ error: "Додайте файл для AI-думки." });
            return;
        }
        const extracted = await extractTextFromUpload(request.file);
        const text = prepareDocumentText(extracted.text).text;
        if (text.length < 120) {
            response.status(400).json({ error: "Файл має містити щонайменше 120 символів тексту для AI-думки." });
            return;
        }
        const localSignals = typeof request.body.localSignals === "string" ? JSON.parse(request.body.localSignals) : [];
        const opinion = await analyzeWithLlmProviders(text, {
            probability: Number(request.body.localProbability) || 0,
            signals: Array.isArray(localSignals) ? localSignals : []
        });
        if (!opinion) {
            response.status(400).json({ error: "API-ключ або список AI-моделей не налаштовано." });
            return;
        }
        response.json(opinion);
    }
    catch (error) {
        response.status(502).json({ error: error instanceof Error ? error.message : "AI-думка для файлу недоступна." });
    }
});
app.post("/api/humanize", async (request, response) => {
    try {
        const body = request.body;
        const result = humanizeText(body.text);
        response.json({
            ...result,
            revisedHtml: body.html?.trim() ? mergeRevisedTextIntoHtml(body.html, result.revisedText) : undefined
        });
    }
    catch (error) {
        response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося олюднити текст." });
    }
});
app.post("/api/humanize-file", upload.single("file"), async (request, response) => {
    try {
        if (!request.file) {
            response.status(400).json({ error: "Додайте файл для олюднення." });
            return;
        }
        const extracted = await extractTextFromUpload(request.file);
        const result = humanizeText(extracted.text);
        response.json({
            ...result,
            revisedHtml: extracted.html ? mergeRevisedTextIntoHtml(extracted.html, result.revisedText) : undefined,
            notes: [
                `Файл прочитано напряму: ${extracted.fileName}.`,
                extracted.html ? "Абзаци, списки, таблиці та інлайн-форматування Word збережено у відредагованій версії." : "Для цього формату доступне лише текстове представлення.",
                ...result.notes
            ]
        });
    }
    catch (error) {
        response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося олюднити файл." });
    }
});
app.post("/api/export-docx", upload.single("file"), async (request, response) => {
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
    }
    catch (error) {
        response.status(400).json({ error: error instanceof Error ? error.message : "Не вдалося зібрати відредагований DOCX." });
    }
});
