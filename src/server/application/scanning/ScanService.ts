import type { ChunkMatch, ChunkSearchResult } from "../../types/ScanService.types.js";
export type { ChunkMatch, ChunkSearchResult } from "../../types/ScanService.types.js";
import crypto from "node:crypto";
import type { FileEvidence, ScanReport, ScanRequest } from "../../../shared/types/index.js";
import type { SearchGateway, AnalysisLogger } from "../../domain/analysis/ports/SearchGateway.js";
import { sanitizeSettings, fullCoverageSettings, thresholdFor, isValidPlagiarismMatch, mapWithConcurrency } from "../../domain/analysis/scanPolicy.js";
import { uniqueMatches } from "../../domain/analysis/reportMatches.js";
import { documentMatchCoverage } from "../../domain/analysis/matchCoverage.js";
import { chunkText, countWords } from "../../domain/analysis/chunking.js";
import { prepareDocumentText } from "../../domain/analysis/documentPreprocess.js";
import { emptySearchDiagnostics, mergeSearchDiagnostics } from "../../domain/analysis/searchDiagnostics.js";
import { calculateConfirmedPlagiarismScore, scoreCandidate, detectAiSignals, summarizeReport } from "./scoring.js";

export class ScanService {
  constructor(
    private readonly search: SearchGateway,
    private readonly logger: AnalysisLogger
  ) {}
  async scan(request: ScanRequest, fileEvidence?: FileEvidence, onProgress?: (checked: number, total: number) => void): Promise<ScanReport> {
    const prepared = prepareDocumentText(request.text);
    const text = prepared.text;
    const wordCount = countWords(text);
    if (wordCount < 25) {
      throw new Error("Додайте щонайменше 25 слів тексту для надійної перевірки.");
    }

    const settings = fullCoverageSettings(sanitizeSettings(request.settings), wordCount);
    const chunks = chunkText(text, settings.chunkWords, settings.overlapWords, settings.maxChunks);
    const longDocumentMode = wordCount > 2000 || chunks.length > 18;
    const veryLongDocumentMode = wordCount > 8000 || chunks.length > 45;
    const searchLimit = settings.sensitivity === "deep" ? (veryLongDocumentMode ? 5 : longDocumentMode ? 7 : 12) : veryLongDocumentMode ? 3 : longDocumentMode ? 4 : 8;
    const concurrency = veryLongDocumentMode ? 8 : settings.sensitivity === "deep" ? 4 : 5;
    const matchedByChunk = await mapWithConcurrency(chunks, concurrency, async (chunk): Promise<ChunkSearchResult> => {
      try {
        const search = await this.search.search(chunk.text, searchLimit, settings.sensitivity === "deep", {
          hydrateLimit: longDocumentMode ? 0 : undefined,
          includeAcademic: settings.sensitivity === "deep" && !veryLongDocumentMode,
          queryLimit: veryLongDocumentMode ? 1 : longDocumentMode ? 2 : undefined
        });
        let candidates = search.candidates;
        try {
          candidates = await this.search.rerank(chunk.text, candidates);
        } catch (rerankError) {
          this.logger.warn({ err: rerankError }, "Semantic reranking failed; falling back to raw candidates");
        }
        return {
          matches: candidates.map((candidate): ChunkMatch => ({ chunkText: chunk.text, match: scoreCandidate(chunk.text, candidate, chunk.index, chunk.startWord) })),
          diagnostics: search.diagnostics
        };
      } catch (error) {
        this.logger.warn(error);
        const diagnostics = emptySearchDiagnostics();
        diagnostics.providers.push({ provider: "Пошуковий pipeline", attempted: 1, succeeded: 0, failed: 1, timedOut: 0, results: 0 });
        return { matches: [], diagnostics };
      } finally {
        if (onProgress) {
          onProgress(chunk.index + 1, chunks.length);
        }
      }
    });
    const preliminaryMatches = matchedByChunk.flatMap((result) => result.matches);
    let searchDiagnostics = mergeSearchDiagnostics(...matchedByChunk.map((result) => result.diagnostics));
    const hydrationTargets = preliminaryMatches
      .filter(({ match }) => match.confidence === "snippet" && (match.score >= Math.max(12, thresholdFor(settings) - 6) || match.longestRun >= 4 || match.overlapPercent >= 20))
      .sort((a, b) => b.match.score - a.match.score || b.match.longestRun - a.match.longestRun)
      .slice(0, veryLongDocumentMode ? 32 : longDocumentMode ? 48 : 80);
    const hydration = await this.search.hydrate(
      hydrationTargets.map(({ match }) => match),
      hydrationTargets.length
    );
    searchDiagnostics = mergeSearchDiagnostics(searchDiagnostics, hydration.diagnostics);
    const hydratedMatches = hydration.candidates.map((candidate, index) => {
      const target = hydrationTargets[index]!;
      return scoreCandidate(target.chunkText, candidate, target.match.chunkIndex, chunks[target.match.chunkIndex]!.startWord);
    });
    const allMatches = [...preliminaryMatches.map(({ match }) => match), ...hydratedMatches];

    const validMatches = uniqueMatches(allMatches)
      .filter((match) => isValidPlagiarismMatch(match, settings))
      .sort((a, b) => Number(b.confidence === "page") - Number(a.confidence === "page") || b.score - a.score || b.longestRun - a.longestRun);
    const coverage = documentMatchCoverage(validMatches, wordCount);
    const matches = validMatches.slice(0, 24);

    const plagiarismScore = calculateConfirmedPlagiarismScore(matches);
    const localAi = detectAiSignals(text);
    const scanNotes = [...prepared.notes];
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
      matchedWords: coverage.matchedWords,
      matchedTextPercent: coverage.percent,
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
      skippedBibliographyWords: prepared.skippedBibliographyWords,
      fileEvidence,
      matches,
      matchesTotal: validMatches.length,
      verifiedSourcesTotal: new Set(validMatches.filter((match) => match.confidence === "page").map((match) => match.url.replace(/#.*$/, "").replace(/\/$/, ""))).size,
      aiSignals: localAi.signals,
      summary: summarizeReport(plagiarismScore, localAi.probability, matches, searchDiagnostics, localAi.verdict),
      sourceText: request.text.slice(0, 100000)
    };
  }
}
